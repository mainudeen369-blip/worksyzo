'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/lib/session';

const NAV = [
  { href: '/app', label: 'Home' },
  { href: '/app/chat', label: 'Chat' },
  { href: '/app/documents', label: 'Documents' },
  { href: '/app/members', label: 'People' },
  { href: '/app/face-id', label: 'Face ID 📸' },
  { href: '/app/audit', label: 'Audit' },
  { href: '/app/usage', label: 'Usage' },
  { href: '/app/blueprint', label: 'Blueprint' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, organizations, activeOrg, loading, setActiveOrgId, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user || !activeOrg) {
    return (
      <main className="container" style={{ paddingTop: '4rem' }}>
        <p className="muted">Loading your workspace…</p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '240px 1fr' }}>
      <aside
        style={{
          borderRight: '1px solid var(--border)',
          background: 'rgba(8, 12, 22, 0.7)',
          padding: '1.25rem 1rem',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Worksyzo</div>
        <div className="field" style={{ marginBottom: '1.2rem' }}>
          <label htmlFor="org">Organization</label>
          <select
            id="org"
            value={activeOrg.id}
            onChange={(e) => setActiveOrgId(e.target.value)}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <nav style={{ display: 'grid', gap: '0.25rem' }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 10,
                  background: active ? 'rgba(91, 140, 255, 0.15)' : 'transparent',
                  color: active ? '#dbe7ff' : 'var(--muted)',
                  fontWeight: active ? 650 : 500,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ position: 'absolute', bottom: '1.2rem', left: '1rem', right: '1rem' }}>
          <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {user.name}
            <br />
            <span style={{ opacity: 0.8 }}>{activeOrg.role}</span>
          </div>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ padding: '1.5rem 1.75rem' }}>{children}</main>
    </div>
  );
}
