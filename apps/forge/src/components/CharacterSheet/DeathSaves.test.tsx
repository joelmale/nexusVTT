import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DeathSaves } from './DeathSaves';
import type { Character } from '../../types/dnd';

const character = (deathSaves?: { successes: number; failures: number }) =>
  ({ id: 'c1', name: 'Test', deathSaves }) as unknown as Character;

describe('DeathSaves', () => {
  it('fills a success up to the clicked circle', () => {
    const onUpdate = vi.fn();
    render(<DeathSaves character={character()} onUpdateCharacter={onUpdate} />);
    fireEvent.click(screen.getByTitle('Success 2'));
    expect(onUpdate.mock.calls[0][0].deathSaves).toEqual({
      successes: 2,
      failures: 0,
    });
  });

  it('clicking a filled circle reduces the count to that position', () => {
    const onUpdate = vi.fn();
    render(
      <DeathSaves
        character={character({ successes: 3, failures: 2 })}
        onUpdateCharacter={onUpdate}
      />,
    );
    fireEvent.click(screen.getByTitle('Success 2'));
    expect(onUpdate.mock.calls[0][0].deathSaves).toEqual({
      successes: 1,
      failures: 2,
    });
    fireEvent.click(screen.getByTitle('Failure 1'));
    expect(onUpdate.mock.calls[1][0].deathSaves).toEqual({
      successes: 3,
      failures: 0,
    });
  });

  it('fills failures and keeps successes unchanged', () => {
    const onUpdate = vi.fn();
    render(
      <DeathSaves
        character={character({ successes: 1, failures: 0 })}
        onUpdateCharacter={onUpdate}
      />,
    );
    fireEvent.click(screen.getByTitle('Failure 3'));
    expect(onUpdate.mock.calls[0][0].deathSaves).toEqual({
      successes: 1,
      failures: 3,
    });
  });

  it('resets both tracks', () => {
    const onUpdate = vi.fn();
    render(
      <DeathSaves
        character={character({ successes: 2, failures: 2 })}
        onUpdateCharacter={onUpdate}
      />,
    );
    fireEvent.click(screen.getByTitle('Reset death saves'));
    expect(onUpdate.mock.calls[0][0].deathSaves).toEqual({
      successes: 0,
      failures: 0,
    });
  });

  it('renders in each layout mode', () => {
    for (const layoutMode of [
      'paper-sheet',
      'classic-dnd',
      'modern',
    ] as const) {
      const { unmount } = render(
        <DeathSaves
          character={character()}
          onUpdateCharacter={vi.fn()}
          layoutMode={layoutMode}
        />,
      );
      expect(screen.getByText('Death Saves')).toBeTruthy();
      unmount();
    }
  });
});
