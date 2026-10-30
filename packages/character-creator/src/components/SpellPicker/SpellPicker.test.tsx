import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpellPicker, filterSpells } from './SpellPicker';
import type { AppSpell } from '../../services/dataService';

const spell = (slug: string, name: string, school: string, level = 1) =>
  ({
    slug,
    name,
    school,
    level,
    castingTime: '1 action',
    range: '60 feet',
    concentration: false,
    ritual: false,
    description: `${name} text`,
  }) as unknown as AppSpell;

const SPELLS = [
  spell('magic-missile', 'Magic Missile', 'Evocation'),
  spell('shield', 'Shield', 'Abjuration'),
  spell('fireball', 'Fireball', 'Evocation', 3),
];

describe('filterSpells', () => {
  it('matches names case-insensitively and by school', () => {
    expect(filterSpells(SPELLS, 'FIRE', '').map((s) => s.slug)).toEqual([
      'fireball',
    ]);
    expect(filterSpells(SPELLS, '', 'Abjuration').map((s) => s.slug)).toEqual([
      'shield',
    ]);
    expect(filterSpells(SPELLS, 'missile', 'Abjuration')).toEqual([]);
  });
});

describe('SpellPicker', () => {
  afterEach(cleanup);

  const setup = (selected: string[], max: number) => {
    const onToggle = vi.fn();
    render(
      <SpellPicker
        title="Spells"
        spells={SPELLS}
        selected={selected}
        max={max}
        onToggle={onToggle}
        onDetails={() => {}}
        groupByLevel
      />,
    );
    return onToggle;
  };

  it('shows the count and toggles a spell', () => {
    const onToggle = setup([], 2);
    expect(screen.getByRole('status').textContent).toBe('0 / 2 chosen');
    fireEvent.click(screen.getByRole('button', { name: /^Shield/ }));
    expect(onToggle).toHaveBeenCalledWith('shield');
  });

  it('disables unchosen spells at the limit but keeps chosen ones removable', () => {
    setup(['shield'], 1);
    const fireball = screen.getByRole('button', { name: /^Fireball/ });
    expect((fireball as HTMLButtonElement).disabled).toBe(true);
    const chosen = screen.getAllByRole('button', { name: /^Shield/ })[0];
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    expect((chosen as HTMLButtonElement).disabled).toBe(false);
  });

  it('filters by the search box', () => {
    setup([], 3);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'fire' },
    });
    expect(screen.queryByRole('button', { name: /^Shield/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Fireball/ })).toBeTruthy();
  });
});
