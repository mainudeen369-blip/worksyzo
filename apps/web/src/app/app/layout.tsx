'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/lib/session';

interface NavItem {
  href: string;
  label: string;
  badge?: string;
  icon: (active: boolean) => ReactNode;
}

const NAV: NavItem[] = [
  {
    href: '/app',
    label: 'Home',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/app/chat',
    label: 'AI Chat',
    badge: 'RAG',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M9.5 9h.01" />
        <path d="M14.5 9h.01" />
      </svg>
    ),
  },
  {
    href: '/app/documents',
    label: 'Documents',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    ),
  },
  {
    href: '/app/members',
    label: 'Team & Roles',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/app/face-id',
    label: 'Face ID Biometrics',
    badge: 'AI',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <path d="M2 9V5a2 2 0 0 1 2-2h4" />
        <path d="M16 3h4a2 2 0 0 1 2 2v4" />
        <path d="M2 15v4a2 2 0 0 0 2 2h4" />
        <path d="M16 21h4a2 2 0 0 0 2-2v-4" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: '/app/audit',
    label: 'Audit Log',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/app/usage',
    label: 'Usage & Quota',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <line x1="12" x2="12" y1="20" y2="10" />
        <line x1="18" x2="18" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="16" />
      </svg>
    ),
  },
  {
    href: '/app/blueprint',
    label: 'Roadmap & Specs',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.75 }}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, organizations, activeOrg, loading, setActiveOrgId, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading || !user || !activeOrg) {
    return (
      <main className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid var(--accent)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span className="muted" style={{ fontWeight: 500 }}>Loading workspace…</span>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
      <div>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0 0.25rem' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '1.1rem',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
            }}
          >
            W
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--sidebar-text)' }}>
              Worksyzo
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--sidebar-muted)', fontWeight: 600 }}>
              AI Enterprise Suite
            </div>
          </div>
        </div>

        {/* Organization Switcher */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label
            htmlFor="org-select"
            style={{
              display: 'block',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--sidebar-muted)',
              marginBottom: '0.35rem',
              paddingLeft: '0.25rem',
            }}
          >
            Organization
          </label>
          <div style={{ position: 'relative' }}>
            <select
              id="org-select"
              value={activeOrg.id}
              onChange={(e) => setActiveOrgId(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-soft)',
                border: '1px solid var(--sidebar-border)',
                borderRadius: '10px',
                color: 'var(--sidebar-text)',
                padding: '0.55rem 0.75rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation items */}
        <nav style={{ display: 'grid', gap: '0.3rem' }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.62rem 0.8rem',
                  borderRadius: '10px',
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  fontWeight: active ? 650 : 500,
                  fontSize: '0.9rem',
                  transition: 'all 0.15s ease',
                  border: active ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <span style={{ color: active ? 'var(--accent)' : 'var(--sidebar-muted)', display: 'flex' }}>
                    {item.icon(active)}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      background: active ? 'var(--accent)' : 'var(--bg-soft)',
                      color: active ? '#ffffff' : 'var(--sidebar-muted)',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer Profile */}
      <div
        style={{
          borderTop: '1px solid var(--sidebar-border)',
          paddingTop: '0.9rem',
          marginTop: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.8rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div
              style={{
                fontWeight: 650,
                fontSize: '0.88rem',
                color: 'var(--sidebar-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                  background: 'rgba(34, 197, 94, 0.14)',
                  color: 'var(--accent-2)',
                }}
              >
                {activeOrg.role}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--sidebar-muted)' }}>
                {activeOrg.planCode}
              </span>
            </div>
          </div>
        </div>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
          onClick={() => void signOut()}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      {/* Mobile Top Navigation Bar (< 768px) */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" x2="21" y1="6" y2="6" />
              <line x1="3" x2="21" y1="12" y2="12" />
              <line x1="3" x2="21" y1="18" y2="18" />
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
              }}
            >
              W
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>Worksyzo</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge" style={{ fontSize: '0.72rem' }}>
            {activeOrg.name}
          </span>
        </div>
      </header>

      {/* Mobile Backdrop & Drawer */}
      {mobileMenuOpen ? (
        <div className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.35rem 0.65rem', border: 'none' }}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      ) : null}

      {/* Desktop Sticky Sidebar (>= 768px) */}
      <aside className="desktop-sidebar">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <main className="app-main-content">
        <div className="app-content-inner">
          {children}
        </div>
      </main>

      <style jsx global>{`
        .app-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .mobile-topbar {
          display: none;
          position: sticky;
          top: 0;
          z-index: 40;
          padding: 0.75rem 1rem;
          background: var(--topbar-bg);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          justify-content: space-between;
          align-items: center;
        }

        .mobile-menu-btn {
          background: transparent;
          border: none;
          color: var(--text);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }

        .mobile-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          z-index: 50;
          animation: fadeIn 0.18s ease;
        }

        .mobile-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          max-width: 85vw;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          padding: 1.25rem 1rem;
          overflow-y: auto;
          box-shadow: var(--shadow-lg);
          animation: slideRight 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .desktop-sidebar {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          padding: 1.25rem 1rem;
          overflow-y: auto;
          z-index: 30;
        }

        .app-main-content {
          flex: 1;
          margin-left: 260px;
          min-width: 0;
          padding: 2rem;
          background: var(--bg);
        }

        .app-content-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .mobile-topbar {
            display: flex;
          }

          .desktop-sidebar {
            display: none;
          }

          .app-main-content {
            margin-left: 0;
            padding: 1.25rem 1rem;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
