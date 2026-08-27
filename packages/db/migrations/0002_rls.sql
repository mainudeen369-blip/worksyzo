-- ============================================================================
-- 0002_rls: forced row level security for the tenant data plane
-- ============================================================================
-- The API connects as worksyzo_app (NOBYPASSRLS) and opens every tenant
-- request inside a transaction that runs:
--     SELECT set_config('app.current_org_id', $1, true);
--
-- If that setting is missing, current_org_id() returns NULL, every policy
-- evaluates to NULL, and zero rows are visible. Fail-closed by construction:
-- forgetting the tenant context returns nothing rather than everything.
-- ============================================================================

-- Runtime role (Neon / any host). Password can be rotated later via
-- `npm run db:provision` if you want the API on worksyzo_app instead of owner.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worksyzo_app') THEN
    CREATE ROLE worksyzo_app LOGIN PASSWORD 'worksyzo_app_dev_change_me' NOBYPASSRLS;
  END IF;
END
$$;

DO $$
DECLARE
  db text := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO worksyzo_app', db);
EXCEPTION WHEN OTHERS THEN
  -- Some hosts restrict GRANT CONNECT; schema USAGE below is enough to proceed.
  NULL;
END
$$;

GRANT USAGE ON SCHEMA public TO worksyzo_app;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'teams', 'team_members',
    'documents', 'document_chunks', 'resource_grants',
    'memories', 'memory_chunks', 'memory_links',
    'projects', 'tasks', 'task_comments',
    'ai_conversations', 'ai_messages', 'ai_usage_daily',
    'audit_events', 'subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (org_id = public.current_org_id()) '
      || 'WITH CHECK (org_id = public.current_org_id())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END
$$;

-- --- runtime grants ---------------------------------------------------------
-- worksyzo_app gets DML only. No DDL, no ownership, no RLS bypass.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO worksyzo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO worksyzo_app;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO worksyzo_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO worksyzo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO worksyzo_app;

-- Reference data is global and read-only at runtime.
REVOKE INSERT, UPDATE, DELETE ON usage_limits FROM worksyzo_app;

-- Audit is append-only at runtime: no tampering, no cover-ups.
REVOKE UPDATE, DELETE ON audit_events FROM worksyzo_app;
