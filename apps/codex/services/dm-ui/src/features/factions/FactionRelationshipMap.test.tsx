import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { generateFactionWeb, generateSingleFaction } from '@nexus/character-creator';

import { FactionRelationshipMap } from './FactionRelationshipMap';
import styles from './FactionRelationshipMap.module.css';

describe('FactionRelationshipMap', () => {
  it('renders a single faction without crashing', () => {
    const faction = generateSingleFaction();
    render(<FactionRelationshipMap factions={[faction]} />);

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent(
      'Faction Ecosystem Relationship Web',
    );
    expect(screen.getByTestId(`faction-node-${faction.tempId}`)).toBeInTheDocument();
  });

  it('renders multiple factions with relationship links and legend', () => {
    const web = generateFactionWeb({ count: 3, includeRelationships: true });
    render(<FactionRelationshipMap factions={web.factions} />);

    // All 3 faction nodes should be rendered with unique testids
    for (const f of web.factions) {
      expect(screen.getByTestId(`faction-node-${f.tempId}`)).toBeInTheDocument();
    }

    // Legend items should be present
    expect(screen.getByText('Allies')).toBeInTheDocument();
    expect(screen.getByText('Rivals')).toBeInTheDocument();
    expect(screen.getByText('Uneasy Truce')).toBeInTheDocument();
  });

  it('selects node and calls onSelectFaction when clicked', async () => {
    const user = userEvent.setup();
    const onSelectFaction = vi.fn();
    const web = generateFactionWeb({ count: 3 });
    render(
      <FactionRelationshipMap
        factions={web.factions}
        onSelectFaction={onSelectFaction}
      />,
    );

    const firstNode = screen.getByTestId(`faction-node-${web.factions[0].tempId}`);
    await user.click(firstNode);

    expect(onSelectFaction).toHaveBeenCalledWith(web.factions[0].tempId);
  });

  it('highlights relationship details when a link is clicked', async () => {
    const user = userEvent.setup();
    const web = generateFactionWeb({ count: 2, includeRelationships: true });
    const { container } = render(<FactionRelationshipMap factions={web.factions} />);

    // Find the link hitbox using styles.linkHitbox
    const hitbox = container.querySelector(`.${styles.linkHitbox}`);
    expect(hitbox).toBeInTheDocument();
    if (hitbox) {
      await user.click(hitbox);
      // The inspector header should now show "Faction A ↔ Faction B"
      const inspectorTitle = container.querySelector(`.${styles.inspectorTitle}`);
      expect(inspectorTitle).toHaveTextContent(
        `${web.factions[0].name} ↔ ${web.factions[1].name}`,
      );
    }
  });

  it('displays node relationships in inspector when node is hovered', () => {
    const web = generateFactionWeb({ count: 3, includeRelationships: true });
    render(<FactionRelationshipMap factions={web.factions} />);

    const firstNodeGroup = screen.getByTestId(`faction-node-${web.factions[0].tempId}`);
    fireEvent.mouseEnter(firstNodeGroup);

    expect(
      screen.getByText(`${web.factions[0].name} Relationships`),
    ).toBeInTheDocument();
  });
});
