'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { ChatResponseView, CitationView } from '@worksyzo/shared';
import { api, ApiError } from '@/lib/api';
import { matchNavCommand } from '@/lib/assistant-nav';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  listenOnce,
  speakText,
  stripMarkdownForSpeech,
} from '@/lib/assistant-speech';
import { useSession } from '@/lib/session';
import { ChatMarkdown } from '@/components/chat-markdown';
import type { AvatarMood } from '@/components/avatar/avatar-scene';

const AvatarScene = dynamic(
  () => import('@/components/avatar/avatar-scene').then((m) => m.AvatarScene),
  { ssr: false, loading: () => <div className="avatar-assistant-scene-loading">Loading 3D assistant…</div> },
);

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationView[];
}

const QUICK_PROMPTS = [
  'What is our leave policy?',
  'Open documents',
  'Go to team members',
];

export function AvatarAssistant() {
  const { activeOrg, user } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const stopSpeakRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mood: AvatarMood = celebrate
    ? 'celebrate'
    : speaking
      ? 'talking'
      : busy
        ? 'thinking'
        : 'idle';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy, open]);

  useEffect(() => {
    return () => {
      stopSpeakRef.current?.();
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  const triggerCelebrate = useCallback(() => {
    setCelebrate(true);
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    celebrateTimerRef.current = setTimeout(() => setCelebrate(false), 2200);
  }, []);

  const say = useCallback(
    (text: string) => {
      stopSpeakRef.current?.();
      if (!voiceEnabled || !isSpeechSynthesisSupported()) return;
      stopSpeakRef.current = speakText(
        text,
        () => setSpeaking(true),
        () => setSpeaking(false),
      );
    },
    [voiceEnabled],
  );

  const handleAssistantReply = useCallback(
    (content: string, options?: { navigate?: { href: string }; citations?: CitationView[] }) => {
      const turn: Turn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content,
        citations: options?.citations,
      };
      setTurns((prev) => [...prev, turn]);
      triggerCelebrate();
      say(content);
      if (options?.navigate) {
        setTimeout(() => router.push(options.navigate!.href), 700);
      }
    },
    [router, say, triggerCelebrate],
  );

  const runMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !activeOrg || busy) return;

      setError(null);
      setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
      setMessage('');

      const nav = matchNavCommand(text);
      if (nav) {
        handleAssistantReply(nav.reply, { navigate: { href: nav.href } });
        return;
      }

      setBusy(true);
      try {
        const res = await api<ChatResponseView>(`/orgs/${activeOrg.id}/ai/chat`, {
          method: 'POST',
          body: JSON.stringify({ message: text, conversationId }),
        });
        setConversationId(res.conversationId);
        handleAssistantReply(res.answer, { citations: res.citations });
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong.';
        setError(msg);
        handleAssistantReply(`Sorry, I could not complete that. ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [activeOrg, busy, conversationId, handleAssistantReply],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await runMessage(message);
  }

  async function handleMic() {
    if (listening || busy) return;
    setError(null);
    setListening(true);
    try {
      const heard = await listenOnce({
        onInterim: (partial) => setMessage(partial),
        onError: (msg) => setError(msg),
      });
      setMessage(heard);
      await runMessage(heard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice input failed.');
    } finally {
      setListening(false);
    }
  }

  if (!activeOrg || !user) return null;

  const preview =
    turns.length > 0
      ? stripMarkdownForSpeech(turns[turns.length - 1]?.content ?? '').slice(0, 72)
      : 'Ask me about your company docs or say "open documents".';

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="avatar-assistant-fab"
          onClick={() => setOpen(true)}
          aria-label="Open Worksyzo 3D assistant"
        >
          <span className="avatar-assistant-fab-pulse" />
          <span className="avatar-assistant-fab-icon">W</span>
          <span className="avatar-assistant-fab-label">Worksyzo</span>
        </button>
      ) : (
        <section className="avatar-assistant-panel" aria-label="Worksyzo 3D assistant">
          <header className="avatar-assistant-header">
            <div>
              <div className="avatar-assistant-title">Worksyzo</div>
              <div className="avatar-assistant-subtitle">{activeOrg.name} · Groq AI</div>
            </div>
            <div className="avatar-assistant-header-actions">
              <button
                type="button"
                className="avatar-assistant-icon-btn"
                onClick={() => setVoiceEnabled((v) => !v)}
                title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
              >
                {voiceEnabled ? '🔊' : '🔇'}
              </button>
              <button
                type="button"
                className="avatar-assistant-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="avatar-assistant-scene-wrap">
            <AvatarScene mood={mood} />
            <div className="avatar-assistant-status-pill">
              {listening ? 'Listening…' : speaking ? 'Speaking…' : busy ? 'Thinking…' : 'Ready'}
            </div>
          </div>

          <div className="avatar-assistant-preview">{preview}{preview.length >= 72 ? '…' : ''}</div>

          <div className="avatar-assistant-messages">
            {turns.length === 0 ? (
              <p className="avatar-assistant-empty">
                Hi {user.name?.split(' ')[0] ?? 'there'}! I answer from your uploaded documents and can open app
                screens. Try voice or type below.
              </p>
            ) : (
              turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`avatar-assistant-bubble avatar-assistant-bubble-${turn.role}`}
                >
                  {turn.role === 'assistant' ? (
                    <>
                      <ChatMarkdown content={turn.content} />
                      {turn.citations && turn.citations.length > 0 ? (
                        <div className="avatar-assistant-citations">
                          <div className="avatar-assistant-citations-title">
                            Verified Sources ({turn.citations.length})
                          </div>
                          {turn.citations.map((c, i) => (
                            <div key={`${c.documentId}-${c.chunkIndex}`} className="avatar-assistant-citation-card">
                              <span className="avatar-assistant-citation-pill">[{i + 1}]</span>
                              <strong>{c.title}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    turn.content
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="avatar-assistant-quick">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="avatar-assistant-chip"
                disabled={busy}
                onClick={() => void runMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          {error ? <p className="avatar-assistant-error">{error}</p> : null}

          <form className="avatar-assistant-form" onSubmit={(e) => void handleSubmit(e)}>
            <input
              className="avatar-assistant-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={listening ? 'Listening…' : 'Ask or say "open documents"…'}
              disabled={busy || listening}
            />
            {isSpeechRecognitionSupported() ? (
              <button
                type="button"
                className={`avatar-assistant-mic ${listening ? 'active' : ''}`}
                onClick={() => void handleMic()}
                disabled={busy}
                title="Voice input"
              >
                🎤
              </button>
            ) : null}
            <button type="submit" className="avatar-assistant-send" disabled={busy || !message.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <style jsx global>{`
        .avatar-assistant-fab {
          position: fixed;
          right: 1.25rem;
          bottom: 1.25rem;
          z-index: 60;
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.65rem 1rem 0.65rem 0.75rem;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.45);
        }

        .avatar-assistant-fab-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 2px solid rgba(56, 189, 248, 0.55);
          animation: avatarPulse 2s ease-out infinite;
        }

        .avatar-assistant-fab-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .avatar-assistant-panel {
          position: fixed;
          right: 1rem;
          bottom: 1rem;
          z-index: 60;
          width: min(400px, calc(100vw - 1.5rem));
          max-height: min(720px, calc(100vh - 2rem));
          display: flex;
          flex-direction: column;
          border-radius: 18px;
          overflow: hidden;
          background: var(--card, #fff);
          border: 1px solid var(--border, #e2e8f0);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
        }

        .avatar-assistant-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border, #e2e8f0);
          background: var(--bg-soft, #f8fafc);
        }

        .avatar-assistant-title {
          font-weight: 800;
          font-size: 1rem;
          color: var(--text, #0f172a);
        }

        .avatar-assistant-subtitle {
          font-size: 0.72rem;
          color: var(--muted, #64748b);
          margin-top: 0.15rem;
        }

        .avatar-assistant-header-actions {
          display: flex;
          gap: 0.35rem;
        }

        .avatar-assistant-icon-btn {
          border: 1px solid var(--border, #e2e8f0);
          background: var(--card, #fff);
          border-radius: 8px;
          width: 2rem;
          height: 2rem;
          cursor: pointer;
        }

        .avatar-assistant-scene-wrap {
          position: relative;
          height: 200px;
        }

        .avatar-assistant-scene-loading {
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          color: #94a3b8;
          font-size: 0.85rem;
        }

        .avatar-assistant-status-pill {
          position: absolute;
          left: 0.75rem;
          bottom: 0.65rem;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 700;
          background: rgba(15, 23, 42, 0.72);
          color: #e2e8f0;
        }

        .avatar-assistant-preview {
          padding: 0.55rem 1rem;
          font-size: 0.78rem;
          color: var(--muted, #64748b);
          border-bottom: 1px solid var(--border, #e2e8f0);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .avatar-assistant-messages {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem 1rem;
          display: grid;
          gap: 0.5rem;
          min-height: 120px;
          max-height: 200px;
        }

        .avatar-assistant-empty {
          margin: 0;
          font-size: 0.82rem;
          color: var(--muted, #64748b);
          line-height: 1.45;
        }

        .avatar-assistant-bubble {
          padding: 0.55rem 0.7rem;
          border-radius: 12px;
          font-size: 0.82rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        .avatar-assistant-bubble-user {
          background: #dbeafe;
          color: #1e3a8a;
          margin-left: 1.5rem;
        }

        .avatar-assistant-bubble-assistant {
          background: var(--bg-soft, #f1f5f9);
          color: var(--text, #0f172a);
          margin-right: 0.25rem;
        }

        .avatar-assistant-citations {
          margin-top: 0.65rem;
          padding-top: 0.55rem;
          border-top: 1px solid var(--border, #e2e8f0);
        }

        .avatar-assistant-citations-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--muted, #64748b);
          margin-bottom: 0.35rem;
        }

        .avatar-assistant-citation-card {
          font-size: 0.72rem;
          color: var(--text, #334155);
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .avatar-assistant-citation-pill {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.05rem 0.35rem;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.12);
          color: #2563eb;
        }

        .avatar-assistant-quick {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          padding: 0 1rem 0.5rem;
        }

        .avatar-assistant-chip {
          border: 1px solid var(--border, #e2e8f0);
          background: var(--card, #fff);
          border-radius: 999px;
          padding: 0.25rem 0.55rem;
          font-size: 0.68rem;
          cursor: pointer;
          color: var(--text, #334155);
        }

        .avatar-assistant-chip:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .avatar-assistant-error {
          margin: 0 1rem 0.5rem;
          font-size: 0.75rem;
          color: #dc2626;
        }

        .avatar-assistant-form {
          display: flex;
          gap: 0.4rem;
          padding: 0.75rem 1rem 1rem;
          border-top: 1px solid var(--border, #e2e8f0);
        }

        .avatar-assistant-input {
          flex: 1;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 10px;
          padding: 0.55rem 0.7rem;
          font-size: 0.85rem;
          background: var(--card, #fff);
          color: var(--text, #0f172a);
        }

        .avatar-assistant-mic,
        .avatar-assistant-send {
          border: none;
          border-radius: 10px;
          padding: 0.55rem 0.7rem;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.82rem;
        }

        .avatar-assistant-mic {
          background: #f1f5f9;
        }

        .avatar-assistant-mic.active {
          background: #fecaca;
        }

        .avatar-assistant-send {
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          color: #fff;
        }

        .avatar-assistant-send:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @keyframes avatarPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.15); opacity: 0; }
        }

        @media (max-width: 768px) {
          .avatar-assistant-panel {
            right: 0.5rem;
            left: 0.5rem;
            width: auto;
            bottom: 0.5rem;
          }

          .avatar-assistant-fab-label {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
