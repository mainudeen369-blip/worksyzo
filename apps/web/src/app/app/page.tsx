'use client';

import Link from 'next/link';
import { useSession } from '@/lib/session';

export default function AppHomePage() {
  const { activeOrg, user } = useSession();
  if (!activeOrg || !user) return null;

  return (
    <div>
      <h1 style={{ marginTop: 0, letterSpacing: '-0.02em' }}>{activeOrg.name}</h1>
      <p className="muted" style={{ maxWidth: '60ch', lineHeight: 1.55 }}>
        Welcome, {user.name}. You are signed in as <strong>{activeOrg.role}</strong> on the{' '}
        <strong>{activeOrg.planCode}</strong> plan. Step B is live: upload documents and chat with
        citations. Memory, work tools and billing come next.
      </p>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginTop: '1.5rem',
        }}
      >
        {[
          {
            title: 'Chat',
            body: 'Ask your org AI. Answers cite uploaded documents.',
            href: '/app/chat',
          },
          {
            title: 'Documents',
            body: 'Upload policies and SOPs. Ingest + embeddings for RAG.',
            href: '/app/documents',
          },
          {
            title: 'People',
            body: 'Invite teammates. Roles the AI will obey later.',
            href: '/app/members',
          },
          {
            title: 'Audit log',
            body: 'Who did what. Append-only. Owners and admins only.',
            href: '/app/audit',
          },
        ].map((card) => (
          <Link key={card.href} href={card.href} className="card" style={{ padding: '1.2rem', display: 'block' }}>
            <h3 style={{ margin: '0 0 0.4rem' }}>{card.title}</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.45 }}>
              {card.body}
            </p>
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: '1.2rem', marginTop: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Coming next (already designed)</h3>
        <ul className="muted" style={{ marginBottom: 0, lineHeight: 1.7 }}>
          <li>Step B — Document upload, ingest worker, RAG chat with citations</li>
          <li>Step C — Organizational memory (decisions, meetings, notes)</li>
          <li>Step D — Projects & tasks</li>
          <li>Step E — Permission-aware AI tools (create_task, search_*)</li>
        </ul>
      </div>
    </div>
  );
}
