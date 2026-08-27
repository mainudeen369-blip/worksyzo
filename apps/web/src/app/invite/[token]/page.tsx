'use client';

import { FormEvent, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { SessionResponse } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<SessionResponse>('/invites/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: params.token,
          name: name || undefined,
          password,
        }),
      });
      await refresh();
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept invite');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 440, paddingTop: '4rem' }}>
      <div className="card" style={{ padding: '1.6rem' }}>
        <h1 style={{ marginTop: 0 }}>Join organization</h1>
        <p className="muted">Set a password to activate your membership.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Password (10+ characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? 'Joining…' : 'Accept invite'}
          </button>
        </form>
      </div>
    </main>
  );
}
