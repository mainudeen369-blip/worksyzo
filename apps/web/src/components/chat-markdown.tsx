'use client';

import React from 'react';

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  // Normalize newlines and trim
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
            margin: '0.85rem 0',
            paddingLeft: '1.5rem',
            display: 'grid',
            gap: '0.55rem',
            lineHeight: 1.65,
          }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ color: 'var(--text)', fontSize: '0.94rem' }}>
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
            margin: '0.85rem 0',
            paddingLeft: '1.25rem',
            display: 'grid',
            gap: '0.65rem',
            listStyleType: 'none',
          }}
        >
          {listItems.map((item, idx) => (
            <li
              key={idx}
              style={{
                position: 'relative',
                paddingLeft: '1.2rem',
                color: 'var(--text)',
                lineHeight: 1.65,
                fontSize: '0.94rem',
              }}
            >
              {/* Custom stylish bullet marker */}
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '0.58em',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'inline-block',
                }}
              />
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
      <pre
        key={`code-${elements.length}`}
        style={{
          background: 'var(--bg-soft)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '0.85rem 1.1rem',
          overflowX: 'auto',
          fontSize: '0.86rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          margin: '0.85rem 0',
          color: 'var(--text)',
          lineHeight: 1.5,
        }}
      >
        <code>{code}</code>
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

    // Check Headings ####
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4
          key={`h4-${i}`}
          style={{
            margin: '1.2rem 0 0.45rem',
            fontSize: '0.98rem',
            fontWeight: 750,
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
            margin: '1.35rem 0 0.55rem',
            fontSize: '1.12rem',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
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
            margin: '1.45rem 0 0.65rem',
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

    // Italic note / Footnote
    if (trimmed.startsWith('*(') && trimmed.endsWith(')*')) {
      flushList();
      elements.push(
        <div
          key={`note-${i}`}
          style={{
            margin: '1rem 0 0.4rem',
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

    // Paragraph
    flushList();
    elements.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '0.65rem 0',
          lineHeight: 1.7,
          fontSize: '0.94rem',
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
        fontSize: '0.94rem',
        lineHeight: 1.7,
        letterSpacing: '-0.01em',
        color: 'var(--text)',
      }}
    >
      {elements}
    </div>
  );
}

/** Helper to parse inline markdown formatting: **bold**, `code`, and [#1] citations */
function renderInlineFormatted(text: string): React.ReactNode[] {
  // Regex splitting by bold (**...**), inline code (`...`), and citations ([#1], [1], [#12])
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
