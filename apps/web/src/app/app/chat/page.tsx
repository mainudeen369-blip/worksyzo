'use client';

import { FormEvent, useState } from 'react';
import type { ChatResponseView, CitationView } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationView[];
}

export default function ChatPage() {
  const { activeOrg } = useSession();
  const [message, setMessage] = useState('What is the leave policy?');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!activeOrg) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, { role: 'user', content: text }]);
    setMessage('');
    try {
      const result = await api<ChatResponseView>(`/orgs/${activeOrg!.id}/ai/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text, conversationId }),
      });
      setConversationId(result.conversationId);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: result.answer, citations: result.citations },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chat failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', minHeight: 'calc(100vh - 3rem)' }}>
      <div>
        <h1 style={{ marginTop: 0, marginBottom: '0.35rem' }}>Chat</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Answers from {activeOrg.name}&apos;s documents only, with citations.
        </p>
      </div>

      <div className="card" style={{ padding: '1rem', overflowY: 'auto', marginBottom: '1rem' }}>
        {turns.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Try: “What is the leave policy?” after uploading a policy PDF/TXT.
          </p>
        ) : (
          turns.map((turn, idx) => (
            <div key={idx} style={{ marginBottom: '1.1rem' }}>
              <div className="badge" style={{ marginBottom: '0.35rem' }}>
                {turn.role === 'user' ? 'You' : 'Worksyzo'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{turn.content}</div>
              {turn.citations && turn.citations.length > 0 ? (
                <div style={{ marginTop: '0.6rem' }}>
                  <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                    Sources
                  </div>
                  {turn.citations.map((c, i) => (
                    <div
                      key={`${c.documentId}-${c.chunkIndex}-${i}`}
                      className="muted"
                      style={{
                        fontSize: '0.85rem',
                        borderLeft: '2px solid var(--border)',
                        paddingLeft: '0.65rem',
                        marginBottom: '0.45rem',
                      }}
                    >
                      <strong style={{ color: 'var(--text)' }}>
                        [{i + 1}] {c.title}
                      </strong>
                      <div>{c.excerpt}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.6rem' }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Ask about your organization's documents…"
          style={{
            width: '100%',
            background: 'var(--bg-soft)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            padding: '0.75rem 0.85rem',
            resize: 'vertical',
          }}
        />
        <button className="btn btn-primary" disabled={busy || !message.trim()} type="submit" style={{ justifySelf: 'start' }}>
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
