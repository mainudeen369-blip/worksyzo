# 04 — Database schema

PostgreSQL 16 + **pgvector**. All tenant tables include `org_id UUID NOT NULL` and are covered by RLS.

IDs: UUID v7 (or UUIDv4). Timestamps: `timestamptz`. Prefer soft-delete via `deleted_at` on user-facing entities.

## Core identity & tenancy

```sql
organizations (
  id, name, slug UNIQUE, plan_code, status,  -- active|suspended|trial
  settings jsonb, created_at, updated_at
)

users (
  id, email UNIQUE, password_hash, name, avatar_url,
  created_at, updated_at, last_login_at
)

org_memberships (
  id, org_id, user_id, role,  -- owner|admin|manager|member|viewer
  status,  -- invited|active|disabled
  invited_by, created_at, updated_at,
  UNIQUE (org_id, user_id)
)

teams (  -- optional V1.1; schema ready
  id, org_id, name, created_at
)

team_members (
  org_id, team_id, user_id, UNIQUE (team_id, user_id)
)
```

## Knowledge

```sql
documents (
  id, org_id, title, source_type,  -- upload|url|integration_later
  mime_type, storage_key, byte_size, checksum,
  status,  -- pending|processing|ready|failed
  visibility,  -- org|restricted
  uploaded_by, created_at, updated_at, deleted_at
)

document_chunks (
  id, org_id, document_id,
  chunk_index, content, token_count,
  embedding vector(1536),  -- match embedding model
  metadata jsonb,  -- page, heading, etc.
  created_at
)
-- HNSW / IVFFlat index on embedding; ALWAYS filter org_id in queries

resource_grants (
  id, org_id, resource_type, resource_id,
  principal_type, principal_id,  -- user|role|team
  permission,  -- read|write
  created_at
)
```

## Memory

```sql
memories (
  id, org_id, type,  -- decision|note|meeting|conversation_summary
  title, body, occurred_at,
  visibility, created_by, created_at, updated_at, deleted_at
)

memory_links (  -- optional links to docs/tasks/people
  id, org_id, memory_id, link_type, link_id
)

memory_chunks (  -- for semantic search over long memories
  id, org_id, memory_id, chunk_index, content,
  embedding vector(1536), created_at
)
```

## Work

```sql
projects (
  id, org_id, name, description, status,  -- active|archived
  owner_user_id, created_at, updated_at, deleted_at
)

tasks (
  id, org_id, project_id NULL,
  title, description, status,  -- todo|doing|done|cancelled
  priority, assignee_user_id NULL, due_at NULL,
  created_by, source,  -- ui|ai
  created_at, updated_at, deleted_at
)

task_comments (
  id, org_id, task_id, author_user_id, body, created_at
)
```

## AI

```sql
ai_conversations (
  id, org_id, user_id, title, created_at, updated_at
)

ai_messages (
  id, org_id, conversation_id, role,  -- user|assistant|system|tool
  content, citations jsonb, tool_calls jsonb,
  token_prompt, token_completion, created_at
)

ai_usage_daily (
  org_id, day date,
  prompt_tokens, completion_tokens, embed_tokens, request_count,
  PRIMARY KEY (org_id, day)
)
```

## Audit & billing stubs

```sql
audit_events (
  id, org_id, actor_user_id NULL, action, resource_type, resource_id,
  metadata jsonb, ip, user_agent, created_at
)

subscriptions (
  id, org_id, plan_code, status, razorpay_subscription_id NULL,
  trial_ends_at, current_period_end, created_at, updated_at
)

usage_limits (
  plan_code PRIMARY KEY,
  max_users, max_storage_bytes, max_ai_requests_month, max_docs
)
```

## RLS pattern (example)

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_tenant ON documents
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- API sets: SET LOCAL app.current_org_id = '<uuid>';
```

Same pattern for all tenant tables. Service role / migration role bypasses RLS carefully.

## Indexes (critical)

- `(org_id, created_at DESC)` on documents, memories, tasks, ai_messages  
- `(org_id, assignee_user_id, status)` on tasks  
- `(org_id, document_id, chunk_index)` on document_chunks  
- Vector index **plus** always `WHERE org_id = $1` in similarity search  

## Invariants

1. Every tenant row has `org_id`  
2. Foreign keys that reference other tenant rows must match `org_id` (enforce in app + triggers if needed)  
3. AI never queries chunks without `org_id`  
4. Deleting an org (owner) cascades or soft-locks all child data in a controlled job
