-- ============================================================================
-- 0001_init: identity plane + tenant data plane
-- ============================================================================
-- Two planes:
--   Identity plane (users, user_sessions, organizations, org_memberships,
--   usage_limits) is queried BEFORE a tenant is known (login, "which orgs am
--   I in?"). It is guarded by application-level user_id scoping.
--
--   Tenant data plane (everything else) carries org_id and is additionally
--   protected by FORCE ROW LEVEL SECURITY in 0002_rls.sql.
--
-- Cross-tenant integrity is enforced structurally: child rows reference
-- (org_id, id) composite keys, so a row can never point at another org's row.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- --- shared helpers ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Identity plane
-- ============================================================================

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  name            text NOT NULL,
  password_hash   text,                       -- null until an invite is accepted
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz
);
-- Case-insensitive uniqueness without requiring the citext extension.
CREATE UNIQUE INDEX users_email_key ON users (lower(email));
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE user_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,         -- sha256 of the opaque cookie value
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id, expires_at DESC);

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  plan_code   text NOT NULL DEFAULT 'trial',
  status      text NOT NULL DEFAULT 'trial'
              CHECK (status IN ('trial', 'active', 'suspended')),
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE org_memberships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role               text NOT NULL
                     CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  status             text NOT NULL DEFAULT 'invited'
                     CHECK (status IN ('invited', 'active', 'disabled')),
  invited_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  invite_token_hash  text UNIQUE,
  invite_expires_at  timestamptz,
  joined_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX org_memberships_user_idx ON org_memberships (user_id, status);
CREATE TRIGGER org_memberships_updated_at BEFORE UPDATE ON org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Exactly one owner is not enforced, but at least one must remain: guarded in
-- the API (see MembersService.updateRole / remove).

CREATE TABLE usage_limits (
  plan_code              text PRIMARY KEY,
  display_name           text NOT NULL,
  price_inr_monthly      integer NOT NULL DEFAULT 0,
  max_users              integer NOT NULL,
  max_documents          integer NOT NULL,
  max_storage_bytes      bigint  NOT NULL,
  max_ai_requests_month  integer NOT NULL,
  sort_order             integer NOT NULL DEFAULT 0
);

-- ============================================================================
-- Tenant data plane
-- ============================================================================

CREATE TABLE teams (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (org_id, id),
  UNIQUE (org_id, name)
);

CREATE TABLE team_members (
  org_id   uuid NOT NULL,
  team_id  uuid NOT NULL,
  user_id  uuid NOT NULL,
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (org_id, team_id) REFERENCES teams(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, user_id) REFERENCES org_memberships(org_id, user_id) ON DELETE CASCADE
);

CREATE TABLE documents (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title        text NOT NULL,
  source_type  text NOT NULL DEFAULT 'upload'
               CHECK (source_type IN ('upload', 'url', 'integration')),
  mime_type    text NOT NULL,
  storage_key  text NOT NULL,
  byte_size    bigint NOT NULL DEFAULT 0,
  checksum     text,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error        text,
  visibility   text NOT NULL DEFAULT 'org' CHECK (visibility IN ('org', 'restricted')),
  uploaded_by  uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  PRIMARY KEY (id),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, uploaded_by) REFERENCES org_memberships(org_id, user_id)
);
CREATE INDEX documents_org_created_idx ON documents (org_id, created_at DESC);
CREATE INDEX documents_org_status_idx ON documents (org_id, status);
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE document_chunks (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  document_id  uuid NOT NULL,
  chunk_index  integer NOT NULL,
  content      text NOT NULL,
  token_count  integer NOT NULL DEFAULT 0,
  embedding    vector(1536),
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (org_id, document_id, chunk_index),
  FOREIGN KEY (org_id, document_id) REFERENCES documents(org_id, id) ON DELETE CASCADE
);
CREATE INDEX document_chunks_org_doc_idx ON document_chunks (org_id, document_id, chunk_index);

CREATE TABLE resource_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   text NOT NULL CHECK (resource_type IN ('document', 'memory', 'project')),
  resource_id     uuid NOT NULL,
  principal_type  text NOT NULL CHECK (principal_type IN ('user', 'role', 'team')),
  principal_id    text NOT NULL,
  permission      text NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, resource_type, resource_id, principal_type, principal_id, permission)
);
CREATE INDEX resource_grants_lookup_idx ON resource_grants (org_id, resource_type, resource_id);

