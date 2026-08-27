# 03 — Tenant model & security

## Isolation model

**Shared database, shared schema, strict `org_id` isolation** (row-level tenancy).

```text
Worksyzo SaaS
├── Org A  → users, docs, memories, tasks, AI  (isolated)
├── Org B  → …
└── Org C  → …
```

No cross-org reads/writes. Ever. AI included.

### Why not schema-per-tenant / DB-per-tenant for V1?

- Faster iteration, simpler migrations, lower ops cost for early SMEs  
- Upgrade path later for Enterprise (dedicated DB) if sold  

### Defense in depth

1. **Application:** every query includes `org_id` from verified membership  
2. **Database:** PostgreSQL Row Level Security (RLS) policies on tenant tables  
3. **Storage:** object keys `orgs/{orgId}/documents/{docId}/...`  
4. **AI:** retrieval filters by `org_id` + ACL before LLM sees context  

## Roles (V1)

| Role | Capabilities |
|------|----------------|
| `owner` | Full control; billing; delete org; manage all members |
| `admin` | Manage members, docs, memories, work; org settings (not billing delete) |
| `manager` | Create/edit projects & tasks; upload docs; create memories; use AI |
| `member` | View permitted resources; create own tasks/notes; use AI within ACL |
| `viewer` | Read-only + AI Q&A on visible content (no create task via AI) |

Map loosely to departments later (`hr`, `finance`) via **teams/labels** — not separate role systems in V1.

## Permission model (V1)

**Resource visibility**

- Default: most org content visible to all members of the org (SME-friendly)  
- Optional: document/memory `visibility` = `org` | `restricted`  
- Restricted → ACL table: `resource_grants (org_id, resource_type, resource_id, principal_type, principal_id)`  
  - `principal_type`: `user` | `role` | `team`  

**AI must enforce the same ACL** when retrieving chunks and when executing tools.

## Auth

- Email + password (V1)  
- Magic link optional  
- Invite-by-email → join org with assigned role  
- Session cookies (web) + short-lived access tokens for API  
- Password hashing: Argon2id  

## Audit log (required for SaaS credibility)

Append-only `audit_events`:

- who (`user_id`), which org, action, resource, metadata, IP, timestamp  
- Actions: login, invite, role change, doc upload/delete, memory create, task create/update, AI chat, tool invocation  

Owners/admins can view audit trail for their org.

## Security checklist (V1)

- [ ] Tenant context required on all mutating/query routes  
- [ ] RLS enabled on tenant tables  
- [ ] No raw LLM tools that bypass ACL  
- [ ] File type/size limits; malware scan stub/hook  
- [ ] Rate limits per org and per user (AI especially)  
- [ ] Secrets only in env; never in client  
- [ ] Soft-delete where useful; hard-delete for GDPR-style “leave org” later  

## Compliance posture (honest)

V1: good security hygiene for Indian SMEs, **not** HIPAA/SOC2 Day 1.  
Document roadmap for SOC2 / ISO when selling larger deals. Hospitals wait until compliance story exists.
