import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CoinManagement } from './CoinManagement';
import type { Character } from '../../types/dnd';

const character = (currency?: Character['currency']) =>
  ({ id: 'c1', name: 'Test', currency }) as unknown as Character;

describe('CoinManagement actions', () => {
  it('treats a missing purse as empty', () => {
    render(
      <CoinManagement character={character()} onUpdateCharacter={vi.fn()} />,
    );
    expect(screen.getByText('0.00 gp')).toBeTruthy();
  });

  it('adds only the entered coin types', () => {
    const onUpdate = vi.fn();
    render(
      <CoinManagement
        character={character({ cp: 5, sp: 0, gp: 10, pp: 0 })}
        onUpdateCharacter={onUpdate}
      />,
    );
    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(inputs[2], { target: { value: '7' } });
    fireEvent.click(screen.getByText('Add Coins'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].currency.gp).toBe(17);
  });

  it('never removes more than is held', () => {
    const onUpdate = vi.fn();
    render(
      <CoinManagement
        character={character({ cp: 0, sp: 0, gp: 3, pp: 0 })}
        onUpdateCharacter={onUpdate}
      />,
    );
    fireEvent.change(screen.getAllByPlaceholderText('0')[2], {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByText('Remove Coins'));
    expect(onUpdate.mock.calls[0][0].currency.gp).toBe(0);
  });

  it('ignores zero and non-numeric entries', () => {
    const onUpdate = vi.fn();
    render(
      <CoinManagement
        character={character({ cp: 1, sp: 1, gp: 1, pp: 1 })}
        onUpdateCharacter={onUpdate}
      />,
    );
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByText('Add Coins'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('edits coins directly in compact mode and clamps negatives', () => {
    const onUpdate = vi.fn();
    render(
      <CoinManagement
        character={character({ cp: 100, sp: 10, gp: 2, pp: 1 })}
        onUpdateCharacter={onUpdate}
        compact
      />,
    );
    // 1 + 1 + 2 + 10 gp
    expect(screen.getByText('14.00 gp')).toBeTruthy();
    const [cp, sp, gp, pp] = screen.getAllByRole('spinbutton');
    fireEvent.change(cp, { target: { value: '250' } });
    expect(onUpdate.mock.calls[0][0].currency.cp).toBe(250);
    fireEvent.change(sp, { target: { value: '-4' } });
    expect(onUpdate.mock.calls[1][0].currency.sp).toBe(0);
    fireEvent.change(gp, { target: { value: '' } });
    expect(onUpdate.mock.calls[2][0].currency.gp).toBe(0);
    fireEvent.change(pp, { target: { value: '3' } });
    expect(onUpdate.mock.calls[3][0].currency.pp).toBe(3);
  });
});
