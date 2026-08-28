'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ChatResponseView, CitationView } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ChatMarkdown } from '@/components/chat-markdown';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationView[];
  timestamp: string;
}

const SAMPLE_PROMPTS = [
  'What is the leave policy for employees?',
  'How many days of casual leave do employees receive per year?',
  'What is the procedure for requesting earned leave?',
  'Summarize the key rules from our uploaded documents.',
];

export default function ChatPage() {
  const { activeOrg, user } = useSession();
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever new message turns arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  if (!activeOrg || !user) return null;

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? message).trim();
    if (!text || busy) return;

    const userTurn: Turn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, userTurn]);
    setMessage('');

    try {
      const result = await api<ChatResponseView>(`/orgs/${activeOrg!.id}/ai/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text, conversationId }),
      });

      setConversationId(result.conversationId);
      const assistantTurn: Turn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        citations: result.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chat failed. Please try again.');
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void handleSend();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleCopy(id: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleResetChat() {
    setTurns([]);
    setConversationId(undefined);
    setError(null);
    setMessage('');
  }

  const userInitials = user.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="gpt-chat-page">
      {/* Top Floating Control Bar */}
      <header className="gpt-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
            Worksyzo AI
          </span>
          <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}>
            ● RAG Live
          </span>
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '8px' }}
            onClick={handleResetChat}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            New chat
          </button>
        )}
      </header>

      {/* Main Conversation Stream - Full Page Flow */}
      <main className="gpt-conversation-stream">
        {turns.length === 0 ? (
          <div className="gpt-welcome-container">
            <div className="gpt-brand-badge">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M9.5 9h.01" />
                <path d="M14.5 9h.01" />
              </svg>
            </div>

            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.025em' }}>
              What would you like to know?
            </h1>
            <p className="muted" style={{ margin: '0 0 2rem', fontSize: '0.94rem', lineHeight: 1.5, maxWidth: '540px' }}>
              Search across all verified <strong>{activeOrg.name}</strong> documents with clear executive bullet points and exact citations.
            </p>

            {/* Quick Prompts */}
            <div className="gpt-prompt-grid">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="gpt-prompt-chip-btn"
                  onClick={() => void handleSend(prompt)}
                >
                  <span style={{ fontSize: '0.88rem', fontWeight: 550 }}>{prompt}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="gpt-turns-list">
            {turns.map((turn) => {
              const isUser = turn.role === 'user';
              return (
                <div key={turn.id} className={`gpt-turn-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                  {isUser ? (
                    <div className="gpt-user-message-bubble">
                      {turn.content}
                    </div>
                  ) : (
                    <div className="gpt-assistant-message-body">
                      {/* Assistant Header */}
                      <div className="gpt-assistant-meta">
                        <div className="gpt-assistant-avatar">W</div>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                          Worksyzo AI
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                          {turn.timestamp}
                        </span>
                      </div>

                      {/* Assistant Formatted Markdown Content */}
                      <div className="gpt-markdown-wrapper">
                        <ChatMarkdown content={turn.content} />
                      </div>

                      {/* Citations section if present */}
                      {turn.citations && turn.citations.length > 0 && (
                        <div className="gpt-citations-box">
                          <div className="gpt-citations-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            Verified Sources ({turn.citations.length})
                          </div>

                          <div className="gpt-citations-grid">
                            {turn.citations.map((c, i) => (
                              <div key={`${c.documentId}-${c.chunkIndex}-${i}`} className="gpt-citation-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                  <span className="gpt-citation-pill">[{i + 1}]</span>
                                  <strong style={{ color: 'var(--text)', fontSize: '0.84rem' }}>{c.title}</strong>
                                </div>
                                <div style={{ color: 'var(--muted)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                                  {c.excerpt}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Copy Response Action */}
                      <div className="gpt-message-actions">
                        <button
                          type="button"
                          className="gpt-action-btn"
                          onClick={() => handleCopy(turn.id, turn.content)}
                        >
                          {copiedId === turn.id ? (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span style={{ color: '#16a34a' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Thinking Indicator */}
        {busy && (
          <div className="gpt-thinking-row">
            <div className="gpt-assistant-avatar">W</div>
            <div className="gpt-thinking-bubble">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span style={{ marginLeft: '0.4rem', fontSize: '0.88rem', color: 'var(--muted)', fontWeight: 500 }}>
                Searching documents & synthesizing answer…
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {error && (
        <div className="gpt-error-banner">
          {error}
        </div>
      )}

      {/* Fixed Bottom Floating Capsule Input Bar (ChatGPT Style) */}
      <div className="gpt-fixed-footer">
        <div className="gpt-footer-inner">
          <form onSubmit={onSubmit} className="gpt-input-capsule">
            {/* Left Plus/Attach Button */}
            <button
              type="button"
              className="gpt-icon-btn"
              title="Upload document"
              onClick={() => { window.location.href = '/app/documents'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Main Textarea */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask anything..."
              className="gpt-textarea"
            />

            {/* Right Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span className="gpt-pill-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Think
              </span>

              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="gpt-send-circle-btn"
                aria-label="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </form>

          {/* Subtitle / Disclaimer */}
          <div className="gpt-disclaimer-text">
            Worksyzo can make mistakes. Verify important information with verified source documents.
          </div>
        </div>
      </div>

      <style jsx>{`
        .gpt-chat-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          position: relative;
        }

        .gpt-chat-header {
          position: sticky;
          top: 0;
          z-index: 25;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1.5rem;
          background: var(--topbar-bg);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }

        .gpt-conversation-stream {
          flex: 1;
          max-width: 800px;
          width: 100%;
          margin: 0 auto;
          padding: 1.5rem 1.25rem 9rem 1.25rem;
          display: flex;
          flex-direction: column;
        }

        .gpt-welcome-container {
          margin: auto 0;
          padding: 3rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .gpt-brand-badge {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.25);
        }

        .gpt-prompt-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 0.75rem;
          width: 100%;
          max-width: 640px;
          text-align: left;
        }

        .gpt-prompt-chip-btn {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 0.85rem 1.1rem;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          transition: all 0.15s ease;
          box-shadow: var(--shadow-sm);
        }

        .gpt-prompt-chip-btn:hover {
          border-color: var(--accent);
          background: var(--accent-light);
          color: var(--accent);
          transform: translateY(-1px);
          box-shadow: var(--shadow);
        }

        .gpt-turns-list {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .gpt-turn-row {
          width: 100%;
          display: flex;
        }

        .user-row {
          justify-content: flex-end;
        }

        .assistant-row {
          justify-content: flex-start;
        }

        .gpt-user-message-bubble {
          max-width: 75%;
          padding: 0.75rem 1.25rem;
          background: var(--bg-soft);
          color: var(--text);
          border-radius: 22px 22px 4px 22px;
          border: 1px solid var(--border);
          font-size: 0.96rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
          box-shadow: var(--shadow-sm);
        }

        .gpt-assistant-message-body {
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .gpt-assistant-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .gpt-assistant-avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.85rem;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
          flex-shrink: 0;
        }

        .gpt-markdown-wrapper {
          color: var(--text);
          font-size: 0.95rem;
          line-height: 1.7;
        }

        .gpt-citations-box {
          margin-top: 1.25rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .gpt-citations-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin-bottom: 0.65rem;
        }

        .gpt-citations-grid {
          display: grid;
          gap: 0.5rem;
        }

        .gpt-citation-card {
          padding: 0.65rem 0.85rem;
          border-radius: 10px;
          background: var(--bg-soft);
          border: 1px solid var(--border);
        }

        .gpt-citation-pill {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.05rem 0.45rem;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.12);
          color: var(--accent);
          border: 1px solid rgba(37, 99, 235, 0.25);
        }

        .gpt-message-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .gpt-action-btn {
          background: transparent;
          border: none;
          color: var(--muted);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .gpt-action-btn:hover {
          background: var(--bg-soft);
          color: var(--text);
        }

        .gpt-thinking-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .gpt-thinking-bubble {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.65rem 1rem;
          border-radius: 14px;
          background: var(--bg-soft);
          border: 1px solid var(--border);
        }

        .gpt-error-banner {
          max-width: 800px;
          margin: 0 auto 1rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: var(--danger);
          font-size: 0.88rem;
        }

        /* Fixed Footer at the bottom */
        .gpt-fixed-footer {
          position: fixed;
          bottom: 0;
          left: 260px;
          right: 0;
          z-index: 30;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--bg) 25%, var(--bg) 100%);
          padding: 1.5rem 1rem 1rem 1rem;
          pointer-events: none;
        }

        html[data-theme='dark'] .gpt-fixed-footer {
          background: linear-gradient(180deg, rgba(9, 13, 22, 0) 0%, var(--bg) 25%, var(--bg) 100%);
        }

        .gpt-footer-inner {
          max-width: 800px;
          margin: 0 auto;
          pointer-events: auto;
        }

        .gpt-input-capsule {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 28px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
          padding: 0.5rem 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .gpt-input-capsule:focus-within {
          border-color: var(--accent);
          box-shadow: 0 10px 35px rgba(37, 99, 235, 0.15);
        }

        .gpt-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: var(--bg-soft);
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .gpt-icon-btn:hover {
          background: var(--border);
          color: var(--text);
        }

        .gpt-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-size: 0.95rem;
          line-height: 1.45;
          resize: none;
          padding: 0.35rem 0.2rem;
          max-height: 140px;
        }

        .gpt-pill-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.35rem 0.65rem;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--muted);
          background: var(--bg-soft);
          border: 1px solid var(--border);
        }

        .gpt-send-circle-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: none;
          background: var(--accent);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .gpt-send-circle-btn:disabled {
          background: var(--border);
          color: var(--muted);
          cursor: not-allowed;
        }

        .gpt-send-circle-btn:not(:disabled):hover {
          transform: scale(1.05);
          background: #1d4ed8;
        }

        .gpt-disclaimer-text {
          font-size: 0.72rem;
          color: var(--muted);
          text-align: center;
          margin-top: 0.5rem;
        }

        @media (max-width: 768px) {
          .gpt-fixed-footer {
            left: 0;
            padding: 1rem 0.75rem 0.75rem 0.75rem;
          }

          .gpt-conversation-stream {
            padding: 1rem 0.75rem 8rem 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
