import type { ReactNode } from 'react'
import { highlightSegments } from '@/lib/highlight'

/**
 * Renders a search highlight fragment without ever parsing it as HTML: only
 * the highlighter's `<em>`/`<mark>` markers (and optional `terms`) become
 * `<mark>` elements; everything else is escaped text. See `@/lib/highlight`.
 */
export function HighlightedText({ text, terms }: { text: string; terms?: readonly string[] }): ReactNode {
  return (
    <>
      {highlightSegments(text, terms).map((segment, index) =>
        segment.highlighted ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
      )}
    </>
  )
}
