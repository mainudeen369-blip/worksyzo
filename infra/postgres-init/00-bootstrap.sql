-- Runs once on first container start (empty data volume).
-- Creates extensions and the least-privilege application role.
--
-- Two-role model (see docs/03-tenant-and-security.md):
--   postgres      -> owns schema, runs migrations, bypasses RLS
--   worksyzo_app  -> runtime role, RLS is FORCED against it

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worksyzo_app') THEN
    CREATE ROLE worksyzo_app LOGIN PASSWORD 'worksyzo_app' NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE worksyzo TO worksyzo_app;
GRANT USAGE ON SCHEMA public TO worksyzo_app;
