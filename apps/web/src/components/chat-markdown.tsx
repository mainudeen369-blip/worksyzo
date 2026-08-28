'use client';

import React from 'react';

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  // Split content into blocks by double newlines or single newlines depending on structure
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  
  let currentList: string[] = [];
  let isNumberedList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  function flushList() {
    if (currentList.length === 0) return;
    if (isNumberedList) {
      elements.push(
        <ol key={`ol-${elements.length}`} style={{ margin: '0.6rem 0', paddingLeft: '1.4rem', display: 'grid', gap: '0.4rem' }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ lineHeight: 1.6, color: 'var(--text)' }}>
              {renderInlineFormatted(item)}
            </li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '0.6rem 0', paddingLeft: '1.25rem', display: 'grid', gap: '0.4rem' }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ lineHeight: 1.6, color: 'var(--text)' }}>
              {renderInlineFormatted(item)}
            </li>
          ))}
        </ul>
      );
    }
    currentList = [];
    isNumberedList = false;
  }

  function flushCodeBlock() {
    if (codeBlockContent.length === 0) return;
    elements.push(
      <pre
        key={`code-${elements.length}`}
        style={{
          background: 'var(--bg-soft)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.75rem 1rem',
          overflowX: 'auto',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          margin: '0.6rem 0',
          color: 'var(--text)',
        }}
      >
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    );
    codeBlockContent = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    // Check code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // Check headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${i}`} style={{ margin: '0.8rem 0 0.3rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
          {renderInlineFormatted(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} style={{ margin: '1rem 0 0.4rem', fontSize: '1.15rem', fontWeight: 750, color: 'var(--text)' }}>
          {renderInlineFormatted(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} style={{ margin: '1.1rem 0 0.5rem', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>
          {renderInlineFormatted(trimmed.replace(/^#\s+/, ''))}
        </h2>
      );
      continue;
    }

    // Bullet points: • or - or *
    const bulletMatch = rawLine.match(/^(\s*)([•\-\*])\s+(.+)$/);
    if (bulletMatch && bulletMatch[3]) {
      if (isNumberedList) flushList();
      currentList.push(bulletMatch[3]);
      continue;
    }

    // Numbered lists: 1. or 2.
    const numMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numMatch && numMatch[3]) {
      if (!isNumberedList && currentList.length > 0) flushList();
      isNumberedList = true;
      currentList.push(numMatch[3]);
      continue;
    }

    // Normal line or empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // If it's a footnote note like *(Answer synthesized...)*
    if (trimmed.startsWith('*(') && trimmed.endsWith(')*')) {
      flushList();
      elements.push(
        <div
          key={`note-${i}`}
          style={{
            margin: '0.75rem 0',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-soft)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 6,
            fontSize: '0.78rem',
            color: 'var(--muted)',
            fontStyle: 'italic',
          }}
        >
          {trimmed.slice(2, -2)}
        </div>
      );
      continue;
    }

    // If we were inside a list and encountered non-list text
    flushList();
    elements.push(
      <p key={`p-${i}`} style={{ margin: '0.45rem 0', lineHeight: 1.6, color: 'var(--text)' }}>
        {renderInlineFormatted(trimmed)}
      </p>
    );
  }

  flushList();
  flushCodeBlock();

  return <div className="chat-markdown-body">{elements}</div>;
}

/** Helper to parse inline markdown tags like **bold**, `code`, and [#1] citations */
function renderInlineFormatted(text: string): React.ReactNode[] {
  // Regex splitting by bold (**...**), inline code (`...`), citations ([#1], [1]), etc.
  const regex = /(\*\*.*?\*\*|`.*?`|\[#?\d+\])/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold text **...**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} style={{ fontWeight: 700, color: 'var(--text)' }}>
          {renderCitationHighlights(inner)}
        </strong>
      );
    }

    // Inline code `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          style={{
            background: 'var(--bg-soft)',
            border: '1px solid var(--border)',
            padding: '0.1rem 0.35rem',
            borderRadius: 4,
            fontSize: '0.85em',
            fontFamily: 'monospace',
            color: 'var(--accent)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Citation badge [#1] or [1]
    if (/^\[#?\d+\]$/.test(part)) {
      return (
        <span
          key={index}
          style={{
            display: 'inline-block',
            margin: '0 0.2rem',
            padding: '0.05rem 0.4rem',
            borderRadius: 999,
            background: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--accent)',
            fontSize: '0.72rem',
            fontWeight: 700,
            border: '1px solid rgba(37, 99, 235, 0.25)',
            verticalAlign: 'baseline',
          }}
        >
          {part}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function renderCitationHighlights(text: string): React.ReactNode {
  const match = text.match(/^(\[#?\d+\]\s*)(.*)$/);
  if (match && match[1] && match[2]) {
    return (
      <>
        <span
          style={{
            display: 'inline-block',
            marginRight: '0.35rem',
            padding: '0.05rem 0.4rem',
            borderRadius: 999,
            background: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--accent)',
            fontSize: '0.75rem',
            fontWeight: 700,
            border: '1px solid rgba(37, 99, 235, 0.25)',
          }}
        >
          {match[1].trim()}
        </span>
        {match[2]}
      </>
    );
  }
  return text;
}
