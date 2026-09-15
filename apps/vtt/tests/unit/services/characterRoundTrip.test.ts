/**
 * Create → save → export → re-import round trip.
 *
 * This is the path a player actually takes when moving a character between
 * devices or apps, and it is where silent data loss would show up: anything the
 * conversion drops on the way out, or the adapter drops on the way back in,
 * fails here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createdCharacterToNexus } from '@nexus/character-creator';
import { useCharacterStore } from '@/stores/characterStore';
import { ForgeCharacterAdapter } from '@/services/characterImport/forgeAdapter';
import {
  cleric2024,
  golden2014Artificer,
  rogue2024Level8,
  wizard2014,
} from './forgeCharacterFixtures';

vi.mock('@/stores/gameStoreContext', () => ({
  getGameStoreContext: () => ({ userId: 'user-1', isAuthenticated: false }),
}));

vi.mock('@/services/linearFlowStorage', () => ({
  getLinearFlowStorage: () => ({
    saveCharacter: vi.fn(),
    getBrowserId: () => 'browser-1',
  }),
}));

describe('character round trip', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null });
  });

  const fixtures = [
    ['2014 spellcaster', wizard2014],
    ['2024 character', cleric2024],
    ['higher-level character', rogue2024Level8],
    ['golden creator output', golden2014Artificer],
  ] as const;

  it.each(fixtures)(
    'exports %s as JSON and re-imports it without loss',
    async (_label, fixture) => {
      const store = useCharacterStore.getState();

      // 1. Create: the shared creator's output converted for the VTT.
      const created = createdCharacterToNexus(fixture as never, {
        playerId: 'user-1',
      });
      const id = await store.saveCreatedCharacter(created);

      // 2. Select: the character is retrievable and active.
      expect(useCharacterStore.getState().activeCharacterId).toBe(id);
      expect(useCharacterStore.getState().getCharacter(id)).toBeDefined();

      // 3. Export as JSON.
      const json = await useCharacterStore.getState().exportCharacter(id, 'json');
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(id);

      // 4. Re-import the exported JSON through the Forge adapter, which is what
      //    the import UI runs for any character carrying `species` + `edition`.
      const adapter = new ForgeCharacterAdapter();
      expect(adapter.validate(parsed)).toBe(true);
      const reimported = adapter.transform(parsed, 'user-2');

      // Player-visible data survives the round trip.
      expect(reimported.name).toBe(created.name);
      expect(reimported.level).toBe(created.level);
      expect(reimported.class).toBe(created.class);
      expect(reimported.subclass ?? null).toBe(created.subclass ?? null);
      expect(reimported.species).toBe(created.species);
      expect(reimported.abilities).toEqual(created.abilities);
      expect(reimported.skills).toEqual(created.skills);
      expect(reimported.proficiencies).toEqual(created.proficiencies);
      expect(reimported.languages).toEqual(created.languages);
      expect(reimported.spellcasting).toEqual(created.spellcasting);
      expect(reimported.inventory).toEqual(created.inventory);
      expect(reimported.equippedWeapons).toEqual(created.equippedWeapons);
      expect(reimported.currency).toEqual(created.currency);
      expect(reimported.featuresAndTraits).toEqual(created.featuresAndTraits);
      expect(reimported.selectedFeats).toEqual(created.selectedFeats);
      expect(reimported.featChoices).toEqual(created.featChoices);
      expect(reimported.weaponMastery).toEqual(created.weaponMastery);
      expect(reimported.expertiseSkills).toEqual(created.expertiseSkills);
      expect(reimported.trinket).toEqual(created.trinket);

      // Ownership is re-assigned to the importing player, not carried over.
      expect(reimported.playerId).toBe('user-2');
    },
  );

  it('keeps an exported character importable after a second round trip', async () => {
    const store = useCharacterStore.getState();
    const created = createdCharacterToNexus(wizard2014 as never, {
      playerId: 'user-1',
    });
    const id = await store.saveCreatedCharacter(created);

    const adapter = new ForgeCharacterAdapter();
    const first = adapter.transform(
      JSON.parse(await useCharacterStore.getState().exportCharacter(id, 'json')),
      'user-2',
    );
    const second = adapter.transform(
      JSON.parse(JSON.stringify(first)) as never,
      'user-3',
    );

    // Conversion is idempotent: a re-export of an import is unchanged.
    expect({ ...second, playerId: 'user-2' }).toEqual(first);
  });
});
