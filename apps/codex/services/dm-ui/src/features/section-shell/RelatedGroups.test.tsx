import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { RelatedGroups } from './RelatedGroups';
import { SectionContext } from './SectionContext';

describe('RelatedGroups', () => {
  it('renders forward links and backlinks grouped by entity kind', () => {
    const bundle = getFixtureBundle('ashes-of-veyra')!;

    render(
      <MemoryRouter>
        <SectionContext.Provider
          value={{
            basePath: '/demo/ashes-of-veyra',
            bundle,
          }}
        >
          <RelatedGroups
            entityId="npc-serin"
            forwardIds={['quest-ash-prophecy', 'loc-sunken-bastion']}
            heading="Connected Entities"
          />
        </SectionContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Connected Entities' })).toBeInTheDocument();
  });
});
