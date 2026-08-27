'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuditEventView } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function AuditPage() {
  const { activeOrg } = useSession();
  const [events, setEvents] = useState<AuditEventView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const rows = await api<AuditEventView[]>(`/orgs/${activeOrg.id}/audit?limit=100`);
    setEvents(rows);
  }, [activeOrg]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to load audit log'),
    );
  }, [load]);

  if (!activeOrg) return null;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Audit log</h1>
      <p className="muted">
        Append-only. Runtime role cannot update or delete these rows — verified by the isolation
        test.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.actorName ?? '—'}</td>
                <td>
                  <span className="badge">{e.action}</span>
                </td>
                <td className="muted">
                  {e.resourceType ?? '—'}
                  {e.resourceId ? ` · ${e.resourceId.slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No events yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
