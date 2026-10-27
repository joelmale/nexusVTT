/** Durable counters shared by creator and hosts. An absent currentUses is
 * unknown legacy state, not a full or empty resource. */
export interface CharacterResource {
  id: string;
  name: string;
  description: string;
  maxUses: number;
  currentUses?: number;
  rechargeType: 'short-rest' | 'long-rest' | 'daily' | 'none';
  recovery?: {
    shortRest?: number | 'full';
    longRest?: number | 'full';
  };
  provenance?: {
    classSlug: string;
    edition: '2014' | '2024';
    gainedAt: number;
    source: string;
  };
  /** Unlimited resources use finite counters so JSON round trips are lossless. */
  unlimited?: boolean;
  active?: boolean;
  maxUsesOverride?: number;
  manualRecovery?: string;
  /** Game-time cooldown: days require explicit advancement; rests never imply days. */
  cooldown?: { remaining: number; unit: 'day' | 'long-rest' };
}

/** Explicit correction/manual recovery; never used implicitly when loading. */
export function recordCharacterResource(
  resource: CharacterResource,
  currentUses: number,
  cooldown: CharacterResource['cooldown'] = resource.cooldown,
): CharacterResource {
  if (resource.active === false || resource.unlimited)
    throw new Error('This resource cannot be recorded.');
  if (
    !Number.isSafeInteger(currentUses) ||
    currentUses < 0 ||
    currentUses > resource.maxUses
  )
    throw new Error(
      'Remaining uses must be an integer within the resource maximum.',
    );
  if (
    cooldown &&
    (!Number.isSafeInteger(cooldown.remaining) ||
      cooldown.remaining < 0 ||
      cooldown.remaining > 1000 ||
      !['day', 'long-rest'].includes(cooldown.unit))
  )
    throw new Error('Invalid resource cooldown.');
  if (cooldown && cooldown.remaining > 0 && currentUses !== 0)
    throw new Error('A resource on cooldown must have zero available uses.');
  return { ...resource, currentUses, cooldown };
}

/** Rest rules shared by local sheets and authoritative campaign commands. */
export function recoverCharacterResource(
  resource: CharacterResource,
  rest: 'short-rest' | 'long-rest',
): CharacterResource {
  if (resource.active === false) return resource;
  if (resource.cooldown && resource.cooldown.remaining > 0) {
    const remaining = Math.max(
      0,
      resource.cooldown.remaining -
        (rest === 'long-rest' && resource.cooldown.unit === 'long-rest'
          ? 1
          : 0),
    );
    const next = { ...resource, cooldown: { ...resource.cooldown, remaining } };
    return remaining > 0
      ? { ...next, currentUses: 0 }
      : { ...next, currentUses: resource.maxUses };
  }
  const amount = resource.recovery
    ? rest === 'short-rest'
      ? resource.recovery.shortRest
      : resource.recovery.longRest
    : resource.rechargeType === rest ||
        (rest === 'long-rest' && resource.rechargeType === 'short-rest')
      ? 'full'
      : undefined;
  if (amount === undefined) return resource;
  const currentUses =
    amount === 'full'
      ? resource.maxUses
      : Number.isSafeInteger(resource.currentUses) && resource.currentUses! >= 0
        ? Math.min(resource.maxUses, resource.currentUses! + amount)
        : undefined;
  return { ...resource, currentUses };
}
