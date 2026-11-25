import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ChooseSubclassModal from './ChooseSubclassModal';
import { getSubclassesByClass } from '../services/dataService';

const barbarian2014 = getSubclassesByClass('barbarian', '2014');

describe('ChooseSubclassModal', () => {
  afterEach(cleanup);

  it('opens on the subclass the player clicked, with a way to compare the rest', () => {
    render(
      <ChooseSubclassModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        subclasses={barbarian2014}
        characterClass="Barbarian"
        classSlug="barbarian"
        edition="2014"
        focusSlug="berserker"
      />,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Berserker');
    expect(screen.queryByText('Zealot')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Compare all Barbarian subclasses' }));
    expect(screen.getByText('Zealot')).toBeTruthy();
  });

  it('shows SRD feature text for a core subclass with no curated entry', () => {
    render(
      <ChooseSubclassModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        subclasses={barbarian2014}
        characterClass="Barbarian"
        classSlug="barbarian"
        edition="2014"
        focusSlug="berserker"
      />,
    );

    expect(screen.getByText('Frenzy')).toBeTruthy();
    expect(screen.getByText(/you can go into a frenzy when you rage/)).toBeTruthy();
  });

  it('lists 2024 SRD feature names without borrowing 2014 rules text', () => {
    render(
      <ChooseSubclassModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        subclasses={getSubclassesByClass('barbarian', '2024')}
        characterClass="Barbarian"
        classSlug="barbarian"
        edition="2024"
        focusSlug="berserker"
      />,
    );

    expect(screen.getByText('Frenzy')).toBeTruthy();
    expect(screen.queryByText(/you can go into a frenzy when you rage/)).toBeNull();
  });
});
