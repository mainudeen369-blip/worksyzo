# 05 — AI architecture

## Goal

Org-scoped assistant that can:

1. **Answer** with citations from knowledge + memory  
2. **Search** documents, memories, tasks, people  
3. **Act** via controlled tools (create task, list pending work) when role allows  

## Pipeline overview

```text
User message
    │
    ▼
Intent router (lightweight)
    │
    ├── pure chat / clarify
    ├── retrieval (RAG)
    └── agent (tools)
            │
            ▼
    Permission-aware tool layer
            │
            ▼
    LLM response + citations + audit
```

## Ingest (Knowledge)

1. Upload → object storage  
2. Queue job: extract text (PDF/DOCX/XLSX/TXT)  
3. Chunk (≈400–800 tokens, overlap)  
4. Embed → `document_chunks`  
5. Mark document `ready` or `failed`  

Failures must be visible in UI with retry.

## Retrieval (RAG)

For a query in org O by user U:

1. Embed query  
2. Similarity search on `document_chunks` + `memory_chunks` **WHERE org_id = O**  
3. Filter out restricted resources U cannot read  
4. Optionally hybrid: keyword (pg_trgm / full text) + vector  
5. Build context window with source metadata (title, page, memory type)  
6. LLM answers; return **citations** array to client  

Never send other orgs’ chunks. Never send restricted docs without grant.

## Memory as first-class data

Memories are not “chat history.” They are structured org records:

- Decisions, notes, meetings (manual create in V1)  
- Optional: summarize a chat thread → save as memory (V1.1)  

Indexed for semantic search same as documents.

## Agent tools (Phase 5; design in V1, enable gradually)

| Tool | Effect | Min role |
|------|--------|----------|
| `search_documents` | retrieval | viewer+ |
| `search_memories` | retrieval | viewer+ |
| `list_tasks` | read tasks (assignee/filter) | viewer+ |
| `get_project` | read project | viewer+ |
| `create_task` | write task | member+ (not viewer) |
| `update_task_status` | write | member+ (own or manager+) |
| `create_memory` | write note/decision | member+ |

Tool executor:

- Injects `org_id`, `user_id`, `role`  
- Re-checks RBAC before DB write  
- Logs `audit_events` for every tool call  
- Returns structured JSON to the model  

No open-ended “run SQL” or “call arbitrary HTTP.”

## Prompting principles

- System prompt: org name, user role, “only use provided context / tools,” refuse cross-tenant speculation  
- Prefer citations over fluent hallucination  
- If context empty: say so; suggest upload or create memory  

## Cost & abuse controls

- Per-org monthly token / request caps from plan  
- Per-user rate limit  
- Max context chunks (e.g. top 8)  
- Truncate tool loops (max N steps)  

## Model abstraction

```text
interface LlmProvider {
  chat(messages, tools?): Promise<...>
  embed(texts): Promise<number[][]>
}
```

Config via env. Default OpenAI-compatible API.

## Mobile voice (Phase 6)

Same `/ai/chat` API; client does STT → text → chat. No separate “voice brain.”

## Eval / quality (lightweight)

- Golden questions per demo org  
- Log thumbs up/down on answers  
- Spot-check citation accuracy monthly
