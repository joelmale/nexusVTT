import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  SectionContext,
  type SectionContextValue,
} from './SectionContext';
import { UseInNextSessionButton } from './UseInNextSessionButton';

const baseBundle = getFixtureBundle('ashes-of-veyra', 'test')!;

function renderWithContext({
  bundle = baseBundle,
  editable = true,
  updateItem = vi.fn().mockResolvedValue({ ok: true }),
  kind = 'npc' as 'npc' | 'location' | 'encounter' | 'quest' | 'item' | 'secret',
  id = 'npc-1',
  size = 'md' as const,
}: {
  bundle?: typeof baseBundle;
  editable?: boolean;
  updateItem?: ReturnType<typeof vi.fn>;
  kind?: 'npc' | 'location' | 'encounter' | 'quest' | 'item' | 'secret';
  id?: string;
  size?: 'sm' | 'md';
} = {}) {
  const store = {
    bundle,
    status: 'ready' as const,
    editable,
    reload: vi.fn(),
    updateItem,
    addItem: vi.fn(),
    reorderNotes: vi.fn(),
    removeItem: vi.fn(),
    restoreItem: vi.fn(),
    getBacklinks: vi.fn(),
  };

  const contextValue: SectionContextValue = {
    bundle,
    basePath: '/demo/ashes-of-veyra',
    store: store as unknown as SectionContextValue['store'],
  };

  const user = userEvent.setup();
  const result = render(
    <SectionContext.Provider value={contextValue}>
      <UseInNextSessionButton id={id} kind={kind} size={size} />
    </SectionContext.Provider>,
  );

  return { user, updateItem, ...result };
}

describe('UseInNextSessionButton', () => {
  it('renders "Use in next session" when entity is not yet linked', () => {
    const nextSession = baseBundle.sessions[0];
    const unlinkedNpcId = 'unlinked-npc-999';

    renderWithContext({
      bundle: {
        ...baseBundle,
        campaign: {
          ...baseBundle.campaign,
          nextSession: {
            ...baseBundle.campaign.nextSession,
            sessionId: nextSession.id,
          },
        },
        sessions: [
          {
            ...nextSession,
            npcIds: [],
          },
        ],
      },
      id: unlinkedNpcId,
      kind: 'npc',
    });

    const button = screen.getByRole('button', { name: /Add to Session/ });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Use in next session');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles adding an NPC to the next session when clicked', async () => {
    const nextSession = baseBundle.sessions[0];
    const updateItem = vi.fn().mockResolvedValue({ ok: true });

    const { user } = renderWithContext({
      bundle: {
        ...baseBundle,
        campaign: {
          ...baseBundle.campaign,
          nextSession: { ...baseBundle.campaign.nextSession, sessionId: nextSession.id },
        },
        sessions: [
          {
            ...nextSession,
            npcIds: ['other-npc'],
          },
        ],
      },
      id: 'target-npc',
      kind: 'npc',
      updateItem,
    });

    const button = screen.getByRole('button', { name: /Add to Session/ });
    await user.click(button);

    expect(updateItem).toHaveBeenCalledWith('session', nextSession.id, {
      npcIds: ['other-npc', 'target-npc'],
    });
  });

  it('renders "In next session" when linked, and clicking removes it', async () => {
    const nextSession = baseBundle.sessions[0];
    const updateItem = vi.fn().mockResolvedValue({ ok: true });

    const { user } = renderWithContext({
      bundle: {
        ...baseBundle,
        campaign: {
          ...baseBundle.campaign,
          nextSession: { ...baseBundle.campaign.nextSession, sessionId: nextSession.id },
        },
        sessions: [
          {
            ...nextSession,
            encounterIds: ['enc-1', 'target-enc'],
          },
        ],
      },
      id: 'target-enc',
      kind: 'encounter',
      updateItem,
    });

    const button = screen.getByRole('button', { name: /In Session \d+ prep/ });
    expect(button).toHaveTextContent('In next session');
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);

    expect(updateItem).toHaveBeenCalledWith('session', nextSession.id, {
      encounterIds: ['enc-1'],
    });
  });

  it('handles item linking via item.sessionId update', async () => {
    const nextSession = baseBundle.sessions[0];
    const updateItem = vi.fn().mockResolvedValue({ ok: true });

    const { user } = renderWithContext({
      bundle: {
        ...baseBundle,
        campaign: {
          ...baseBundle.campaign,
          nextSession: { ...baseBundle.campaign.nextSession, sessionId: nextSession.id },
        },
        items: [
          {
            id: 'item-loot-1',
            campaignId: baseBundle.campaignId,
            name: 'Sunblade',
            itemType: 'weapon',
            rarity: 'rare',
            requiresAttunement: true,
            quantity: 1,
            description: 'Shiny',
            holder: { kind: 'none' },
            discovered: false,
            identified: true,
            questIds: [],
          },
        ],
      },
      id: 'item-loot-1',
      kind: 'item',
      updateItem,
    });

    const button = screen.getByRole('button', { name: /Add to Session/ });
    await user.click(button);

    expect(updateItem).toHaveBeenCalledWith('item', 'item-loot-1', {
      sessionId: nextSession.id,
    });
  });

  it('shows read-only badge in non-editable mode when linked', () => {
    const nextSession = baseBundle.sessions[0];

    renderWithContext({
      bundle: {
        ...baseBundle,
        campaign: {
          ...baseBundle.campaign,
          nextSession: { ...baseBundle.campaign.nextSession, sessionId: nextSession.id },
        },
        sessions: [
          {
            ...nextSession,
            locationIds: ['loc-cave'],
          },
        ],
      },
      id: 'loc-cave',
      kind: 'location',
      editable: false,
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Next session')).toBeInTheDocument();
  });

  it('renders disabled "Use in next session" in read-only mode when entity is not linked', () => {
    const nextSession = baseBundle.sessions[0];

    renderWithContext({
      bundle: {
        ...baseBundle,
        campaign: {
          ...baseBundle.campaign,
          nextSession: { ...baseBundle.campaign.nextSession, sessionId: nextSession.id },
        },
        sessions: [
          {
            ...nextSession,
            locationIds: [],
          },
        ],
      },
      id: 'loc-cave',
      kind: 'location',
      editable: false,
    });

    const button = screen.getByRole('button', { name: /Example campaign is read-only/ });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Use in next session');
  });

  it('resolves fallback session from currentSessionId when campaign.nextSession is not curated', () => {
    const session = baseBundle.sessions[0];

    renderWithContext({
      bundle: {
        ...baseBundle,
        campaign: {
          ...baseBundle.campaign,
          nextSession: undefined as unknown as typeof baseBundle.campaign.nextSession,
          currentSessionId: session.id,
        },
        sessions: [
          {
            ...session,
            npcIds: ['npc-fallback'],
          },
        ],
      },
      id: 'npc-fallback',
      kind: 'npc',
      editable: false,
    });

    expect(screen.getByText('Next session')).toBeInTheDocument();
  });
});
