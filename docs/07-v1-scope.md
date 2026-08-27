# 07 — V1 scope (hard cut)

V1 = **sellable Core SaaS + Knowledge RAG + basic Memory + basic Work + permission-aware Q&A**.  
Not a full agent platform. Not mobile. Not Razorpay live. Not integrations.

## In scope (must ship)

### Platform
- Multi-tenant orgs  
- Auth (email/password), invites, roles (`owner|admin|manager|member|viewer`)  
- Org switcher / single-org-per-session UX ok  
- Audit log (write + admin view)  
- Usage meters recorded (even if billing UI is stub)  

### Knowledge
- Upload PDF, DOCX, XLSX, TXT  
- Processing status, retry  
- Semantic search + chat with **citations**  
- Delete document  

### Memory
- CRUD for `decision`, `note`, `meeting`  
- Search memories in AI context  
- (No auto-extract from email yet)  

### Work
- Projects (simple)  
- Tasks: assignee, due date, status  
- List/filter my tasks / org tasks  
- AI can **read** tasks in answers; **create_task** tool behind flag (default on for member+)  

### AI
- Org-scoped chat  
- RAG over docs + memories  
- Citations  
- Basic tools: search_*, list_tasks, create_task  
- Rate limits + usage counters  

### Web UI
- Landing (simple)  
- App shell: Docs, Memories, Tasks, Chat, Settings (members, audit, usage)  
- Mobile-responsive web (not native app)

## Explicitly out of V1

- Google Drive / M365 / Slack / WhatsApp / Gmail connectors  
- Native mobile / voice  
- Razorpay checkout (stub only)  
- SAML/SSO  
- Department-complex workflows, approval engines  
- Hospital compliance features  
- Multi-language UI localization (English first; Hindi later)  
- Real-time collaborative editing  

## V1 definition of done

1. Two separate orgs on same deployment; zero data leakage in tests  
2. Upload handbook PDF → ask policy question → cited answer  
3. Create decision memory → ask “what did we decide about X?”  
4. Create task via UI and via AI; appears in task list  
5. Viewer cannot create tasks via AI  
6. Admin can invite user and see audit entries  

## Demo script (sales)

1. Create org “Acme Manufacturing”  
2. Invite 2 users  
3. Upload leave policy + one SOP  
4. Add decision: “Annual day on Dec 12; Ahmed owns auditorium”  
5. Ask AI the five example questions from product vision  
6. Create task via AI for Ahmed
