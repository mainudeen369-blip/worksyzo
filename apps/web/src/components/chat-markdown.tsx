'use client';

import React, { useState } from 'react';

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: string[] = [];
  let isNumberedList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  function flushList() {
    if (currentList.length === 0) return;
    const listItems = [...currentList];
    const isNumbered = isNumberedList;
    currentList = [];
    isNumberedList = false;

    if (isNumbered) {
      elements.push(
        <ol
          key={`ol-${elements.length}`}
          style={{
            margin: '0.65rem 0 0.9rem',
            paddingLeft: '1.4rem',
            display: 'grid',
            gap: '0.45rem',
            lineHeight: 1.65,
          }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
              {renderInlineFormatted(item)}
            </li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul
          key={`ul-${elements.length}`}
          style={{
            margin: '0.65rem 0 0.9rem',
            paddingLeft: '1.25rem',
            display: 'grid',
            gap: '0.5rem',
            listStyleType: 'disc',
          }}
        >
          {listItems.map((item, idx) => (
            <li
              key={idx}
              style={{
                color: 'var(--text)',
                lineHeight: 1.65,
                fontSize: '0.95rem',
              }}
            >
              {renderInlineFormatted(item)}
            </li>
          ))}
        </ul>
      );
    }
  }

  function flushCodeBlock() {
    if (codeBlockContent.length === 0) return;
    const code = codeBlockContent.join('\n');
    elements.push(
      <CodeCalloutCard key={`code-${elements.length}`} code={code} />
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

    // Check Headings ####
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4
          key={`h4-${i}`}
          style={{
            margin: '1.15rem 0 0.4rem',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            flexWrap: 'wrap',
          }}
        >
          {renderInlineFormatted(trimmed.replace(/^####\s+/, ''))}
        </h4>
      );
      continue;
    }

    // Check Headings ###
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3
          key={`h3-${i}`}
          style={{
            margin: '1.35rem 0 0.5rem',
            fontSize: '1.15rem',
            fontWeight: 750,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            flexWrap: 'wrap',
          }}
        >
          {renderInlineFormatted(trimmed.replace(/^###\s+/, ''))}
        </h3>
      );
      continue;
    }

    // Check Headings ## / #
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2
          key={`h2-${i}`}
          style={{
            margin: '1.5rem 0 0.6rem',
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.025em',
          }}
        >
          {renderInlineFormatted(trimmed.replace(/^#+\s+/, ''))}
        </h2>
      );
      continue;
    }

    // Bullet points: • or - or * or ✓
    const bulletMatch = rawLine.match(/^(\s*)([•\-\*✓])\s+(.+)$/);
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

    // Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Italic footnote
    if (trimmed.startsWith('*(') && trimmed.endsWith(')*')) {
      flushList();
      elements.push(
        <div
          key={`note-${i}`}
          style={{
            margin: '1.1rem 0 0.4rem',
            padding: '0.6rem 0.85rem',
            background: 'var(--bg-soft)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 8,
            fontSize: '0.8rem',
            color: 'var(--muted)',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          {trimmed.slice(2, -2)}
        </div>
      );
      continue;
    }

    // Normal Paragraph
    flushList();
    elements.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '0.65rem 0',
          lineHeight: 1.7,
          fontSize: '0.95rem',
          color: 'var(--text)',
        }}
      >
        {renderInlineFormatted(trimmed)}
      </p>
    );
  }

  flushList();
  flushCodeBlock();

  return (
    <div
      className="chat-markdown-body"
      style={{
        fontSize: '0.95rem',
        lineHeight: 1.7,
        letterSpacing: '-0.01em',
        color: 'var(--text)',
      }}
    >
      {elements}
    </div>
  );
}

/** Callout card for code or templates (like ChatGPT's prompt response card) */
function CodeCalloutCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        margin: '1rem 0',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Top Header Bar with Edit / Copy buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 0.85rem',
          background: 'rgba(0, 0, 0, 0.03)',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.78rem',
          color: 'var(--muted)',
        }}
      >
        <span style={{ fontWeight: 600 }}>Preview / Template</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.4rem',
            borderRadius: 6,
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>

      <pre
        style={{
          margin: 0,
          padding: '0.85rem 1rem',
          overflowX: 'auto',
          fontSize: '0.88rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          color: 'var(--text)',
          lineHeight: 1.55,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Helper to parse inline markdown formatting: **bold**, `code`, and [#1] citations */
function renderInlineFormatted(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|`.*?`|\[#?\d+\])/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold text **...**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong
          key={index}
          style={{
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
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
            padding: '0.12rem 0.4rem',
            borderRadius: 5,
            fontSize: '0.86em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            color: 'var(--accent)',
            fontWeight: 600,
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
            display: 'inline-flex',
            alignItems: 'center',
            margin: '0 0.25rem',
            padding: '0.08rem 0.45rem',
            borderRadius: '999px',
            background: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--accent)',
            fontSize: '0.74rem',
            fontWeight: 800,
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
            display: 'inline-flex',
            alignItems: 'center',
            marginRight: '0.35rem',
            padding: '0.08rem 0.45rem',
            borderRadius: '999px',
            background: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--accent)',
            fontSize: '0.74rem',
            fontWeight: 800,
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
