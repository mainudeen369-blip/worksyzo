'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UsageSnapshot } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

function Meter({
  label,
  used,
  limit,
  format = (n) => String(n),
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="card" style={{ padding: '1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
        <strong>{label}</strong>
        <span className="muted">
          {format(used)} / {format(limit)}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: 'rgba(148,163,184,0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: pct >= 90 ? 'var(--danger)' : 'linear-gradient(90deg, #5b8cff, #22c55e)',
          }}
        />
      </div>
    </div>
  );
}

export default function UsagePage() {
  const { activeOrg } = useSession();
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setUsage(await api<UsageSnapshot>(`/orgs/${activeOrg.id}/usage`));
  }, [activeOrg]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to load usage'),
    );
  }, [load]);

  if (!activeOrg) return null;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Usage</h1>
      <p className="muted">
        Meters are recorded from day one so Razorpay (Phase 7) plugs in without a rewrite.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {usage ? (
        <>
          <p>
            Plan: <span className="badge">{usage.planCode}</span>{' '}
            <span className="muted">· status {usage.status}</span>
            {usage.trialEndsAt ? (
              <span className="muted"> · trial ends {new Date(usage.trialEndsAt).toLocaleDateString()}</span>
            ) : null}
          </p>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <Meter label="Seats" used={usage.seats.used} limit={usage.seats.limit} />
            <Meter label="Documents" used={usage.documents.used} limit={usage.documents.limit} />
            <Meter
              label="Storage"
              used={usage.storageBytes.used}
              limit={usage.storageBytes.limit}
              format={(n) => `${(n / (1024 * 1024)).toFixed(1)} MB`}
            />
            <Meter
              label="AI requests (month)"
              used={usage.aiRequestsThisMonth.used}
              limit={usage.aiRequestsThisMonth.limit}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
