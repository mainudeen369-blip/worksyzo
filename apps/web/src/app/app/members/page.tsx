'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ORG_ROLES,
  ROLE_DESCRIPTIONS,
  assignableRoles,
  type MemberView,
  type OrgRole,
} from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function MembersPage() {
  const { activeOrg } = useSession();
  const [members, setMembers] = useState<MemberView[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<OrgRole>('member');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const rows = await api<MemberView[]>(`/orgs/${activeOrg.id}/members`);
    setMembers(rows);
  }, [activeOrg]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to load members'),
    );
  }, [load]);

  if (!activeOrg) return null;

  const canInvite = assignableRoles(activeOrg.role).length > 0;

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!activeOrg) return;
    setBusy(true);
    setError(null);
    setInviteLink(null);
    try {
      const result = await api<{
        member: MemberView;
        invitePath?: string;
      }>(`/orgs/${activeOrg.id}/members/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, name: name || undefined, role }),
      });
      setInviteLink(result.invitePath ? `${window.location.origin}${result.invitePath}` : null);
      setEmail('');
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, next: OrgRole) {
    if (!activeOrg) return;
    try {
      await api(`/orgs/${activeOrg.id}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Role change failed');
    }
  }

  async function removeMember(userId: string) {
    if (!activeOrg) return;
    if (!window.confirm('Remove this member from the organization?')) return;
    try {
      await api(`/orgs/${activeOrg.id}/members/${userId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Remove failed');
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>People</h1>
      <p className="muted">Roles control both the UI and what the AI is allowed to do.</p>
      {error ? <p className="error">{error}</p> : null}

      <div className="card" style={{ padding: '1rem 1.1rem', marginBottom: '1rem', overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId}>
                <td>{m.name}</td>
                <td className="muted">{m.email}</td>
                <td>
                  {canInvite && m.role !== 'owner' && m.userId !== undefined ? (
                    <select
                      value={m.role}
                      onChange={(e) => void changeRole(m.userId, e.target.value as OrgRole)}
                    >
                      {ORG_ROLES.filter((r) => r !== 'owner').map((r) => (
                        <option key={r} value={r} disabled={!assignableRoles(activeOrg.role).includes(r) && r !== m.role}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge">{m.role}</span>
                  )}
                </td>
                <td>{m.status}</td>
                <td>
                  {canInvite && m.role !== 'owner' ? (
                    <button className="btn btn-danger" onClick={() => void removeMember(m.userId)}>
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canInvite ? (
        <div className="card" style={{ padding: '1.2rem', maxWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>Invite someone</h3>
          <form onSubmit={onInvite}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                {assignableRoles(activeOrg.role).map((r) => (
                  <option key={r} value={r}>
                    {r} — {ROLE_DESCRIPTIONS[r]}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? 'Sending…' : 'Create invite'}
            </button>
          </form>
          {inviteLink ? (
            <p className="muted" style={{ marginTop: '1rem', wordBreak: 'break-all' }}>
              Dev invite link (email not wired yet):
              <br />
              <a href={inviteLink}>{inviteLink}</a>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="muted">Your role cannot invite members.</p>
      )}
    </div>
  );
}
