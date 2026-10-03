import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Icon } from './Icon';
import { useIconStore } from '@/stores/iconStore';

describe('Icon component', () => {
  beforeEach(() => {
    localStorage.clear();
    useIconStore.setState({
      globalCampaignPackId: 'nexus-vector-gold',
      localUserOverrides: {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an img tag with the resolved URL and accessible attributes', () => {
    render(<Icon id="panel:atlas" size={24} />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Atlas Studio');
    expect(img).toHaveAttribute('src', '/assets/icons/panels/atlas.png');
    expect(img).toHaveStyle({ width: '24px', height: '24px' });
  });

  it('falls back to emoji when the active pack has no image for the icon', () => {
    useIconStore.getState().setGlobalCampaignPack('default-emoji');
    render(<Icon id="panel:dice" size={20} />);

    const iconWrapper = screen.getByRole('img');
    expect(iconWrapper).toHaveTextContent('🎲');
    expect(iconWrapper.tagName).toBe('SPAN');
  });

  it('falls back to fallback content if the image fails to load', () => {
    render(<Icon id="panel:scene" fallback="🖼️" />);

    const imageElement = screen.getByRole('img');
    expect(imageElement.tagName).toBe('IMG');

    // Trigger onError
    fireEvent.error(imageElement);

    // Should now display fallback text in span
    const fallbackSpan = screen.getByRole('img');
    expect(fallbackSpan).toHaveTextContent('🖼️');
    expect(fallbackSpan.tagName).toBe('SPAN');
  });

  it('renders a custom override indicator dot when showIndicator is true', () => {
    useIconStore.getState().setLocalUserIcon('panel:props', 'data:image/png;base64,123');

    const { container, rerender } = render(
      <Icon id="panel:props" showIndicator={true} />,
    );
    expect(container.querySelector('span[class*="hasCustomOverride"]')).toBeInTheDocument();

    rerender(<Icon id="panel:props" showIndicator={false} />);
    expect(container.querySelector('span[class*="hasCustomOverride"]')).toBeNull();
  });

  it('accepts string dimensions like "1.5rem"', () => {
    render(<Icon id="panel:chat" size="1.5rem" />);
    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ width: '1.5rem', height: '1.5rem' });
  });
});
