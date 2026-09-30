import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EntityLink } from './EntityLink';
import { renderInSection } from './testUtils';

describe('EntityLink', () => {
  it('links a resolved id under the campaign base path', () => {
    renderInSection(<EntityLink id="npc-captain-serin" />);
    expect(
      screen.getByRole('link', { name: /Captain Serin Dhal/ }),
    ).toHaveAttribute('href', '/demo/ashes-of-veyra/npcs/npc-captain-serin');
  });

  it('renders an unresolved id as a non-link and does not throw', () => {
    renderInSection(<EntityLink id="npc-does-not-exist" />);
    expect(screen.getByText('Missing reference')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
