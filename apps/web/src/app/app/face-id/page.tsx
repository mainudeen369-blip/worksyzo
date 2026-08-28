'use client';

import { useEffect, useState } from 'react';
import type { FaceChallengeResponse, FaceCredentialStatus } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { FaceCam } from '@/components/face-cam';
import type { FaceScanResult } from '@/lib/face-scanner';

export default function FaceIdPage() {
  const [status, setStatus] = useState<FaceCredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [challenge, setChallenge] = useState<FaceChallengeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const data = await api<FaceCredentialStatus>('/auth/face/status');
      setStatus(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load Face ID status');
    } finally {
      setLoading(false);
    }
  }

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const chal = await api<FaceChallengeResponse>('/auth/face/challenge', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setChallenge(chal);
      setEnrolling(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not initialize face challenge');
    } finally {
      setBusy(false);
    }
  }

  async function onFaceCaptured(scan: FaceScanResult) {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; status: FaceCredentialStatus }>('/auth/face/register', {
        method: 'POST',
        body: JSON.stringify({
          descriptor: scan.descriptor,
          expression: scan.expression,
          challengeId: challenge.challengeId,
        }),
      });
      setStatus(res.status);
      setSuccess('Face ID and expression enrolled successfully! You can now sign in with your face.');
      setEnrolling(false);
      setChallenge(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Face registration failed');
      setEnrolling(false);
      setChallenge(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>AI Face ID & Expression Login</h1>
        <p className="muted" style={{ marginTop: '0.4rem', fontSize: '0.95rem' }}>
          Secure, passwordless biometric login with real-time liveness anti-spoofing verification.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Status Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '1rem' }}>Face Biometric Status</h2>

          {loading ? (
            <p className="muted">Checking biometric credentials…</p>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  background: status?.enrolled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${status?.enrolled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{status?.enrolled ? '✅' : '🔒'}</span>
                <div>
                  <strong style={{ display: 'block', color: status?.enrolled ? '#4ade80' : '#f87171' }}>
                    {status?.enrolled ? 'Face ID Enrolled' : 'Not Enrolled'}
                  </strong>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {status?.enrolled
                      ? `Registered on ${new Date(status.createdAt || '').toLocaleDateString()}`
                      : 'Enroll your face to enable 1-click passwordless sign-in.'}
                  </span>
                </div>
              </div>

              {status?.lastUsedAt && (
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Last authenticated with Face ID: {new Date(status.lastUsedAt).toLocaleString()}
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={busy || enrolling}
                onClick={startEnrollment}
              >
                {status?.enrolled ? '📸 Re-enroll / Update Face ID' : '📸 Enroll Face ID with Smile'}
              </button>
            </div>
          )}

          {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}
          {success && (
            <p style={{ color: '#22c55e', fontSize: '0.9rem', marginTop: '1rem', lineHeight: 1.5 }}>
              {success}
            </p>
          )}
        </div>

        {/* Camera / Enrollment HUD */}
        <div className="card" style={{ padding: '1.5rem', minHeight: 320 }}>
          <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '0.8rem' }}>
            {enrolling ? 'Live Biometric Scanner' : 'How It Works'}
          </h2>

          {enrolling && challenge ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <FaceCam
                challengeInstruction={challenge.instruction}
                requiredExpression={challenge.challengeType}
                onVerified={onFaceCaptured}
                busy={busy}
              />
              <button
                type="button"
                className="btn"
                style={{ marginTop: '1rem', fontSize: '0.85rem' }}
                onClick={() => {
                  setEnrolling(false);
                  setChallenge(null);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }} className="muted">
              <div style={{ marginBottom: '0.8rem' }}>
                <strong style={{ color: '#e2e8f0', display: 'block' }}>1. Dynamic Liveness Challenge</strong>
                Worksyzo issues a challenge like <em>"Smile to authenticate"</em>. Static photos fail because they cannot perform dynamic expressions on demand.
              </div>
              <div style={{ marginBottom: '0.8rem' }}>
                <strong style={{ color: '#e2e8f0', display: 'block' }}>2. Facial Landmark & Spatial Vector</strong>
                An in-browser mathematical descriptor (64-dimensional biometric vector) is extracted and compared against your enrolled vector.
              </div>
              <div>
                <strong style={{ color: '#e2e8f0', display: 'block' }}>3. Instant Token Issuance</strong>
                On matching expression and Euclidean distance verification, the API issues a secure HTTP-only session cookie.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
