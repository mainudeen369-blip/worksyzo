'use client';

import Link from 'next/link';

const PHASES = [
  {
    id: 'A',
    title: 'Core SaaS',
    status: 'done' as const,
    items: [
      'Multi-tenant organizations (Neon Postgres + RLS)',
      'Auth: register, login, session cookies, invites',
      'Roles: owner / admin / manager / member / viewer',
      'People management + role changes',
      'Append-only audit log',
      'Usage meters (seats, docs, storage, AI) — billing-ready',
      'Isolation proof (12/12 checks)',
    ],
  },
  {
    id: 'B',
    title: 'Knowledge + RAG',
    status: 'done' as const,
    items: [
      'Document upload (PDF, DOCX, XLSX, TXT, MD, CSV)',
      'Object storage: Cloudflare R2 primary, local path fallback',
      'Ingest: extract → chunk → embed → pgvector',
      'Worker polls pending docs (no Redis required)',
      'Chat with citations from org documents only',
      'AI usage metering',
    ],
  },
  {
    id: 'C',
    title: 'Memory',
    status: 'next' as const,
    items: ['Decisions, notes, meetings CRUD', 'Memory search in AI context'],
  },
  {
    id: 'D',
    title: 'Work',
    status: 'planned' as const,
    items: ['Projects & tasks', 'Assignees & deadlines'],
  },
  {
    id: 'E',
    title: 'AI Agent tools',
    status: 'planned' as const,
    items: ['create_task / list_tasks with RBAC', 'Controlled tool loop'],
  },
  {
    id: 'F+',
    title: 'Ship & scale',
    status: 'planned' as const,
    items: ['Render deploy', 'Razorpay billing', 'Mobile', 'Integrations'],
  },
];

export default function BlueprintPage() {
  return (
    <div style={{ maxWidth: 920 }}>
      <p className="badge">Product session · what we built</p>
      <h1 style={{ marginTop: '0.6rem', letterSpacing: '-0.02em' }}>Worksyzo blueprint</h1>
      <p className="muted" style={{ lineHeight: 1.55, maxWidth: '62ch' }}>
        One place to understand the product shape, what is live today, and what comes next.
        Built by Hapyzo Technologies as a private AI employee for organizations — Knowledge +
        Memory + Work + Actions.
      </p>

      {/* Architecture picture */}
      <section className="card" style={{ padding: '1.25rem', marginTop: '1.25rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>System picture</h2>
        <div className="blueprint-flow">
          <div className="blueprint-node">Web<br /><span>Next.js</span></div>
          <div className="blueprint-arrow">→</div>
          <div className="blueprint-node accent">API<br /><span>NestJS</span></div>
          <div className="blueprint-arrow">→</div>
          <div className="blueprint-stack">
            <div className="blueprint-node">Neon<br /><span>Postgres + pgvector</span></div>
            <div className="blueprint-node">R2 / Local<br /><span>file bytes</span></div>
            <div className="blueprint-node">OpenAI<br /><span>embed + chat</span></div>
          </div>
        </div>
        <div className="blueprint-flow" style={{ marginTop: '1rem' }}>
          <div className="blueprint-node">Worker<br /><span>ingest poller</span></div>
          <div className="blueprint-arrow">→</div>
          <div className="blueprint-node">pending docs</div>
          <div className="blueprint-arrow">→</div>
          <div className="blueprint-node accent">chunks + embeddings</div>
        </div>
        <p className="muted" style={{ marginBottom: 0, marginTop: '1rem', fontSize: '0.9rem' }}>
          Tenant rule: every request binds <code>org_id</code>. FORCE RLS fail-closed — no org
          context means zero rows, never all rows.
        </p>
      </section>

      {/* Product pillars */}
      <section className="card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Product pillars</h2>
        <div className="blueprint-pillars">
          {[
            ['Knowledge', 'Docs → search → citations'],
            ['Memory', 'Decisions / meetings (next)'],
            ['Work', 'Tasks / projects (next)'],
            ['AI', 'Answer · Search · Act'],
          ].map(([title, body]) => (
            <div key={title} className="blueprint-pillar">
              <strong>{title}</strong>
              <span className="muted">{body}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Session timeline */}
      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.05rem' }}>Implementation session</h2>
        <div className="blueprint-timeline">
          {PHASES.map((phase) => (
            <article key={phase.id} className={`blueprint-phase status-${phase.status}`}>
              <div className="blueprint-phase-head">
                <span className="blueprint-step">Step {phase.id}</span>
                <h3>{phase.title}</h3>
                <span className={`blueprint-status ${phase.status}`}>
                  {phase.status === 'done' ? 'Live' : phase.status === 'next' ? 'Next' : 'Planned'}
                </span>
              </div>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* How to try */}
      <section className="card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Try what is live</h2>
        <ol className="muted" style={{ lineHeight: 1.7, paddingLeft: '1.2rem' }}>
          <li>
            Sign in as <code>owner@acme.test</code> / <code>worksyzo-demo-2026</code>
          </li>
          <li>
            <Link href="/app/documents">Documents</Link> → upload a policy (needs{' '}
            <code>OPENAI_API_KEY</code> for <code>ready</code>)
          </li>
          <li>
            <Link href="/app/chat">Chat</Link> → ask with citations
          </li>
          <li>
            Check People, Audit, Usage for SaaS controls
          </li>
        </ol>
        <p className="muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
          Storage setup: see <code>docs/09-storage-setup.md</code> — set{' '}
          <code>STORAGE_DRIVER=r2</code> for Cloudflare, or <code>local</code> +{' '}
          <code>STORAGE_LOCAL_DIR</code> for a custom disk path.
        </p>
      </section>
    </div>
  );
}
