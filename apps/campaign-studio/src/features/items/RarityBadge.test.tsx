import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RarityBadge } from './RarityBadge';

describe('RarityBadge', () => {
  it('renders nothing for rarity "none"', () => {
    const { container } = render(<RarityBadge rarity="none" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the correct label for valid rarities', () => {
    const { rerender } = render(<RarityBadge rarity="common" />);
    expect(screen.getByText('Common')).toBeInTheDocument();

    rerender(<RarityBadge rarity="uncommon" />);
    expect(screen.getByText('Uncommon')).toBeInTheDocument();

    rerender(<RarityBadge rarity="rare" />);
    expect(screen.getByText('Rare')).toBeInTheDocument();

    rerender(<RarityBadge rarity="very_rare" />);
    expect(screen.getByText('Very rare')).toBeInTheDocument();

    rerender(<RarityBadge rarity="legendary" />);
    expect(screen.getByText('Legendary')).toBeInTheDocument();

    rerender(<RarityBadge rarity="artifact" />);
    expect(screen.getByText('Artifact')).toBeInTheDocument();
  });
});
