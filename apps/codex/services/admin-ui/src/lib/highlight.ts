/**
 * Safe parsing for search highlights.
 *
 * Elasticsearch highlight fragments wrap matches in `<em>...</em>` (the
 * default tags) but do not HTML-escape the document text around them, so a
 * fragment can carry arbitrary markup from an uploaded document. Nothing here
 * is ever parsed as HTML: the exact marker tags `<em>`, `</em>`, `<mark>` and
 * `</mark>` become highlight boundaries, and every other character (including
 * any other tag) is rendered as text, which React escapes.
 */

export interface HighlightSegment {
  text: string
  highlighted: boolean
}

const MARKER = /<(\/?)(em|mark)>/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Splits `text` on highlighter markers, then marks case-insensitive `terms` in the plain parts. */
export function highlightSegments(text: string, terms: readonly string[] = []): HighlightSegment[] {
  const marked: HighlightSegment[] = []
  let depth = 0
  let last = 0
  for (const match of text.matchAll(MARKER)) {
    const index = match.index ?? 0
    if (index > last) marked.push({ text: text.slice(last, index), highlighted: depth > 0 })
    depth = match[1] ? Math.max(0, depth - 1) : depth + 1
    last = index + match[0].length
  }
  if (last < text.length) marked.push({ text: text.slice(last), highlighted: depth > 0 })

  const usable = terms.map((term) => term.trim()).filter((term) => term.length > 0)
  const pattern = usable.length > 0 ? new RegExp(`(${usable.map(escapeRegExp).join('|')})`, 'gi') : null

  const segments: HighlightSegment[] = []
  const push = (segment: HighlightSegment) => {
    if (segment.text.length === 0) return
    const previous = segments[segments.length - 1]
    if (previous && previous.highlighted === segment.highlighted) previous.text += segment.text
    else segments.push({ ...segment })
  }
  for (const segment of marked) {
    if (segment.highlighted || !pattern) {
      push(segment)
      continue
    }
    // With a capturing group, odd indexes are the matched terms.
    segment.text.split(pattern).forEach((part, index) => push({ text: part, highlighted: index % 2 === 1 }))
  }
  return segments
}
