import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandoutSpotlight } from '@/components/simple-player/HandoutSpotlight';

describe('HandoutSpotlight', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('displays a published text handout as text, preserving markup literally', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          text: async () => 'Meet at dawn. <script>literal text</script>',
        }),
    );
    render(
      <HandoutSpotlight
        handout={{
          id: 'letter',
          title: 'Letter',
          url: '/letter.txt',
          revealedAt: 0,
        }}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      await screen.findByText('Meet at dawn. <script>literal text</script>'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('shows the handout image full-screen and dismisses', () => {
    const onDismiss = vi.fn();
    render(
      <HandoutSpotlight
        handout={{ id: 'h', title: 'Harbor Map', url: '/x.png', revealedAt: 0 }}
        onDismiss={onDismiss}
      />,
    );
    expect(
      screen.getByRole('dialog', { name: 'Harbor Map' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Harbor Map' })).toHaveAttribute(
      'src',
      '/x.png',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close handout' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders without an image', () => {
    render(
      <HandoutSpotlight
        handout={{ id: 'h', title: 'Letter', revealedAt: 0 }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
