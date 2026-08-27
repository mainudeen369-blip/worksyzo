# 02 — System architecture

## High-level

```text
┌─────────────────────────────────────────────────────────────┐
│                     Clients                                  │
│   Web (Next.js)  ·  Admin  ·  Mobile (Phase 6)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / JWT
┌──────────────────────────▼──────────────────────────────────┐
│                   API (NestJS)                               │
│  Auth · Orgs · Users · RBAC · Docs · Memory · Work · AI     │
│  Tenant context middleware (org_id on every request)         │
└──────┬──────────┬──────────┬──────────┬─────────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
  PostgreSQL   Redis     Object     AI Worker
  + pgvector   (queue/   storage   (ingest, embed,
               cache)    (R2/S3)    RAG, tools)
```

## Tech stack (V1 recommendation)

| Layer | Choice | Why |
|-------|--------|-----|
| Web | Next.js 15 (App Router) + TypeScript | Fast SaaS UI, shared types |
| API | NestJS + TypeScript | Clear modules, guards, multi-tenant middleware |
| DB | PostgreSQL 16 + pgvector | One DB for relational + vectors; RLS-ready |
| ORM | Prisma or Drizzle | Prefer **Drizzle** for explicit SQL + RLS patterns |
| Auth | Sessions + JWT (self-hosted) | Avoid vendor lock for B2B; org invite flows |
| Queue | Redis + BullMQ | Document ingest / embedding jobs |
| Files | Cloudflare R2 (or S3) | Cheap object storage; org-prefixed keys |
| LLM | Provider abstraction (OpenAI first) | Swap models without rewriting product |
| Embeddings | text-embedding-3-small (or equiv.) | Cost-effective for SME corpora |
| Billing | Razorpay (Phase 7; architecture ready in V1) | INR, Indian SMEs |
| Hosting | Start: one VPS / Render / Fly; scale later | Keep cost low until PMF |

## Monorepo layout (target)

```text
worksyzo/
  apps/
    web/                 # Next.js
    api/                 # NestJS
    worker/              # BullMQ consumers
  packages/
    shared/              # types, zod schemas, RBAC constants
    db/                  # schema, migrations, tenant helpers
  docs/                  # product architecture (this folder)
```

## Request path (tenant-safe)

1. Authenticate user → `user_id`  
2. Resolve membership → `org_id` + `role` (header or path: `/orgs/:orgId/...`)  
3. Middleware sets `AsyncLocalStorage` / request context: `{ orgId, userId, role }`  
4. All queries **must** filter by `org_id` (and prefer DB RLS as second line of defense)  
5. AI retrieval **always** scoped to `org_id` (+ permission filters)

## Core domains (API modules)

- `auth` — signup, login, invites, password reset  
- `orgs` — organization CRUD, settings  
- `members` — invite, roles, deactivate  
- `documents` — upload, list, delete, status  
- `memories` — decisions, notes, meetings  
- `work` — projects, tasks  
- `ai` — chat, search, tool-calling agent  
- `audit` — append-only audit log  
- `billing` — stubs + usage meters (Razorpay later)

## Observability (minimum)

- Structured logs with `org_id`, `request_id`, `user_id`  
- Error tracking (Sentry)  
- Job failure alerts for ingest pipeline  

## What we deliberately defer

- Microservices  
- Separate vector DB (Pinecone etc.) until Postgres+pgvector hurts  
- Multi-region / BYOK encryption (Enterprise later)  
- Full SSO/SAML (Enterprise later)
