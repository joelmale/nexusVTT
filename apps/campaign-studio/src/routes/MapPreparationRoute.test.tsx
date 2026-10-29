import '@testing-library/jest-dom/vitest';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderSection } from '@/features/section-shell/testUtils';

describe('MapPreparationRoute', () => {
  it('renders MapPreparationRoute with fixture map data', async () => {
    renderSection('/demo/ashes-of-veyra/maps/map-glass-harbor');
    expect(await screen.findByRole('heading', { level: 1, name: 'Glass Harbor District' })).toBeInTheDocument();
  });

  it('renders not found state when map id is invalid', async () => {
    renderSection('/demo/ashes-of-veyra/maps/non-existent-map');
    expect(await screen.findByText('Map not found')).toBeInTheDocument();
    expect(screen.getByText('This map does not exist in this campaign.')).toBeInTheDocument();
  });
});
