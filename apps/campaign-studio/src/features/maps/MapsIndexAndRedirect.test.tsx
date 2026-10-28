import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { MapsIndex } from '@/features/maps/MapsIndex';
import { LegacyLoreRedirect } from '@/routes/LegacyLoreRedirect';

describe('MapsIndex & LegacyLoreRedirect', () => {
  describe('MapsIndex', () => {
    it('renders maps grid with thumbnail, title, description, and pin count', () => {
      const bundle = getFixtureBundle('ashes-of-veyra')!;

      render(
        <MemoryRouter>
          <MapsIndex bundle={bundle} basePath="/demo/ashes-of-veyra" />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { level: 2, name: 'Glass Harbor District' })).toBeInTheDocument();
      expect(screen.getByText(/pinned location/)).toBeInTheDocument();
    });
  });

  describe('LegacyLoreRedirect', () => {
    it('redirects /demo/test/lore/note-1 to /demo/test/notes/note-1', () => {
      render(
        <MemoryRouter initialEntries={['/demo/test/lore/notes/note-1']}>
          <Routes>
            <Route path="/demo/test/lore/*" element={<LegacyLoreRedirect />} />
            <Route path="/demo/test/notes/:id" element={<div>Redirected to Notes Detail</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Redirected to Notes Detail')).toBeInTheDocument();
    });
  });
});
