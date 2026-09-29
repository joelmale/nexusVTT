import { LayoutPage } from '../types/layout';

const HEADING = /^ {0,3}#{1,6}\s+\S/;
const FENCE = /^ {0,3}(```|~~~)/;

/**
 * Markdown uploads have no physical pages. As in v1 (pageCount = heading
 * count), each ATX heading starts a new "page"; text before the first heading
 * belongs to page 1. Fenced code is never split.
 */
export const splitMarkdownPages = (markdown: string): LayoutPage[] => {
  const sections: string[][] = [[]];
  let inFence = false;

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const current = sections[sections.length - 1];
    if (!inFence && HEADING.test(line) && current.some((l) => l.trim())) {
      sections.push([line]);
    } else {
      current.push(line);
    }
  }

  return sections
    .map((lines) => lines.join('\n').trim())
    .filter(Boolean)
    .map((text, index) => ({
      pageNumber: index + 1,
      markdown: text,
      blocks: [
        {
          id: `p${index + 1}-b0`,
          class: 'body' as const,
          markerType: 'MarkdownSection',
          bbox: [0, 0, 1, 1] as [number, number, number, number],
          markdown: text,
        },
      ],
    }));
};
