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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 4.5rem)',
        maxHeight: 'calc(100vh - 4.5rem)',
        gap: '0.75rem',
      }}
    >
      {/* Top Title Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            AI Knowledge Chat
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
              ● RAG Live
            </span>
          </h1>
          <p className="muted" style={{ margin: '0.15rem 0 0', fontSize: '0.85rem' }}>
            Answers strictly from <strong>{activeOrg.name}</strong> documents with verifiable citations.
          </p>
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
            onClick={handleResetChat}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            New Conversation
          </button>
        )}
      </div>

      {/* Main Chat Messages Viewport with Custom GPT Scrollbar */}
      <div
        className="card chat-scroll-container"
        style={{
          flex: 1,
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '16px',
        }}
      >
        {turns.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              maxWidth: '640px',
              textAlign: 'center',
              padding: '2rem 1rem',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M9.5 9h.01" />
                <path d="M14.5 9h.01" />
              </svg>
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 750, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
              Ask anything about your organization
            </h2>
            <p className="muted" style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Worksyzo reads all uploaded PDF, DOCX, and text files, extracts key facts, and provides answers with bulleted clarity and exact sources.
            </p>

            {/* Quick sample prompt chips */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.65rem',
                textAlign: 'left',
              }}
            >
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chat-prompt-chip"
                  onClick={() => void handleSend(prompt)}
                >
                  <span>{prompt}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => {
            const isUser = turn.role === 'user';
            return (
              <div
                key={turn.id}
                style={{
                  display: 'flex',
                  gap: '0.85rem',
                  alignItems: 'flex-start',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  maxWidth: '100%',
                }}
              >
                {/* Avatar Icon */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: isUser ? '50%' : '10px',
                    background: isUser
                      ? 'linear-gradient(135deg, #4f46e5, #06b6d4)'
                      : 'linear-gradient(135deg, #2563eb, #38bdf8)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: isUser ? '0.82rem' : '0.95rem',
                    flexShrink: 0,
                    boxShadow: isUser
                      ? '0 2px 8px rgba(79, 70, 229, 0.25)'
                      : '0 4px 12px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  {isUser ? userInitials : 'W'}
                </div>

                {/* Message Bubble & Content */}
                <div
                  style={{
                    maxWidth: isUser ? '75%' : '88%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  {/* Sender Label & Timestamp */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginBottom: '0.25rem',
                      fontSize: '0.75rem',
                      color: 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    <span>{isUser ? 'You' : 'Worksyzo AI'}</span>
                    <span>•</span>
                    <span>{turn.timestamp}</span>
                  </div>

                  {/* Main Bubble */}
                  <div
                    style={{
                      padding: isUser ? '0.75rem 1.05rem' : '1.1rem 1.35rem',
                      borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: isUser
                        ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                        : 'var(--bg-soft)',
                      color: isUser ? '#ffffff' : 'var(--text)',
                      border: isUser ? 'none' : '1px solid var(--border)',
                      boxShadow: 'var(--shadow-sm)',
                      lineHeight: 1.6,
                      fontSize: '0.93rem',
                      width: isUser ? 'auto' : '100%',
                    }}
                  >
                    {isUser ? (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {turn.content}
                      </div>
                    ) : (
                      <div>
                        <ChatMarkdown content={turn.content} />

                        {/* Citations section if present */}
                        {turn.citations && turn.citations.length > 0 && (
                          <div
                            style={{
                              marginTop: '1rem',
                              paddingTop: '0.85rem',
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--muted)',
                                marginBottom: '0.5rem',
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              Source Citations ({turn.citations.length})
                            </div>

                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                              {turn.citations.map((c, i) => (
                                <div
                                  key={`${c.documentId}-${c.chunkIndex}-${i}`}
                                  style={{
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: 10,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.84rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '0.05rem 0.4rem',
                                        borderRadius: 999,
                                        background: 'rgba(37, 99, 235, 0.12)',
                                        color: 'var(--accent)',
                                      }}
                                    >
                                      [{i + 1}]
                                    </span>
                                    <strong style={{ color: 'var(--text)', fontSize: '0.86rem' }}>
                                      {c.title}
                                    </strong>
                                  </div>
                                  <div
                                    style={{
                                      color: 'var(--muted)',
                                      fontSize: '0.8rem',
                                      lineHeight: 1.45,
                                      paddingLeft: '0.25rem',
                                    }}
                                  >
                                    {c.excerpt}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions under Assistant Turn (Copy button) */}
                  {!isUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(turn.id, turn.content)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: 6,
                        }}
                      >
                        {copiedId === turn.id ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span style={{ color: '#16a34a' }}>Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy response
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Thinking Indicator */}
        {busy && (
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.95rem',
                flexShrink: 0,
              }}
            >
              W
            </div>
            <div
              style={{
                padding: '0.9rem 1.25rem',
                borderRadius: '4px 16px 16px 16px',
                background: 'var(--bg-soft)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span style={{ marginLeft: '0.4rem', fontSize: '0.84rem', color: 'var(--muted)', fontWeight: 500 }}>
                Searching documents & synthesizing answer…
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && <div className="error" style={{ margin: '0 0.5rem' }}>{error}</div>}

      {/* Sticky Bottom Floating Prompt Bar */}
      <form
        onSubmit={onSubmit}
        className="card"
        style={{
          padding: '0.75rem 0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          borderRadius: '14px',
          background: 'var(--bg-card)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Ask about leave policies, handbooks, SOPs… (Press Enter to send, Shift+Enter for new line)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: '0.92rem',
              lineHeight: 1.45,
              resize: 'none',
              outline: 'none',
              padding: '0.25rem',
            }}
          />

          <button
            className="btn btn-primary"
            disabled={busy || !message.trim()}
            type="submit"
            style={{
              padding: '0.65rem 1.2rem',
              borderRadius: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {busy ? (
              'Thinking…'
            ) : (
              <>
                <span>Ask</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </>
            )}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: 'var(--muted)',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '0.4rem',
            margin: '0 0.25rem',
          }}
        >
          <span>Powered by Worksyzo RAG • Local & Cloud AI fallback enabled</span>
          <span>Shift + Enter for new line</span>
        </div>
      </form>
    </div>
  );
}
