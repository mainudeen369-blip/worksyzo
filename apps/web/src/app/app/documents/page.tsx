'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { DocumentView, DocumentInspectView } from '@worksyzo/shared';
import { API_URL, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { DocumentInspector } from '@/components/document-inspector';

export default function DocumentsPage() {
  const { activeOrg } = useSession();
  const [docs, setDocs] = useState<DocumentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Inspector modal state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectData, setInspectData] = useState<DocumentInspectView | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

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

  async function openInspect(docId: string) {
    setInspectorOpen(true);
    setInspectLoading(true);
    setInspectData(null);
    try {
      const res = await fetch(`${API_URL}/orgs/${activeOrg!.id}/documents/${docId}/inspect`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to load chunk telemetry');
      }
      const data = (await res.json()) as DocumentInspectView;
      setInspectData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inspect document');
    } finally {
      setInspectLoading(false);
    }
  }

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
      const created = (await res.json()) as DocumentView;
      form.reset();
      await load();
      // Automatically open inspector for the newly uploaded document so user can watch processing
      if (created?.id) {
        void openInspect(created.id);
      }
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
      void openInspect(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this document and all its 1536-dimensional chunk embeddings?')) return;
    const res = await fetch(`${API_URL}/orgs/${activeOrg!.id}/documents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok && res.status !== 204) {
      setError('Delete failed');
      return;
    }
    await load();
    if (inspectData?.document.id === id) {
      setInspectorOpen(false);
    }
  }

  const hasProcessing = docs.some((d) => d.status === 'processing' || d.status === 'pending');

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Document Knowledge Base
          </h1>
          {hasProcessing && (
            <span
              className="badge"
              style={{
                background: 'rgba(37, 99, 235, 0.12)',
                color: 'var(--accent)',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            >
              ● Ingest Worker Active
            </span>
          )}
        </div>
        <p className="muted" style={{ margin: '0.35rem 0 0', maxWidth: '65ch', lineHeight: 1.5 }}>
          Upload policies, SOPs, and handbooks. Worksyzo automatically extracts, splits into semantic overlapping chunks, and computes 1536-dimensional embeddings for RAG chat.
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {/* Upload Card + Pipeline Learning Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* File Upload Form */}
        <form className="card" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} onSubmit={onUpload}>
          <div>
            <div style={{ fontWeight: 750, fontSize: '1rem', marginBottom: '0.3rem' }}>
              Upload Knowledge Document
            </div>
            <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 1rem', lineHeight: 1.45 }}>
              Supported formats: PDF, DOCX, XLSX, TXT, MD, CSV (up to 12 MB).
            </p>

            <div className="field">
              <input
                id="file"
                name="file"
                type="file"
                required
                style={{ padding: '0.5rem', cursor: 'pointer' }}
              />
            </div>
          </div>

          <button className="btn btn-primary" disabled={busy} type="submit" style={{ width: '100%', marginTop: '0.75rem' }}>
            {busy ? (
              'Uploading & Triggering Pipeline…'
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                Upload & Ingest Document
              </>
            )}
          </button>
        </form>

        {/* AI RAG Pipeline Overview Card */}
        <div
          className="card"
          style={{
            padding: '1.4rem',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(34, 197, 94, 0.04) 100%), var(--bg-card)',
            borderColor: 'rgba(37, 99, 235, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(37, 99, 235, 0.14)',
                  color: 'var(--accent)',
                }}
              >
                How It Works (RAG Pipeline)
              </span>
            </div>
            <div style={{ fontWeight: 750, fontSize: '0.98rem', marginBottom: '0.4rem' }}>
              Transparent Document Chunking & Vectorization
            </div>
            <div className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.55 }}>
              1. <strong>Extract:</strong> Reads binary streams into clean text.<br />
              2. <strong>Chunk:</strong> Slices text into ~600-token blocks with 80-token overlap.<br />
              3. <strong>Embed:</strong> Computes 1536-dimensional float vector embeddings.<br />
              4. <strong>pgvector:</strong> Stores in PostgreSQL for instant cosine search.
            </div>
          </div>

          <div style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
            💡 Click &quot;Inspect Chunks 🔬&quot; on any document to view its live breakdown.
          </div>
        </div>
      </div>

      {/* Documents Table with Inspect Actions */}
      <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status & Pipeline</th>
              <th>Size</th>
              <th>Updated</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 650, color: 'var(--text)' }}>{d.title}</div>
                  {d.error ? (
                    <div className="error" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                      {d.error}
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      MIME: {d.mimeType}
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span
                      className={`badge ${
                        d.status === 'ready'
                          ? 'badge-success'
                          : d.status === 'failed'
                          ? 'badge-danger'
                          : ''
                      }`}
                    >
                      {d.status === 'ready' ? '● Ready (Indexed)' : d.status === 'processing' ? '⏳ Processing…' : d.status}
                    </span>
                  </div>
                </td>
                <td className="muted">{(d.byteSize / 1024).toFixed(1)} KB</td>
                <td className="muted">{new Date(d.updatedAt).toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {/* Inspect Chunks Button */}
                    <button
                      className="btn btn-ghost"
                      type="button"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                      onClick={() => void openInspect(d.id)}
                      title="Inspect chunks, tokens and 1536-dim vector embeddings"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                      Inspect Chunks 🔬
                    </button>

                    {d.status === 'failed' ? (
                      <button
                        className="btn btn-ghost"
                        type="button"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                        onClick={() => void retry(d.id)}
                      >
                        Retry
                      </button>
                    ) : null}

                    <button
                      className="btn btn-danger"
                      type="button"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                      onClick={() => void remove(d.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  No documents uploaded yet. Upload your first company policy or PDF above to view the chunking pipeline.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Interactive Modal Drawer Inspector */}
      {inspectorOpen && (
        <DocumentInspector
          data={inspectData}
          loading={inspectLoading}
          onClose={() => setInspectorOpen(false)}
          onRetry={retry}
        />
      )}
    </div>
  );
}
