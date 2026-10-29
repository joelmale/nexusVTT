import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getFixtureBundle,
  listEntities,
  listFixtureBundles,
} from '@/demo/fixture-registry';
import {
  renderInSection,
  renderSection,
} from '@/features/section-shell/testUtils';

import { CampaignSearchDialog } from './CampaignSearchDialog';
import { searchCampaign } from './searchCampaign';

const ashes = getFixtureBundle('ashes-of-veyra', 'test')!;

describe('searchCampaign', () => {
  it('returns nothing for a blank query', () => {
    expect(searchCampaign(ashes, '')).toEqual([]);
    expect(searchCampaign(ashes, '   ')).toEqual([]);
  });

  it('ranks title matches above body matches', () => {
    const results = searchCampaign(ashes, 'serin');
    expect(results[0].entity).toMatchObject({
      id: 'npc-captain-serin',
      kind: 'npc',
    });
    expect(results[0].score).toBeGreaterThanOrEqual(60);
    const scores = results.map((result) => result.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('finds text inside bodies and excerpts around the match', () => {
    const npc = ashes.npcs.find((item) => item.motivation.length > 40)!;
    const word = npc.motivation
      .split(/\W+/)
      .filter((part) => part.length > 5 && !npc.name.toLowerCase().includes(part.toLowerCase()))
      .sort((a, b) => b.length - a.length)[0];
    const hit = searchCampaign(ashes, word, 50).find(
      (result) => result.entity.id === npc.id,
    )!;
    expect(hit).toBeDefined();
    expect(hit.snippet?.toLowerCase()).toContain(word.toLowerCase());
    expect(hit.snippet!.length).toBeLessThan(npc.motivation.length + 4);
  });

  it('requires every word to match and caps the result count', () => {
    expect(searchCampaign(ashes, 'serin zzzzqqqq')).toEqual([]);
    expect(searchCampaign(ashes, 'a', 3)).toHaveLength(3);
  });

  it('never returns another campaign’s objects', () => {
    for (const bundle of listFixtureBundles('test')) {
      const own = new Set(listEntities(bundle).map((entity) => entity.id));
      for (const query of ['the', 'serin', 'key', 'a']) {
        for (const result of searchCampaign(bundle, query, 100)) {
          expect(own.has(result.entity.id)).toBe(true);
        }
      }
    }
    const other = getFixtureBundle('crown-of-cinders', 'test')!;
    const ashesIds = new Set(listEntities(ashes).map((entity) => entity.id));
    for (const result of searchCampaign(other, 'serin', 100)) {
      expect(ashesIds.has(result.entity.id)).toBe(false);
    }
  });

  it('reads mentions as plain @Label in excerpts and matches their label', () => {
    const target = ashes.npcs[0];
    const note = ashes.notes[0];
    const bundle = {
      ...ashes,
      notes: [
        {
          ...note,
          title: 'Plain title',
          body: `Zebrafish plan: speak to @[${target.name}](ref:${target.id}) first.`,
        },
      ],
    };
    const hit = searchCampaign(bundle, 'zebrafish').find(
      (result) => result.entity.id === note.id,
    )!;
    expect(hit.snippet).toContain(`@${target.name}`);
    expect(hit.snippet).not.toContain('ref:');
  });

  it('searches items, secrets, inboxNotes, and homebrewMonsters and respects includeSecrets', () => {
    const bundle = {
      ...ashes,
      items: [
        {
          id: 'item-chrono-compass',
          campaignId: ashes.campaignId,
          name: 'Chrono Compass',
          playerName: 'Old Brass Compass',
          itemType: 'wondrous_item' as const,
          rarity: 'very_rare' as const,
          requiresAttunement: true,
          attunementNote: 'by a chronurgy wizard',
          quantity: 1,
          description: 'Spins backward near temporal rifts.',
          mechanics: 'Grants +2 initiative and temporal echo.',
          holder: { kind: 'none' as const },
          discovered: true,
          identified: false,
          questIds: [],
        },
      ],
      secrets: [
        {
          id: 'secret-obsidian-vault',
          campaignId: ashes.campaignId,
          text: 'A hidden vault beneath the lighthouse holds the obsidian phylactery.',
          attachedTo: [],
          revealed: false,
        },
      ],
      inboxNotes: [
        {
          id: 'inbox-tavern-brawl',
          campaignId: ashes.campaignId,
          text: 'Players started a tavern brawl with the clockwork automaton.',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ],
      homebrewMonsters: [
        {
          id: 'monster-void-leviathan',
          campaignId: ashes.campaignId,
          name: 'Void Leviathan',
          size: 'Gargantuan',
          type: 'aberration',
          cr: '17',
          ac: 19,
          hp: 310,
          speed: 50,
          abilities: [24, 10, 22, 16, 14, 18] as [
            number,
            number,
            number,
            number,
            number,
            number,
          ],
          edition: '2024' as const,
          notes: 'Swallows ships whole in the astral tide.',
        },
      ],
    };

    const itemByMechanics = searchCampaign(bundle, 'temporal echo');
    expect(itemByMechanics[0]?.entity).toMatchObject({
      id: 'item-chrono-compass',
      kind: 'item',
      href: '/items/item-chrono-compass',
    });

    const itemByPlayerName = searchCampaign(bundle, 'Old Brass Compass');
    expect(itemByPlayerName[0]?.entity.id).toBe('item-chrono-compass');

    const secretHits = searchCampaign(bundle, 'phylactery');
    expect(secretHits[0]?.entity).toMatchObject({
      id: 'secret-obsidian-vault',
      kind: 'secret',
      href: '/notes?tab=secrets',
    });

    expect(
      searchCampaign(bundle, 'phylactery', { includeSecrets: false }),
    ).toEqual([]);
    expect(
      searchCampaign(bundle, 'phylactery', 20, { includeSecrets: false }),
    ).toEqual([]);

    const inboxHits = searchCampaign(bundle, 'clockwork automaton');
    expect(inboxHits[0]?.entity).toMatchObject({
      id: 'inbox-tavern-brawl',
      kind: 'note',
      href: '/notes?tab=inbox',
    });

    const monsterHits = searchCampaign(bundle, 'astral tide');
    expect(monsterHits[0]?.entity).toMatchObject({
      id: 'monster-void-leviathan',
      kind: 'encounter',
      href: '/encounters?tab=bestiary',
    });
  });
});

describe('CampaignSearchDialog', () => {
  it('renders nothing while closed', () => {
    renderInSection(<CampaignSearchDialog onClose={vi.fn()} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('searches, moves with the arrows, and opens the chosen result', async () => {
    const onClose = vi.fn();
    const { user } = renderInSection(
      <CampaignSearchDialog onClose={onClose} open />,
    );
    const input = screen.getByRole('combobox', { name: 'Search this campaign' });
    expect(input).toHaveFocus();
    expect(screen.getByText('Type to search this campaign.')).toBeVisible();

    await user.type(input, 'serin');
    const list = screen.getByRole('listbox', { name: 'Search results' });
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveTextContent('Captain Serin Dhal');
    expect(screen.getByText(/^\d+ results?$/)).toBeVisible();

    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/demo/ashes-of-veyra/npcs/npc-captain-serin',
    );
  });

  it('says so when nothing matches and closes on Escape', async () => {
    const onClose = vi.fn();
    const { user } = renderInSection(
      <CampaignSearchDialog onClose={onClose} open />,
    );
    await user.type(screen.getByRole('combobox'), 'zzzzqqqq');
    expect(screen.getByText('No matches in this campaign.')).toBeVisible();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    await user.keyboard('{Enter}');
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('search from a section page', () => {
  it('opens from the top bar button instead of the planned notice', async () => {
    const { user } = renderSection('/demo/ashes-of-veyra/npcs');
    await user.click(screen.getByRole('button', { name: 'Search campaign' }));
    expect(screen.getByRole('dialog', { name: 'Search campaign' })).toBeVisible();
    expect(screen.queryByLabelText('Capability notice')).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with Ctrl+K and navigates to a result', async () => {
    const { user } = renderSection('/demo/ashes-of-veyra/npcs');
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.keyboard('serin{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/demo/ashes-of-veyra/npcs/npc-captain-serin',
    );
  });
});
