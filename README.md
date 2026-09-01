# Worksyzo

**Private AI employee for organizations** — Knowledge + Memory + Work + Actions.

Built by **Hapyzo Technologies**. Target: affordable B2B SaaS for 20–200 employee Indian companies first.

## Current status: Step B complete (Knowledge + RAG)

- Step A: multi-tenant auth, people, audit, usage (Neon)
- Step B: document upload → extract/chunk/embed → Chat with citations
- Worker polls pending documents (no Redis required)
- Sample file: `samples/acme-leave-policy.txt`

### Required for Chat / embeddings

Add to `.env`:

```env
OPENAI_API_KEY=sk-...
```

Then restart `npm run dev`.

### Try it

1. **Login (Worksyzo only):** http://localhost:3001/login → `owner@acme.test` / `worksyzo-demo-2026`
2. **Documents** → upload `samples/acme-leave-policy.txt`
3. Wait until status is `ready`
4. **Chat** → “What is the leave policy?”

### Page stuck loading / port 3001 not working?

If `npm run dev` shows `EADDRINUSE :::3001`, an old Next.js process is still running. Fix:

```powershell
cd C:\HajaWorkingFolder\oldFiles\Worksyzo
npm run dev:web:clean
```

In a **second terminal**, start API + worker if needed:

```powershell
npm run dev:api
```

**Note:** API runs on **4000**, web on **3001**. Login is always `http://localhost:3001/login` — not Sketchfab or Ready Player Me (those were only optional 3D avatar sites).

## Current status: Step A complete (scaffold)

Multi-tenant foundation is implemented and runnable:

- Monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/db`
- Postgres + pgvector + Redis (Docker)
- Forced RLS on every tenant table + least-privilege `worksyzo_app` role
- Auth (register / login / session cookies / invites)
- Org memberships + roles (`owner|admin|manager|member|viewer`)
- Audit log (append-only at DB level)
- Usage meters (billing-ready stubs)
- Isolation test that must pass before a second customer is sold
- Web app: landing, auth, People, Audit, Usage

Steps B–E (documents, memory, work, AI agent) are designed in `/docs` and not yet coded.

## Quick start

**Prerequisites:** Node 20+, Docker Desktop running.

```powershell
cd C:\HajaWorkingFolder\oldFiles\Worksyzo
copy .env.example .env   # already created for you if using the repo as-is
npm run setup            # install + docker + migrate + seed
npm run dev              # api :4000, web :3000, worker, package watchers
```

Open http://localhost:3000

### Demo accounts (password for all)

`worksyzo-demo-2026`

| Email | Role | Org |
|-------|------|-----|
| owner@acme.test | owner | Acme Manufacturing |
| hr@acme.test | admin | Acme Manufacturing |
| ops@acme.test | manager | Acme Manufacturing |
| staff@acme.test | member | Acme Manufacturing |
| audit@acme.test | viewer | Acme Manufacturing |
| owner@northwind.test | owner | Northwind Traders |
| staff@northwind.test | member | Northwind Traders |

Two orgs exist on purpose so tenant isolation is demonstrable.

### Prove isolation

```powershell
npm run test:isolation
```

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/01-product-vision.md](docs/01-product-vision.md) | Positioning, ICP |
| [docs/02-architecture.md](docs/02-architecture.md) | System architecture |
| [docs/03-tenant-and-security.md](docs/03-tenant-and-security.md) | Multi-tenancy, roles |
| [docs/04-database-schema.md](docs/04-database-schema.md) | Schema |
| [docs/05-ai-architecture.md](docs/05-ai-architecture.md) | RAG / agent |
| [docs/06-pricing-and-usage.md](docs/06-pricing-and-usage.md) | Plans / meters |
| [docs/07-v1-scope.md](docs/07-v1-scope.md) | Hard V1 cut |
| [docs/09-storage-setup.md](docs/09-storage-setup.md) | Cloudflare R2 + local path |
| [IMPLEMENTATION_PROMPT.md](IMPLEMENTATION_PROMPT.md) | Cursor scaffold prompt |

## Architecture highlights (Step A)

```text
Request → SessionGuard → OrgGuard (membership proof) → PermissionGuard
                ↓
         withTenant(orgId)  →  SET LOCAL app.current_org_id
                ↓
         Postgres FORCE ROW LEVEL SECURITY
```

Fail-closed: missing tenant context returns **zero rows**, never all rows.
