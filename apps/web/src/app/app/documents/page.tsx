'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { DocumentView } from '@worksyzo/shared';
import { API_URL, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function DocumentsPage() {
  const { activeOrg } = useSession();
  const [docs, setDocs] = useState<DocumentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const res = await fetch(`${API_URL}/orgs/${activeOrg.id}/documents`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.message || 'Failed to load documents', body);
    }
    setDocs((await res.json()) as DocumentView[]);
  }, [activeOrg]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to load documents'),
    );
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!activeOrg) return null;

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_URL}/orgs/${activeOrg!.id}/documents`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new ApiError(res.status, payload.message || 'Upload failed', payload);
      }
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    try {
      await fetch(`${API_URL}/orgs/${activeOrg!.id}/documents/${id}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this document and its embeddings?')) return;
    const res = await fetch(`${API_URL}/orgs/${activeOrg!.id}/documents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok && res.status !== 204) {
      setError('Delete failed');
      return;
    }
    await load();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Documents</h1>
      <p className="muted">
        Upload policies, SOPs and handbooks. Ready documents are searchable in Chat with citations.
      </p>
      {error ? <p className="error">{error}</p> : null}

      <form className="card" style={{ padding: '1.2rem', marginBottom: '1rem', maxWidth: 560 }} onSubmit={onUpload}>
        <div className="field">
          <label htmlFor="file">PDF, DOCX, XLSX, TXT, MD, CSV (max 12 MB)</label>
          <input id="file" name="file" type="file" required />
        </div>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Uploading…' : 'Upload document'}
        </button>
      </form>

      <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Size</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.title}
                  {d.error ? (
                    <div className="error" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                      {d.error}
                    </div>
                  ) : null}
                </td>
                <td>
                  <span className="badge">{d.status}</span>
                </td>
                <td className="muted">{(d.byteSize / 1024).toFixed(1)} KB</td>
                <td className="muted">{new Date(d.updatedAt).toLocaleString()}</td>
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  {d.status === 'failed' ? (
                    <button className="btn btn-ghost" type="button" onClick={() => void retry(d.id)}>
                      Retry
                    </button>
                  ) : null}
                  <button className="btn btn-danger" type="button" onClick={() => void remove(d.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {docs.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No documents yet. Upload a leave policy or handbook to try Chat.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
