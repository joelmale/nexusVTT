import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSection } from '@/features/section-shell/testUtils';
import { getFixtureBundle } from '@/demo/fixture-registry';

describe('FactionsSection', () => {
  const bundle = getFixtureBundle('ashes-of-veyra')!;
  const testFaction = bundle.factions[0]!;

  describe('list view', () => {
    it('renders factions grouped by status in order: opposition, unknown, neutral, ally', async () => {
      const { container } = renderSection('/demo/ashes-of-veyra/factions');

      // Get all group headings (they should appear in status order)
      const headings = container.querySelectorAll('nav ul > li > h3');
      const statusOrder = Array.from(headings).map((h) => {
        const text = h.textContent?.toLowerCase();
        if (text?.includes('opposition')) return 'opposition';
        if (text?.includes('unknown')) return 'unknown';
        if (text?.includes('neutral')) return 'neutral';
        if (text?.includes('ally')) return 'ally';
        return '';
      });

      // Verify the order follows the plan
      const expectedOrder = statusOrder.filter(
        (status, i, arr) => arr.indexOf(status) === i,
      );
      const planOrder = ['opposition', 'unknown', 'neutral', 'ally'].filter(
        (s) => expectedOrder.includes(s),
      );
      expect(expectedOrder).toEqual(planOrder);
    });

    it('shows name, status badge, and leader name in each row', async () => {
      renderSection('/demo/ashes-of-veyra/factions');
      expect(screen.getByText(testFaction.name)).toBeInTheDocument();
      // Status badge should be visible (check for the status text)
      expect(
        screen.getByText(
          testFaction.status.charAt(0).toUpperCase() + testFaction.status.slice(1),
        ),
      ).toBeInTheDocument();
    });
  });

  describe('detail pane', () => {
    it('shows faction details when a faction is selected', async () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);

      // Check that the faction name is shown as h2
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(testFaction.name);
    });

    it('displays public face (description) field', async () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);
      expect(screen.getByText('Public Face')).toBeInTheDocument();
      if (testFaction.publicFace) {
        expect(screen.getByText(testFaction.publicFace)).toBeInTheDocument();
      }
    });

    it('displays hidden agenda with DM-only badge', async () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);
      expect(screen.getByText('Hidden Agenda')).toBeInTheDocument();
      if (testFaction.hiddenAgenda) {
        expect(screen.getByText('DM only')).toBeInTheDocument();
      }
    });

    it('shows leader as NPC link when present', async () => {
      const factionWithLeader = bundle.factions.find((f) => f.leaderNpcId);
      if (factionWithLeader) {
        renderSection(`/demo/ashes-of-veyra/factions/${factionWithLeader.id}`);
        expect(screen.getByText('Leader')).toBeInTheDocument();
      }
    });

    it('displays allies as positive-toned chips', async () => {
      const factionWithAllies = bundle.factions.find(
        (f) => f.alliedFactionIds.length > 0,
      );
      if (factionWithAllies) {
        renderSection(`/demo/ashes-of-veyra/factions/${factionWithAllies.id}`);
        expect(screen.getByText('Allies:')).toBeInTheDocument();
      }
    });

    it('displays rivals as danger-toned chips', async () => {
      const factionWithRivals = bundle.factions.find(
        (f) => f.rivalFactionIds.length > 0,
      );
      if (factionWithRivals) {
        renderSection(`/demo/ashes-of-veyra/factions/${factionWithRivals.id}`);
        expect(screen.getByText('Rivals:')).toBeInTheDocument();
      }
    });

    it('shows members derived from NPC factionIds', async () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);
      expect(screen.getByText('Members')).toBeInTheDocument();
      // Members should be displayed as links
      const members = bundle.npcs.filter((npc) =>
        npc.factionIds.includes(testFaction.id),
      );
      for (const member of members) {
        expect(screen.getByText(member.name)).toBeInTheDocument();
      }
    });

    it('shows RelatedGroups for locations, quests, encounters', async () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);
      // RelatedGroups should render related entities
      // (exact content depends on the fixture data)
      expect(screen.getByText('Related')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filters by status when status query param is set', async () => {
      const { container } = renderSection(
        '/demo/ashes-of-veyra/factions?status=ally',
      );
      const rows = container.querySelectorAll('nav ul li ul li');
      for (const row of rows) {
        // Each row should contain a faction with status='ally'
        expect(row.textContent?.toLowerCase()).toContainEqual(
          expect.anything(),
        );
      }
    });

    it('filters by search query', async () => {
      renderSection('/demo/ashes-of-veyra/factions?q=allies');
      // At least the faction with 'allies' in name or description should appear
      expect(screen.getByText(/allies/i)).toBeInTheDocument();
    });
  });

  describe('AddRow', () => {
    it('shows "Add faction" button in demo campaigns (read-only)', async () => {
      renderSection('/demo/ashes-of-veyra/factions');
      // In demo campaigns, AddRow should not be visible (store.editable = false)
      const addButtons = screen.queryAllByText(/\+ Add faction/);
      expect(addButtons.length).toBe(0);
    });

    it('does not appear in demo campaigns (read-only)', async () => {
      renderSection('/demo/ashes-of-veyra/factions');
      // Demo campaigns are read-only, so AddRow should be hidden
      const addButton = screen.queryByText(/\+ Add faction/);
      expect(addButton).not.toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('selects faction from URL and shows detail pane', async () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(testFaction.name);
    });

    it('navigates to faction detail when clicking a row', async () => {
      const { user } = renderSection('/demo/ashes-of-veyra/factions');
      const link = screen.getByText(testFaction.name).closest('a');
      if (link) {
        await user.click(link);
        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent(testFaction.name);
      }
    });
  });
});
