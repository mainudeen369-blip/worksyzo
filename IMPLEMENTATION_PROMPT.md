# IMPLEMENTATION_PROMPT — Worksyzo V1 scaffold

Copy everything below the line into a **new Cursor agent chat** (or run in this repo) when you are ready to generate code. Do not invent product scope beyond `docs/07-v1-scope.md`.

---

## Role

You are implementing **Worksyzo**, a multi-tenant B2B SaaS by Hapyzo Technologies: an organization-scoped AI that combines **Knowledge + Memory + Work + Actions**.

Read and follow these docs in the repo (authoritative):

- `README.md`
- `docs/01-product-vision.md`
- `docs/02-architecture.md`
- `docs/03-tenant-and-security.md`
- `docs/04-database-schema.md`
- `docs/05-ai-architecture.md`
- `docs/06-pricing-and-usage.md`
- `docs/07-v1-scope.md`
- `docs/08-roadmap.md`

## Goal of this session

Scaffold and implement a **working V1 vertical slice**, not a slideware mock:

1. Monorepo with `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/db`
2. Multi-tenant auth + orgs + roles
3. Document upload → ingest → embed → RAG chat with citations
4. Memories CRUD + included in retrieval
5. Projects/tasks + AI tools `list_tasks` / `create_task` with RBAC
6. Audit log + AI usage metering stubs
7. Seed script for demo org + second org to prove isolation
8. README with local run instructions (Docker Compose for Postgres+Redis)

## Hard requirements

- **Language:** TypeScript end-to-end  
- **Web:** Next.js App Router  
- **API:** NestJS  
- **Worker:** BullMQ consumer  
- **DB:** PostgreSQL + pgvector; migrations; RLS policies  
- **ORM:** Drizzle preferred  
- **Files:** local disk or MinIO/S3-compatible for dev; key prefix `orgs/{orgId}/...`  
- **LLM:** provider interface; OpenAI-compatible env config  
- Every tenant query filtered by `org_id`; set `app.current_org_id` for RLS  
- **No cross-org data access** — add an integration test that creates two orgs and asserts isolation  
- Do **not** build: Razorpay live checkout, mobile app, Google/M365/Slack integrations, SAML  

## Implementation order (follow strictly)

### Step A — Foundation
- pnpm workspace monorepo
- Docker Compose: `postgres` (pgvector image), `redis`
- Drizzle schema matching `docs/04-database-schema.md` (core tables for V1)
- RLS policies + helper to run queries in tenant context
- NestJS modules: health, auth, orgs, members
- Register / login / invite accept
- Next.js: auth pages, app shell, org home

### Step B — Knowledge
- Document upload API + storage
- Worker: extract text (PDF/DOCX/XLSX/TXT), chunk, embed, write `document_chunks`
- Document list/detail/status/retry/delete in UI
- `POST /ai/chat` with RAG over documents; return citations `{ documentId, title, chunkIndex, excerpt }`

### Step C — Memory
- CRUD APIs + UI for decision/note/meeting
- Embed memory chunks on create/update
- Include memories in RAG retrieval

### Step D — Work
- Projects + tasks APIs + UI
- AI tools: `search_documents`, `search_memories`, `list_tasks`, `create_task`
- Enforce roles: `viewer` cannot `create_task`
- Audit every tool invocation and sensitive mutation

### Step E — Hardening
- Rate limit AI per user/org
- Increment `ai_usage_daily`
- Admin: members, audit log, usage summary (read-only)
- Seed: Org A with sample docs/memories/tasks; Org B empty/minimal; test users
- `.env.example` with all keys documented
- Root README: setup, migrate, run web/api/worker, demo script from `docs/07-v1-scope.md`

## UI guidance

- Clean B2B SaaS app (not a marketing-art experiment inside the app)
- Primary nav: Chat, Documents, Memories, Tasks, Settings
- Chat shows citations as clickable sources
- Document processing status visible
- Empty states that tell the user what to upload/create next

## Code quality

- Shared Zod schemas in `packages/shared`
- No `org_id` from client trusted without membership check
- Structured logging with `requestId`, `orgId`, `userId`
- Fail ingest jobs loudly; surface error on document record
- Prefer small focused modules; no premature microservices

## Definition of done for this scaffold

- [ ] `docker compose up` + migrate + seed works on a clean machine
- [ ] Two orgs isolated (automated test or scripted proof)
- [ ] Upload PDF → ready → question answered with citation
- [ ] Create memory → AI can recall it
- [ ] Create task via AI as member; denied as viewer
- [ ] Audit entries exist for invite, upload, AI tool use
- [ ] Docs in `/docs` remain the product source of truth (update only if schema diverges, and note why)

## Out of scope reminders

Do not implement Phase 6–8 features. Do not add hospital/HIPAA features. Do not price-lock UI copy as final — use plan codes from `usage_limits` seed data.

## First message checklist for the coding agent

1. Confirm docs are present and summarize V1 cut in 5 bullets  
2. Propose file tree before generating large amounts of code  
3. Implement Step A fully before Step B  
4. Stop after each step and report how to verify  

Begin with Step A.
