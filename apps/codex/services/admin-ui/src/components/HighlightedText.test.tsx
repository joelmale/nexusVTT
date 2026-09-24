import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { HighlightedText } from './HighlightedText'
import { highlightSegments } from '@/lib/highlight'

afterEach(() => cleanup())

describe('highlightSegments', () => {
  it('turns the highlighter <em> markers into highlighted segments', () => {
    expect(highlightSegments('cast <em>fireball</em> at <em>range</em>')).toEqual([
      { text: 'cast ', highlighted: false },
      { text: 'fireball', highlighted: true },
      { text: ' at ', highlighted: false },
      { text: 'range', highlighted: true },
    ])
  })

  it('accepts <mark> markers in any case', () => {
    expect(highlightSegments('a <MARK>b</Mark> c')).toEqual([
      { text: 'a ', highlighted: false },
      { text: 'b', highlighted: true },
      { text: ' c', highlighted: false },
    ])
  })

  it('keeps every other tag, attribute and entity as literal text', () => {
    const fragment = '<img src=x onerror=alert(1)><em>hit</em><script>alert(2)</script>&lt;b&gt;<em class="x">no</em>'
    const segments = highlightSegments(fragment)
    expect(segments.map((s) => s.text).join('')).toBe(
      '<img src=x onerror=alert(1)>hit<script>alert(2)</script>&lt;b&gt;<em class="x">no',
    )
    expect(segments.filter((s) => s.highlighted).map((s) => s.text)).toEqual(['hit'])
  })

  it('tolerates unbalanced markers', () => {
    expect(highlightSegments('</em>a<em>b')).toEqual([
      { text: 'a', highlighted: false },
      { text: 'b', highlighted: true },
    ])
  })

  it('marks search terms case-insensitively, treating regex characters literally', () => {
    expect(highlightSegments('Fireball (3rd) and FIREBALL', ['fireball', '(3rd)'])).toEqual([
      { text: 'Fireball', highlighted: true },
      { text: ' ', highlighted: false },
      { text: '(3rd)', highlighted: true },
      { text: ' and ', highlighted: false },
      { text: 'FIREBALL', highlighted: true },
    ])
    expect(highlightSegments('a.b', ['.'])).toEqual([
      { text: 'a', highlighted: false },
      { text: '.', highlighted: true },
      { text: 'b', highlighted: false },
    ])
  })

  it('ignores empty terms', () => {
    expect(highlightSegments('plain', ['', '  '])).toEqual([{ text: 'plain', highlighted: false }])
  })
})

describe('HighlightedText', () => {
  it('renders highlights as <mark> and never creates elements from fragment markup', () => {
    const fragment = '<img src=x onerror="window.__xss=1"><em>goblin</em> <a href="javascript:alert(1)">x</a>'
    const { container } = render(<HighlightedText text={fragment} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('em')).toBeNull()
    expect([...container.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['goblin'])
    expect(container.textContent).toBe('<img src=x onerror="window.__xss=1">goblin <a href="javascript:alert(1)">x</a>')
  })

  it('highlights query terms inside an escaped fragment', () => {
    const { container } = render(<HighlightedText text={'<b>Goblin</b> boss'} terms={['goblin']} />)
    expect(container.querySelector('b')).toBeNull()
    expect([...container.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['Goblin'])
    expect(container.textContent).toBe('<b>Goblin</b> boss')
  })
})
