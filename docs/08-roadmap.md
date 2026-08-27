# 08 — Roadmap

Aligned with the product strategy. Do not pull Phase 8 into Phase 2.

| Phase | Name | Outcome |
|-------|------|---------|
| **1** | Core SaaS | Multi-tenant orgs, auth, RBAC, members, audit, usage stubs |
| **2** | Knowledge | File ingest, chunk/embed, RAG chat, citations |
| **3** | Memory | Decisions, notes, meetings, memory search |
| **4** | Work | Projects, tasks, assignees, deadlines |
| **5** | AI Agent | Controlled tools; act on work/memory with RBAC |
| **6** | Mobile | Employee app + voice → same API |
| **7** | Billing | Razorpay trial + paid plans |
| **8** | Integrations | Drive/M365/email/chat — only what customers demand |

## Suggested build sequencing inside V1

Ship Phases **1 → 2 → 3 → 4 → thin 5** as one V1 release train:

1. Week scaffold: monorepo, auth, orgs, RLS  
2. Documents + worker ingest  
3. Chat RAG + citations  
4. Memories CRUD + include in RAG  
5. Tasks/projects + list/create tools  
6. Harden ACL, audit, usage, demo org seed  

Phases 6–8 only after real customer feedback.

## Kill criteria

If after 10–15 demos nobody cares about Memory/Work and only wants PDF chat — simplify packaging, but **keep tenant architecture** (still a SaaS). Do not rip out multi-tenancy.
