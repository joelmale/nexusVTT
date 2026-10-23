import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimpleInviteCard } from '@/components/simple-player/SimpleInviteCard';

function setNavigator(key: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, value });
}

describe('SimpleInviteCard', () => {
  afterEach(() => {
    setNavigator('share', undefined);
  });

  it('shows the /play link and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator('clipboard', { writeText });
    render(<SimpleInviteCard roomCode="abcd" />);

    const link = screen.getByRole('textbox', { name: 'Simple player link' });
    expect(link).toHaveValue(`${window.location.origin}/play/ABCD`);
    fireEvent.focus(link);

    fireEvent.click(
      screen.getByRole('button', { name: 'Copy Simple Player Link' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Copied!' }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/play/ABCD`,
    );
    expect(
      screen.queryByRole('button', { name: 'Share…' }),
    ).not.toBeInTheDocument();
  });

  it('stays usable when the clipboard is blocked', async () => {
    setNavigator('clipboard', {
      writeText: vi.fn().mockRejectedValue(new Error('no')),
    });
    render(<SimpleInviteCard roomCode="ABCD" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy Simple Player Link' }),
    );
    await Promise.resolve();
    expect(
      screen.getByRole('button', { name: 'Copy Simple Player Link' }),
    ).toBeInTheDocument();
  });

  it('uses the native share sheet when available', () => {
    const share = vi.fn().mockRejectedValue(new Error('cancelled'));
    setNavigator('share', share);
    render(<SimpleInviteCard roomCode="ABCD" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share…' }));
    expect(share).toHaveBeenCalledWith({
      title: 'Join my D&D game!',
      url: `${window.location.origin}/play/ABCD`,
    });
  });
});
