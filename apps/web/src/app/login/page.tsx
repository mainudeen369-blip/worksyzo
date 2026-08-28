'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FaceChallengeResponse, SessionResponse } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { FaceCam } from '@/components/face-cam';
import type { FaceScanResult } from '@/lib/face-scanner';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [authMode, setAuthMode] = useState<'password' | 'face'>('password');
  const [email, setEmail] = useState('owner@acme.test');
  const [password, setPassword] = useState('worksyzo-demo-2026');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Face auth state
  const [challenge, setChallenge] = useState<FaceChallengeResponse | null>(null);
  const [faceScanning, setFaceScanning] = useState(false);

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<SessionResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await refresh();
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function startFaceAuth() {
    if (!email.trim()) {
      setError('Please enter your work email first');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const chal = await api<FaceChallengeResponse>('/auth/face/challenge', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setChallenge(chal);
      setFaceScanning(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not initialize face challenge');
    } finally {
      setBusy(false);
    }
  }

  async function onFaceVerified(scan: FaceScanResult) {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      setSuccess('Face & expression verified! Authenticating…');
      await api<SessionResponse>('/auth/face/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          descriptor: scan.descriptor,
          expression: scan.expression,
          challengeId: challenge.challengeId,
        }),
      });
      await refresh();
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Face login failed');
      setFaceScanning(false);
      setChallenge(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 460, paddingTop: '3.5rem' }}>
      <div className="card" style={{ padding: '1.8rem' }}>
        <h1 style={{ marginTop: 0, marginBottom: '0.3rem', fontSize: '1.6rem' }}>Sign in to Worksyzo</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1.2rem', fontSize: '0.9rem' }}>
          Access your organization’s private AI workspace
        </p>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: 4,
            borderRadius: 10,
            marginBottom: '1.4rem',
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setFaceScanning(false);
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: authMode === 'password' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: authMode === 'password' ? '#fff' : 'inherit',
              transition: 'all 0.2s',
            }}
          >
            🔑 Password
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('face');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: authMode === 'face' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: authMode === 'face' ? '#fff' : 'inherit',
              transition: 'all 0.2s',
            }}
          >
            📸 AI Face Login
          </button>
        </div>

        {authMode === 'password' ? (
          <form onSubmit={onPasswordSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="error">{error}</p> : null}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Sign in with Password'}
            </button>
          </form>
        ) : (
          <div>
            <div className="field">
              <label htmlFor="face-email">Work Email</label>
              <input
                id="face-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>

            {faceScanning && challenge ? (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <FaceCam
                  challengeInstruction={challenge.instruction}
                  requiredExpression={challenge.challengeType}
                  onVerified={onFaceVerified}
                  busy={busy}
                />
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: '0.8rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    setFaceScanning(false);
                    setChallenge(null);
                  }}
                >
                  Cancel Face Scan
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '0.6rem' }}>
                <p className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                  AI Liveness & Biometric Login verifies your face and required expression (e.g. smile) in real-time.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={busy}
                  onClick={startFaceAuth}
                >
                  {busy ? 'Starting Camera…' : 'Scan Face & Authenticate'}
                </button>
              </div>
            )}

            {error ? <p className="error" style={{ marginTop: '0.8rem' }}>{error}</p> : null}
            {success ? (
              <p style={{ color: '#22c55e', fontSize: '0.85rem', marginTop: '0.8rem', textAlign: 'center' }}>
                {success}
              </p>
            ) : null}
          </div>
        )}

        <div
          style={{
            marginTop: '1.4rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
          }}
        >
          <span className="muted">New here?</span>
          <Link href="/register" style={{ fontWeight: 600 }}>Create an organization</Link>
        </div>
      </div>
    </main>
  );
}
