import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntityCard } from './EntityCard'
import { QualityBadge } from './QualityBadge'
import { qualityLevel } from './quality'
import { gorgonEvent } from './__fixtures__'
import type { ExtractedEntityPayload } from './types'

afterEach(() => cleanup())

const gorgon = gorgonEvent().payload as unknown as ExtractedEntityPayload

describe('EntityCard', () => {
  it('renders a monster stat card with stat pills and ability modifiers', () => {
    render(<EntityCard entity={gorgon} />)
    const card = screen.getByRole('article', { name: 'monster Gorgon' })
    expect(card.textContent).toContain('Large monstrosity, unaligned')
    expect(card.textContent).toContain('19')
    expect(card.textContent).toContain('114 (12d10 + 48)')
    expect(card.textContent).toContain('5 (1,800 XP)')
    const abilities = within(card).getByLabelText('Ability scores')
    expect(abilities.textContent).toContain('20 (+5)')
    expect(abilities.textContent).toContain('2 (−4)')
    expect(card.textContent).toContain('Gore · Hooves · Petrifying Breath')
    expect(card.textContent).toContain('All values grounded · 95%')
  })

  it('lists review reasons for a flagged entity', () => {
    const flagged = { ...gorgon, review: { status: 'needs_review' as const, confidence: 0.3, reasons: ['ungrounded:hitPoints=126'] } }
    render(<EntityCard entity={flagged} />)
    expect(screen.getByText(/Needs review · 30%/)).toBeTruthy()
    expect(within(screen.getByLabelText('Review reasons')).getByText('ungrounded:hitPoints=126')).toBeTruthy()
  })

  it('renders spell and item cards', () => {
    render(
      <>
        <EntityCard
          entity={{ ...gorgon, type: 'spell', name: 'Fire Bolt', summary: { level: 0, school: 'evocation', castingTime: '1 action', range: '120 feet', components: 'V, S', duration: 'Instantaneous' } }}
        />
        <EntityCard entity={{ ...gorgon, type: 'item', name: 'Bag of Holding', summary: { itemType: 'Wondrous item', rarity: 'uncommon', requiresAttunement: false } }} />
      </>
    )
    expect(screen.getByRole('article', { name: 'spell Fire Bolt' }).textContent).toContain('Cantrip')
    expect(screen.getByRole('article', { name: 'item Bag of Holding' }).textContent).toContain('uncommon')
  })

  it('highlights a new card, unless the viewer prefers reduced motion', () => {
    const { rerender } = render(<EntityCard entity={gorgon} isNew reducedMotion={false} />)
    expect(screen.getByRole('article').className).toContain('animate-pulse')
    rerender(<EntityCard entity={gorgon} isNew reducedMotion />)
    expect(screen.getByRole('article').className).not.toContain('animate-pulse')
  })

  it('asks the canvas to show the source region', () => {
    const onShowSource = vi.fn()
    render(<EntityCard entity={gorgon} onShowSource={onShowSource} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show source' }))
    expect(onShowSource).toHaveBeenCalledWith(gorgon)
  })
})

describe('QualityBadge', () => {
  it('names the level in text and links pages to check', () => {
    const onSelect = vi.fn()
    render(<QualityBadge value={0.88} lowPages={[7, 19]} onSelectPage={onSelect} />)
    expect(screen.getByText('Text cleanliness: 88.0% (noisy)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'p.19' }))
    expect(onSelect).toHaveBeenCalledWith(19)
  })

  it('maps values to levels', () => {
    expect([qualityLevel(0.97), qualityLevel(0.92), qualityLevel(0.5), qualityLevel(undefined)]).toEqual(['good', 'warn', 'fail', 'unknown'])
  })
})
