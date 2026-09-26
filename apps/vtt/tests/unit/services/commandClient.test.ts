import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { commandClient } from '../../../src/services/commandClient';
import { useCharacterStore } from '../../../src/stores/characterStore';
import { useInitiativeStore } from '../../../src/stores/initiativeStore';
import { useGameStore } from '../../../src/stores/gameStore';
import type { Character } from '@nexus/character-contracts';

describe('DomainCommandClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset stores
    useCharacterStore.setState({
      characters: [
        {
          id: 'actor-1',
          name: 'Fighter',
          hitPoints: 20,
          maxHitPoints: 25,
          temporaryHitPoints: 5,
          playerId: 'p1',
          level: 1,
          abilities: {
            STR: { score: 16, modifier: 3 },
            DEX: { score: 14, modifier: 2 },
            CON: { score: 15, modifier: 2 },
            INT: { score: 10, modifier: 0 },
            WIS: { score: 12, modifier: 1 },
            CHA: { score: 8, modifier: -1 },
          },
        } as unknown as Character,
      ],
    });

    useInitiativeStore.setState({
      entries: [
        {
          id: 'init-1',
          name: 'Fighter',
          characterId: 'actor-1',
          currentHP: 20,
          maxHP: 25,
          tempHP: 5,
          initiative: 15,
          armorClass: 16,
          conditions: [],
          isActive: false,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: 2,
          dexterityModifier: 2,
          type: 'player',
        },
      ],
    } as unknown as Parameters<typeof useInitiativeStore.setState>[0]);

    useGameStore.setState({
      session: null,
      sceneState: {
        activeSceneId: 'scene-1',
        scenes: [
          {
            id: 'scene-1',
            name: 'Dungeon',
            placedTokens: [
              {
                id: 'token-1',
                tokenId: 'tok-base',
                characterId: 'actor-1',
                sceneId: 'scene-1',
                roomCode: 'room-1',
                x: 100,
                y: 100,
                rotation: 0,
                scale: 1,
                layer: 'tokens',
                visibleToPlayers: true,
                dmNotesOnly: false,
                conditions: [],
                currentStats: { hp: 20 },
                placedBy: 'user-1',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          },
        ],
      } as unknown as Parameters<typeof useGameStore.setState>[0]['sceneState'],
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const campaignId = '11111111-1111-4111-8111-111111111111';
  const targetActorId = 'actor-1';

  it('dispatches ApplyDamage command and updates character, initiative, and token HP', async () => {
    const mockReceipt = {
      commandId: 'cmd-1',
      principalId: 'user-1',
      campaignId,
      payloadHash: 'hash',
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [targetActorId]: 2 },
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: mockReceipt,
      }),
    });

    const windowListener = vi.fn();
    window.addEventListener('nexus-domain-command-executed', windowListener);

    const result = await commandClient.applyDamage(
      campaignId,
      targetActorId,
      10,
    );

    expect(result.success).toBe(true);
    expect(result.receipt).toEqual(mockReceipt);
    expect(windowListener).toHaveBeenCalled();

    // 10 damage applied: 5 tempHp absorbed, 5 goes to currentHp: 20 - 5 = 15, tempHp = 0
    const character = useCharacterStore
      .getState()
      .characters.find((c) => c.id === targetActorId);
    expect(character?.hitPoints).toBe(15);
    expect(character?.temporaryHitPoints).toBe(0);

    // Initiative store check
    const entry = (
      useInitiativeStore.getState() as unknown as {
        entries: Array<{ characterId?: string; currentHP: number }>;
      }
    ).entries.find((e) => e.characterId === targetActorId);
    expect(entry?.currentHP).toBe(15);

    // Token check
    const scene = useGameStore.getState().sceneState.scenes[0];
    const token = scene.placedTokens?.[0];
    expect(token?.currentStats?.hp).toBe(15);

    window.removeEventListener('nexus-domain-command-executed', windowListener);
  });

  it('dispatches HealActor command and updates character and initiative HP', async () => {
    // Start with 15 HP
    useCharacterStore.getState().updateCharacterHP(targetActorId, 15, 0);

    const mockReceipt = {
      commandId: 'cmd-2',
      principalId: 'user-1',
      campaignId,
      payloadHash: 'hash',
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [targetActorId]: 3 },
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: mockReceipt,
      }),
    });

    const result = await commandClient.healActor(campaignId, targetActorId, 8);

    expect(result.success).toBe(true);
    // 15 + 8 = 23 (max is 25)
    const character = useCharacterStore
      .getState()
      .characters.find((c) => c.id === targetActorId);
    expect(character?.hitPoints).toBe(23);

    const entry = (
      useInitiativeStore.getState() as unknown as {
        entries: Array<{ characterId?: string; currentHP: number }>;
      }
    ).entries.find((e) => e.characterId === targetActorId);
    expect(entry?.currentHP).toBe(23);
  });

  it('dispatches AdmitCharacter command with character definition reference', async () => {
    const mockReceipt = {
      commandId: 'cmd-3',
      principalId: 'user-1',
      campaignId,
      payloadHash: 'hash',
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        actorId: 'canonical-actor-uuid',
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: mockReceipt,
      }),
    });

    const result = await commandClient.admitCharacter(
      campaignId,
      {
        kind: 'character',
        id: '44444444-4444-4444-8444-444444444444',
        revision: 1,
      },
      ['user-1'],
    );

    expect(result.success).toBe(true);
    expect(result.receipt).toEqual(mockReceipt);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/campaigns/${campaignId}/commands`),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('returns failure when server reports conflict', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: 'State version mismatch',
        receipt: { result: { success: false } },
      }),
    });

    const result = await commandClient.applyDamage(
      campaignId,
      targetActorId,
      10,
      {
        expectedVersion: 1,
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('State version mismatch');
  });

  it('returns failure on network exception', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

    const result = await commandClient.healActor(campaignId, targetActorId, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('dispatches deployEncounter with scene anchor position', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true, encounterRunId: 'run-1' } },
      }),
    });

    const result = await commandClient.deployEncounter(
      campaignId,
      { kind: 'encounter', id: 'enc-template-1', revision: 1 },
      'scene-1',
      { x: 100, y: 200 },
      false,
    );

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/campaigns/${campaignId}/commands`),
      expect.objectContaining({
        body: expect.stringContaining('"type":"DeployEncounter"'),
      }),
    );
  });

  it('dispatches startEncounter and advanceCombatTurn', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true } },
      }),
    });

    const startRes = await commandClient.startEncounter(campaignId, 'run-1');
    expect(startRes.success).toBe(true);

    const advanceRes = await commandClient.advanceCombatTurn(
      campaignId,
      'run-1',
    );
    expect(advanceRes.success).toBe(true);
  });

  it('dispatches applyPreparationPlan', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true } },
      }),
    });

    const res = await commandClient.applyPreparationPlan(
      campaignId,
      targetActorId,
      'prof-1',
      ['shield', 'magic-missile'],
    );

    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/campaigns/${campaignId}/commands`),
      expect.objectContaining({
        body: expect.stringContaining('"type":"ApplyPreparationPlan"'),
      }),
    );
  });

  it('dispatches castSpell with spell definition ref and slot level', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true } },
      }),
    });

    const res = await commandClient.castSpell(
      campaignId,
      targetActorId,
      {
        kind: 'spell',
        id: '55555555-5555-4555-8555-555555555555',
        revision: 1,
      },
      'prof-1',
      2,
      { targetActorIds: ['target-1'] },
    );

    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/campaigns/${campaignId}/commands`),
      expect.objectContaining({
        body: expect.stringContaining('"type":"CastSpell"'),
      }),
    );
  });

  it('dispatches endConcentration with cast ID', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true } },
      }),
    });

    const res = await commandClient.endConcentration(
      campaignId,
      targetActorId,
      'cast-uuid-123',
    );

    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/campaigns/${campaignId}/commands`),
      expect.objectContaining({
        body: expect.stringContaining('"type":"EndConcentration"'),
      }),
    );
  });

  it('dispatches restActor for short and long rest', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true } },
      }),
    });

    const shortRes = await commandClient.restActor(
      campaignId,
      targetActorId,
      'short',
      {
        hitDiceToSpend: 2,
      },
    );
    expect(shortRes.success).toBe(true);

    const longRes = await commandClient.restActor(
      campaignId,
      targetActorId,
      'long',
    );
    expect(longRes.success).toBe(true);
  });

  it('dispatches transferItem between source and target', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true } },
      }),
    });

    const res = await commandClient.transferItem(campaignId, 'item-wand', {
      sourceActorId: targetActorId,
      targetActorId: 'actor-2',
      quantity: 1,
    });

    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/campaigns/${campaignId}/commands`),
      expect.objectContaining({
        body: expect.stringContaining('"type":"TransferItem"'),
      }),
    );
  });

  it('dispatches RevealHandout with the active room header', async () => {
    useGameStore.setState({
      session: {
        roomCode: 'ROOM42',
        hostId: 'user-1',
        campaignId,
        players: [],
        status: 'connected',
      },
    });
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        receipt: { result: { success: true } },
      }),
    });

    const result = await commandClient.revealHandout(
      campaignId,
      { target: 'asset', assetId: 'harbor-map' },
      'Harbor Map',
      '77777777-7777-4777-8777-777777777777',
    );

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/campaigns/${campaignId}/commands`),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'x-room-id': 'ROOM42',
        },
        body: expect.stringContaining('"type":"RevealHandout"'),
      }),
    );
  });
});
