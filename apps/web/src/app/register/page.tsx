'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionResponse } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<SessionResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, orgName }),
      });
      await refresh();
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 480, paddingTop: '3rem' }}>
      <div className="card" style={{ padding: '1.6rem' }}>
        <h1 style={{ marginTop: 0, marginBottom: '0.3rem' }}>Start your organization</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          14-day trial. You become the owner. Invite your team next.
        </p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="orgName">Organization name</label>
            <input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password (10+ characters)</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Create organization'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', marginBottom: 0 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
