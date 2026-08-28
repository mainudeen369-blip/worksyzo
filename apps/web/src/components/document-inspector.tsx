'use client';

import { useState } from 'react';
import type { DocumentInspectView } from '@worksyzo/shared';

interface DocumentInspectorProps {
  data: DocumentInspectView | null;
  loading: boolean;
  onClose: () => void;
  onRetry?: (id: string) => void;
}

export function DocumentInspector({ data, loading, onClose, onRetry }: DocumentInspectorProps) {
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullVector, setShowFullVector] = useState(false);

  if (!data && !loading) return null;

  const doc = data?.document;
  const chunks = data?.chunks ?? [];
  const selectedChunk = chunks[activeChunkIndex] || chunks[0];

  // Simple client-side term matching simulation to demonstrate chunk scoring
  const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const chunkScores = chunks.map((c) => {
    if (searchTerms.length === 0) return 0;
    const lower = c.content.toLowerCase();
    let score = 0;
    for (const term of searchTerms) {
      if (lower.includes(term)) {
        score += (lower.match(new RegExp(term, 'g')) || []).length * 0.25;
      }
    }
    return Math.min(1, Number(score.toFixed(3)));
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: 'min(980px, 95vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                }}
              >
                AI Ingestion & Chunk Pipeline
              </span>
              {doc?.status && (
                <span
                  className={`badge ${doc.status === 'ready' ? 'badge-success' : ''}`}
                  style={{ fontSize: '0.72rem' }}
                >
                  Status: {doc.status.toUpperCase()}
                </span>
              )}
            </div>
            <h2 style={{ margin: '0.35rem 0 0', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {doc?.title || 'Loading Document Pipeline…'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {doc?.status === 'failed' && onRetry && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
                onClick={() => onRetry(doc.id)}
              >
                Retry Ingestion
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px' }}
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  margin: '0 auto 1rem',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p className="muted">Fetching chunks and vector embedding telemetry…</p>
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p className="error">Failed to load document ingestion details.</p>
            </div>
          ) : (
            <>
              {/* 4-Stage Ingestion Pipeline Stepper */}
              <div>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
                  Visual Ingestion & Embedding Pipeline
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {data.pipelineStages.map((stage, idx) => {
                    const isDone = stage.status === 'completed';
                    const isInProgress = stage.status === 'in_progress';
                    const isFail = stage.status === 'failed';

                    return (
                      <div
                        key={stage.stage}
                        style={{
                          padding: '1rem',
                          borderRadius: '12px',
                          background: 'var(--bg-soft)',
                          border: isDone
                            ? '1px solid rgba(22, 163, 74, 0.35)'
                            : isInProgress
                            ? '1px solid rgba(37, 99, 235, 0.45)'
                            : isFail
                            ? '1px solid rgba(239, 68, 68, 0.35)'
                            : '1px solid var(--border)',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: isDone ? 'var(--accent-2)' : isInProgress ? 'var(--accent)' : isFail ? 'var(--danger)' : 'var(--muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            Step {idx + 1}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '999px',
                              background: isDone
                                ? 'rgba(34, 197, 94, 0.14)'
                                : isInProgress
                                ? 'rgba(37, 99, 235, 0.14)'
                                : isFail
                                ? 'rgba(239, 68, 68, 0.14)'
                                : 'var(--bg-card)',
                              color: isDone ? 'var(--accent-2)' : isInProgress ? 'var(--accent)' : isFail ? 'var(--danger)' : 'var(--muted)',
                            }}
                          >
                            {stage.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.25rem' }}>
                          {stage.name}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.45 }}>
                          {stage.description}
                        </p>
                        {stage.details && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              fontSize: '0.74rem',
                              fontWeight: 650,
                              color: 'var(--text)',
                              background: 'var(--bg-card)',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {stage.details}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metric KPI Tiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Total Chunks</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.15rem' }}>
                    {data.totalChunks}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Target: ~600 tok/chunk</div>
                </div>

                <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Total Tokens</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)', marginTop: '0.15rem' }}>
                    {data.totalTokens.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>~4 chars/token avg</div>
                </div>

                <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Total Characters</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.15rem' }}>
                    {data.totalCharacters.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Extracted plain text</div>
                </div>

                <div style={{ padding: '0.9rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Embedding Dimensions</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-2)', marginTop: '0.15rem' }}>
                    {data.vectorDimensions}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>pgvector float arrays</div>
                </div>
              </div>

              {/* Chunks Explorer & Text Viewer */}
              {chunks.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '1rem' }}>
                  {/* Left Column: Chunk Selector List & Search Sandbox */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                      Chunks ({chunks.length})
                    </div>

                    {/* Interactive Sandbox Filter */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Filter text in chunks…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '0.45rem 0.65rem',
                          fontSize: '0.82rem',
                          color: 'var(--text)',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        maxHeight: '380px',
                        overflowY: 'auto',
                        paddingRight: '0.25rem',
                      }}
                    >
                      {chunks.map((chunk, idx) => {
                        const isSelected = (selectedChunk?.chunkIndex ?? 0) === chunk.chunkIndex;
                        const score = chunkScores[idx] || 0;

                        return (
                          <button
                            key={chunk.id || idx}
                            type="button"
                            onClick={() => setActiveChunkIndex(idx)}
                            style={{
                              textAlign: 'left',
                              padding: '0.65rem 0.75rem',
                              borderRadius: '10px',
                              background: isSelected ? 'var(--accent-light)' : 'var(--bg-card)',
                              border: isSelected
                                ? '1px solid rgba(37, 99, 235, 0.4)'
                                : '1px solid var(--border)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span style={{ fontWeight: 750, fontSize: '0.82rem', color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                                Chunk #{chunk.chunkIndex + 1}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                {chunk.tokenCount} tokens
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: '0.76rem',
                                color: 'var(--muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {chunk.content.slice(0, 50)}…
                            </div>
                            {score > 0 && (
                              <div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: 'var(--accent-2)', fontWeight: 700 }}>
                                Match Score: {(score * 100).toFixed(0)}%
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Active Chunk Content & Vector Inspection */}
                  {selectedChunk && (
                    <div
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '14px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 750 }}>
                            Chunk #{selectedChunk.chunkIndex + 1} Content
                          </h4>
                          <span className="muted" style={{ fontSize: '0.78rem' }}>
                            {selectedChunk.charCount} characters • {selectedChunk.tokenCount} estimated tokens
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: 'var(--accent-2)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                          }}
                        >
                          Sliding Window with 80-token Overlap
                        </span>
                      </div>

                      {/* Text Excerpt */}
                      <div
                        style={{
                          background: 'var(--bg-soft)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '0.85rem 1rem',
                          fontSize: '0.88rem',
                          lineHeight: 1.6,
                          maxHeight: '220px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          color: 'var(--text)',
                        }}
                      >
                        {selectedChunk.content}
                      </div>

                      {/* 1536-Dimensional Dense Embedding Vector Preview */}
                      <div
                        style={{
                          background: 'var(--bg-soft)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '0.85rem 1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 750, color: 'var(--text)' }}>
                            1536-Dimensional Embedding Vector Preview
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowFullVector(!showFullVector)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {showFullVector ? 'Collapse Preview' : 'Show Vector Floats'}
                          </button>
                        </div>

                        {/* Vector Preview Numbers */}
                        <div
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.74rem',
                            color: 'var(--muted)',
                            background: 'var(--bg-card)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            overflowX: 'auto',
                          }}
                        >
                          [{selectedChunk.embeddingPreview.slice(0, showFullVector ? 15 : 6).map((n) => (n > 0 ? `+${n}` : n)).join(', ')}
                          {selectedChunk.embeddingDimensions > 6 ? `, … +${selectedChunk.embeddingDimensions - (showFullVector ? 15 : 6)} more dimensions]` : ']'}
                        </div>

                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.45 }}>
                          * When you ask a question in Chat, your question is embedded into the same 1536-dim vector space and compared against these chunk vectors using cosine distance (<code style={{ color: 'var(--accent)' }}>&lt;-&gt;</code>) in PostgreSQL.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-soft)', borderRadius: '12px' }}>
                  <p className="muted" style={{ margin: 0 }}>
                    {doc?.status === 'processing'
                      ? 'Document is currently being processed by the ingest worker. Refreshing in a few seconds…'
                      : doc?.status === 'failed'
                      ? `Ingestion failed: ${doc.error || 'Unknown error'}. Click Retry to re-run.`
                      : 'No chunks generated for this file.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
