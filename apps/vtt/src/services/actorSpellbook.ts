import {
  activeConcentrationSchema,
  resourcePoolSchema,
  spellcastingProfileSchema,
  spellDefinitionSchema,
  type ActiveConcentration,
  type ResourcePool,
  type SpellcastingProfile,
  type SpellDefinition,
} from '@nexus/game-contracts';
import { commandClient } from '@/services/commandClient';

export interface SpellbookActor {
  id: string;
  stateVersion: number;
  profiles: SpellcastingProfile[];
  pools: Record<string, ResourcePool>;
  concentration?: ActiveConcentration;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

async function read(path: string): Promise<unknown> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok)
    throw new Error(
      'Could not load the campaign spellbook. Check your connection and campaign access.',
    );
  return response.json() as Promise<unknown>;
}

/** Reads committed actor state and immutable spell definitions; never invents a profile. */
export async function loadActorSpellbook(
  campaignId: string,
  characterId: string,
  userId: string,
  canAdmit = true,
): Promise<{ actor: SpellbookActor; spells: SpellDefinition[] }> {
  const path = `/api/campaigns/${encodeURIComponent(campaignId)}`;
  const findActor = (actors: unknown) =>
    Array.isArray(actors)
      ? actors
          .map(record)
          .find(
            (actor) =>
              actor.id === characterId ||
              actor.campaignActorId === characterId ||
              record(actor.sourceRef).id === characterId,
          )
      : undefined;
  let raw = findActor(await read(`${path}/actors`));
  if (!raw && canAdmit) {
    const admitted = await commandClient.admitCharacter(
      campaignId,
      { kind: 'character', id: characterId, revision: 0 },
      [userId],
    );
    if (!admitted.success)
      throw new Error(
        admitted.error || 'Ask the DM to admit this character to the campaign.',
      );
    raw = findActor(await read(`${path}/actors`));
  }
  if (!raw)
    throw new Error(
      'Ask the DM to admit this character to the campaign before casting.',
    );
  const id = raw.campaignActorId || raw.id;
  if (typeof id !== 'string' || !Number.isSafeInteger(raw.stateVersion))
    throw new Error('The campaign returned an invalid actor.');
  const profiles = Array.isArray(raw.spellcastingProfiles)
    ? raw.spellcastingProfiles.map((profile) =>
        spellcastingProfileSchema.parse(profile),
      )
    : [];
  const pools = Object.fromEntries(
    Object.entries(record(raw.resourcePools)).map(([key, pool]) => [
      key,
      resourcePoolSchema.parse(pool),
    ]),
  );
  const concentration = activeConcentrationSchema.safeParse(
    raw.concentration ?? record(raw.payload).concentration,
  );
  const catalog = record(await read(`${path}/spells`));
  const spells = Array.isArray(catalog.spells)
    ? catalog.spells.map((spell) => spellDefinitionSchema.parse(spell))
    : [];
  return {
    actor: {
      id,
      stateVersion: raw.stateVersion as number,
      profiles,
      pools,
      ...(concentration.success ? { concentration: concentration.data } : {}),
    },
    spells,
  };
}
