// Tiny markdown renderer — handles the subset Claude uses in chat replies:
//   - # / ## / ### headings
//   - **bold**, *italic* / _italic_, `code`
//   - - / * bullet lists, 1. numbered lists
//   - > blockquote
//   - blank lines as paragraph breaks
// Deliberately small, no dependency. Not safe for arbitrary user-submitted
// markdown (no link sanitization), so we use it only for assistant output
// that comes from our own Edge Function.

import { Fragment } from 'react';

// Split a text line into spans, applying inline styles.
function renderInline(text, keyPrefix = '') {
  const parts = [];
  let i = 0;
  let buf = '';
  let key = 0;

  const flushBuf = () => {
    if (buf) {
      parts.push(<Fragment key={`${keyPrefix}t${key++}`}>{buf}</Fragment>);
      buf = '';
    }
  };

  while (i < text.length) {
    const c = text[i];
    const c2 = text.slice(i, i + 2);

    // **bold**
    if (c2 === '**') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flushBuf();
        parts.push(
          <strong key={`${keyPrefix}b${key++}`} className="font-semibold text-ink-900">
            {renderInline(text.slice(i + 2, end), `${keyPrefix}b${key}_`)}
          </strong>
        );
        i = end + 2;
        continue;
      }
    }

    // *italic* or _italic_
    if ((c === '*' || c === '_') && text[i + 1] !== c) {
      const end = text.indexOf(c, i + 1);
      if (end !== -1 && end > i + 1) {
        flushBuf();
        parts.push(
          <em key={`${keyPrefix}i${key++}`} className="italic">
            {text.slice(i + 1, end)}
          </em>
        );
        i = end + 1;
        continue;
      }
    }

    // `code`
    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flushBuf();
        parts.push(
          <code
            key={`${keyPrefix}c${key++}`}
            className="px-1 py-0.5 bg-surface-200 rounded text-xs font-mono text-coral-700"
          >
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }

    buf += c;
    i++;
  }
  flushBuf();
  return parts;
}

export function Markdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  let listKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line — collapse multiples.
    if (!trimmed) {
      blocks.push(<div key={`gap${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      const sizeClass = level === 1
        ? 'text-base font-display font-bold text-ink-900 mt-1 mb-1'
        : level === 2
          ? 'text-sm font-display font-bold text-ink-900 mt-1 mb-0.5'
          : 'text-sm font-semibold text-ink-900 mt-0.5 mb-0.5';
      blocks.push(
        <Tag key={`h${i}`} className={sizeClass}>
          {renderInline(headingMatch[2], `h${i}_`)}
        </Tag>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`q${i}`}
          className="border-l-2 border-coral-500/40 pl-3 my-1 text-sage-700 italic"
        >
          {renderInline(items.join(' '), `q${i}_`)}
        </blockquote>
      );
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      const lk = listKey++;
      blocks.push(
        <ul key={`ul${lk}`} className="space-y-0.5 my-1 ml-1">
          {items.map((it, idx) => (
            <li key={`ul${lk}_${idx}`} className="flex gap-2">
              <span className="text-coral-500 mt-0.5">•</span>
              <span className="flex-1">{renderInline(it, `ul${lk}_${idx}_`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      const lk = listKey++;
      blocks.push(
        <ol key={`ol${lk}`} className="space-y-0.5 my-1 ml-1 list-decimal list-inside marker:text-coral-500">
          {items.map((it, idx) => (
            <li key={`ol${lk}_${idx}`}>
              {renderInline(it, `ol${lk}_${idx}_`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph — group consecutive non-special lines.
    const paraLines = [line];
    i++;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (/^(#{1,3})\s+/.test(t)) break;
      if (/^[-*]\s+/.test(t)) break;
      if (/^\d+\.\s+/.test(t)) break;
      if (t.startsWith('> ')) break;
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p${i}`} className="leading-relaxed">
        {renderInline(paraLines.join(' '), `p${i}_`)}
      </p>
    );
  }

  return <>{blocks}</>;
}