CREATE TABLE memories (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type         text NOT NULL
               CHECK (type IN ('decision', 'note', 'meeting', 'conversation_summary')),
  title        text NOT NULL,
  body         text NOT NULL,
  occurred_at  timestamptz,
  visibility   text NOT NULL DEFAULT 'org' CHECK (visibility IN ('org', 'restricted')),
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  PRIMARY KEY (id),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, created_by) REFERENCES org_memberships(org_id, user_id)
);
CREATE INDEX memories_org_created_idx ON memories (org_id, created_at DESC);
CREATE INDEX memories_org_type_idx ON memories (org_id, type);
CREATE TRIGGER memories_updated_at BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE memory_chunks (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  memory_id    uuid NOT NULL,
  chunk_index  integer NOT NULL,
  content      text NOT NULL,
  embedding    vector(1536),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (org_id, memory_id, chunk_index),
  FOREIGN KEY (org_id, memory_id) REFERENCES memories(org_id, id) ON DELETE CASCADE
);

CREATE TABLE memory_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  memory_id  uuid NOT NULL,
  link_type  text NOT NULL CHECK (link_type IN ('document', 'task', 'project', 'user')),
  link_id    uuid NOT NULL,
  FOREIGN KEY (org_id, memory_id) REFERENCES memories(org_id, id) ON DELETE CASCADE,
  UNIQUE (org_id, memory_id, link_type, link_id)
);

CREATE TABLE projects (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  owner_user_id  uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  PRIMARY KEY (id),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, owner_user_id) REFERENCES org_memberships(org_id, user_id) ON DELETE SET NULL
);
CREATE INDEX projects_org_created_idx ON projects (org_id, created_at DESC);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE tasks (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        uuid,
  title             text NOT NULL,
  description       text,
  status            text NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'doing', 'done', 'cancelled')),
  priority          text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assignee_user_id  uuid,
  due_at            timestamptz,
  created_by        uuid NOT NULL,
  source            text NOT NULL DEFAULT 'ui' CHECK (source IN ('ui', 'ai')),
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  PRIMARY KEY (id),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, project_id) REFERENCES projects(org_id, id) ON DELETE SET NULL,
  FOREIGN KEY (org_id, assignee_user_id) REFERENCES org_memberships(org_id, user_id) ON DELETE SET NULL,
  FOREIGN KEY (org_id, created_by) REFERENCES org_memberships(org_id, user_id)
);
CREATE INDEX tasks_org_created_idx ON tasks (org_id, created_at DESC);
CREATE INDEX tasks_org_assignee_status_idx ON tasks (org_id, assignee_user_id, status);
CREATE INDEX tasks_org_due_idx ON tasks (org_id, due_at) WHERE status IN ('todo', 'doing');
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE task_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  task_id         uuid NOT NULL,
  author_user_id  uuid NOT NULL,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, task_id) REFERENCES tasks(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, author_user_id) REFERENCES org_memberships(org_id, user_id)
);
CREATE INDEX task_comments_task_idx ON task_comments (org_id, task_id, created_at);

CREATE TABLE ai_conversations (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  title       text NOT NULL DEFAULT 'New conversation',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, user_id) REFERENCES org_memberships(org_id, user_id) ON DELETE CASCADE
);
CREATE INDEX ai_conversations_org_user_idx ON ai_conversations (org_id, user_id, updated_at DESC);
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE ai_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL,
  conversation_id    uuid NOT NULL,
  role               text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content            text NOT NULL,
  citations          jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_calls         jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_prompt       integer NOT NULL DEFAULT 0,
  token_completion   integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, conversation_id) REFERENCES ai_conversations(org_id, id) ON DELETE CASCADE
);
CREATE INDEX ai_messages_conversation_idx ON ai_messages (org_id, conversation_id, created_at);

CREATE TABLE ai_usage_daily (
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day                date NOT NULL,
  request_count      integer NOT NULL DEFAULT 0,
  prompt_tokens      bigint  NOT NULL DEFAULT 0,
  completion_tokens  bigint  NOT NULL DEFAULT 0,
  embed_tokens       bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, day)
);

CREATE TABLE audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  action          text NOT NULL,
  resource_type   text,
  resource_id     uuid,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_created_idx ON audit_events (org_id, created_at DESC);
CREATE INDEX audit_events_org_action_idx ON audit_events (org_id, action, created_at DESC);

CREATE TABLE subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code                text NOT NULL REFERENCES usage_limits(plan_code),
  status                   text NOT NULL DEFAULT 'trialing'
                           CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  razorpay_subscription_id text,
  trial_ends_at            timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
