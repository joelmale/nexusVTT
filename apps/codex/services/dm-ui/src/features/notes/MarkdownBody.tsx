import type { ReactNode } from 'react';

import { splitMentions } from '@/lib/mentions';

import styles from './MarkdownBody.module.css';

type RenderMention = (id: string, label: string) => ReactNode;

/**
 * Inline `**bold**`, `*italic*` and `` `code` ``; everything else is text.
 * `@[Label](ref:id)` mentions go through `renderMention` when provided.
 */
function renderInline(
  text: string,
  keyPrefix: string,
  renderMention?: RenderMention,
): ReactNode[] {
  if (renderMention) {
    return splitMentions(text).flatMap<ReactNode>((segment, at) =>
      segment.type === 'text'
        ? renderFormatting(segment.text, `${keyPrefix}-t${at}`)
        : [
            <span key={`${keyPrefix}-m${at}`}>
              {renderMention(segment.id, segment.label)}
            </span>,
          ],
    );
  }
  return renderFormatting(text, keyPrefix);
}

function renderFormatting(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = start + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlocks(
  source: string,
  renderMention?: RenderMention,
): ReactNode[] {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const out: ReactNode[] = [];
  blocks.forEach((block, blockIndex) => {
    const lines = block.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) return;
    const key = `b${blockIndex}`;
    const bullets = lines.every((line) => /^\s*[-*]\s+/.test(line));
    const numbers = lines.every((line) => /^\s*\d+[.)]\s+/.test(line));
    if (bullets || numbers) {
      const items = lines.map((line, i) => (
        <li key={i}>
          {renderInline(
            line.replace(bullets ? /^\s*[-*]\s+/ : /^\s*\d+[.)]\s+/, ''),
            `${key}-${i}`,
            renderMention,
          )}
        </li>
      ));
      out.push(bullets ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>);
      return;
    }
    const heading = /^#{1,3}\s+(.*)$/.exec(lines[0]);
    if (heading) {
      out.push(
        <p className={styles.heading} key={`${key}-h`}>
          {renderInline(heading[1], `${key}-h`, renderMention)}
        </p>,
      );
      lines.shift();
      if (lines.length === 0) return;
    }
    out.push(
      <p key={key}>
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {renderInline(line, `${key}-${i}`, renderMention)}
          </span>
        ))}
      </p>,
    );
  });
  return out;
}

interface MarkdownBodyProps {
  source: string;
  className?: string;
  /** Renders a `@[Label](ref:id)` mention; without it they stay as text. */
  renderMention?: RenderMention;
}

/**
 * Small, safe markdown subset (paragraphs, line breaks, headings, bullet and
 * numbered lists, bold, italic, code). Output is React text nodes only, so
 * user text can never inject markup.
 */
export function MarkdownBody({
  source,
  className,
  renderMention,
}: MarkdownBodyProps) {
  return (
    <div className={`${styles.body} ${className ?? ''}`}>
      {renderBlocks(source, renderMention)}
    </div>
  );
}
