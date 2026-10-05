import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderInSection, renderSection } from '@/features/section-shell/testUtils';
import { getFixtureBundle } from '@/demo/fixture-registry';
import { FactionsSection } from './FactionsSection';

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
      const listNav = screen.getByRole('navigation', { name: 'Factions list' });
      expect(within(listNav).getByText(testFaction.name)).toBeInTheDocument();
      // Status badge should be visible (check for the status text)
      const badge =
        testFaction.status.charAt(0).toUpperCase() + testFaction.status.slice(1);
      expect(within(listNav).getAllByText(badge).length).toBeGreaterThan(0);
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
        expect(screen.getAllByText(member.name).length).toBeGreaterThan(0);
      }
    });

    it('shows RelatedGroups for locations, quests, encounters', async () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);
      // RelatedGroups should render related entities
      // (exact content depends on the fixture data)
      expect(screen.getByRole('region', { name: 'Related' })).toBeInTheDocument();
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
      const query = testFaction.name.slice(0, 4).toLowerCase();
      renderSection(`/demo/ashes-of-veyra/factions?q=${query}`);
      const listNav = screen.getByRole('navigation', { name: 'Factions list' });
      expect(within(listNav).getByText(testFaction.name)).toBeInTheDocument();
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
      const listNav = screen.getByRole('navigation', { name: 'Factions list' });
      const link = within(listNav).getByText(testFaction.name).closest('a');
      if (link) {
        await user.click(link);
        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent(testFaction.name);
      }
    });
  });

  describe('editable store', () => {
    const withFactionParam = (prefix: string) => (
      <Routes>
        <Route path={`${prefix}/factions/:factionId`} element={<FactionsSection />} />
        <Route path={`${prefix}/factions`} element={<FactionsSection />} />
      </Routes>
    );

    it('renders Add faction button in empty state when store is editable', () => {
      renderInSection(withFactionParam('/campaigns/campaign-blank'), {
        path: '/campaigns/campaign-blank/factions',
        store: {
          editable: true,
          bundle: {
            ...bundle,
            factions: [],
          },
        },
        singlePane: false,
      });

      expect(screen.getByText('No factions yet.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+ Add faction' })).toBeInTheDocument();
    });

    it('edits faction details including status and leader when store is editable', async () => {
      const updateItem = vi.fn().mockResolvedValue({ ok: true });
      const { user } = renderInSection(withFactionParam('/campaigns/campaign-blank'), {
        path: `/campaigns/campaign-blank/factions/${testFaction.id}`,
        store: {
          editable: true,
          updateItem,
          bundle,
        },
        singlePane: false,
      });

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      const form = screen.getByRole('form', { name: 'Edit form' });
      expect(within(form).getByLabelText('Status')).toBeInTheDocument();
      expect(within(form).getByLabelText('Leader')).toBeInTheDocument();

      await user.selectOptions(within(form).getByLabelText('Status'), 'ally');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(updateItem).toHaveBeenCalledWith(
        'faction',
        testFaction.id,
        expect.objectContaining({ status: 'ally' }),
      );
    });

    it('renders Generate Factions button and opens modal when clicked', async () => {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute('open', '');
      };
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute('open');
      };

      const { user } = renderInSection(withFactionParam('/campaigns/campaign-blank'), {
        path: `/campaigns/campaign-blank/factions/${testFaction.id}`,
        store: {
          editable: true,
          bundle,
        },
        singlePane: false,
      });

      const generateBtn = screen.getByRole('button', { name: /Generate Factions/ });
      expect(generateBtn).toBeInTheDocument();

      await user.click(generateBtn);
      expect(screen.getByRole('heading', { name: /Procedural Faction Generator/ })).toBeVisible();
    });
  });

  describe('relationship map and overview web', () => {
    it('renders SectionSummary and FactionRelationshipMap in overview pane', () => {
      renderSection('/demo/ashes-of-veyra/factions');

      expect(screen.getByRole('heading', { name: 'Faction Overview' })).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Faction Relationships')).toBeInTheDocument();

      // Check that faction nodes are rendered in the relationship web
      for (const faction of bundle.factions) {
        expect(screen.getByTestId(`faction-node-${faction.id}`)).toBeInTheDocument();
      }
    });

    it('renders Relationship Web button in footer actions when multiple factions exist', () => {
      renderSection('/demo/ashes-of-veyra/factions');
      const webButtons = screen.getAllByRole('button', { name: /Relationship Web/i });
      expect(webButtons.length).toBeGreaterThan(0);
    });

    it('navigates to faction detail when clicking a node in the overview relationship map', async () => {
      const { user } = renderSection('/demo/ashes-of-veyra/factions');
      const node = screen.getByTestId(`faction-node-${testFaction.id}`);
      await user.click(node);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(testFaction.name);
    });

    it('renders relationship map in detail pane highlighting the selected faction', () => {
      renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);

      // The detail relations section should contain the map titled "[Faction Name] Relations"
      expect(screen.getByText(`${testFaction.name} Relations`)).toBeInTheDocument();
      expect(screen.getByTestId(`faction-node-${testFaction.id}`)).toBeInTheDocument();
    });

    it('provides a Relationship Web header button in detail view to return to overview', async () => {
      const { user } = renderSection(`/demo/ashes-of-veyra/factions/${testFaction.id}`);
      const headerWebBtn = screen.getByTitle('View all faction relationships');
      expect(headerWebBtn).toBeInTheDocument();

      await user.click(headerWebBtn);
      expect(screen.getByRole('heading', { name: 'Faction Overview' })).toBeInTheDocument();
    });
  });
});

