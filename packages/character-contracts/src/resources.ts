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
}

/** Rest rules shared by local sheets and authoritative campaign commands. */
export function recoverCharacterResource(
  resource: CharacterResource,
  rest: 'short-rest' | 'long-rest',
): CharacterResource {
  if (resource.active === false) return resource;
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
