import type {
  CampaignFixtureBundle,
  CampaignSecret,
} from '@/demo/fixture-registry';

export interface SecretFilterOptions {
  query?: string;
  status?: 'all' | 'unrevealed' | 'revealed';
  attachedKind?: string;
  sessionId?: string;
}

export interface SecretStats {
  total: number;
  unrevealed: number;
  revealed: number;
}

export function computeSecretStats(
  secrets: readonly CampaignSecret[],
): SecretStats {
  let unrevealed = 0;
  let revealed = 0;
  for (const s of secrets) {
    if (s.revealed) {
      revealed++;
    } else {
      unrevealed++;
    }
  }
  return {
    total: secrets.length,
    unrevealed,
    revealed,
  };
}

export function filterSecrets(
  secrets: readonly CampaignSecret[],
  options: SecretFilterOptions,
): CampaignSecret[] {
  const query = options.query?.toLowerCase().trim() ?? '';
  const status = options.status ?? 'all';
  const attachedKind = options.attachedKind;
  const sessionId = options.sessionId;

  return secrets.filter((s) => {
    if (status === 'unrevealed' && s.revealed) return false;
    if (status === 'revealed' && !s.revealed) return false;

    if (sessionId && s.revealedInSessionId !== sessionId) return false;

    if (
      attachedKind &&
      attachedKind !== 'all' &&
      !s.attachedTo?.some((att) => att.kind === attachedKind)
    ) {
      return false;
    }

    if (query) {
      const textMatch = s.text.toLowerCase().includes(query);
      if (!textMatch) return false;
    }

    return true;
  });
}

export function createDefaultSecretDraft(
  campaignId: string,
  attachedTo: { kind: string; id: string }[] = [],
  sessionId?: string,
): Omit<CampaignSecret, 'id'> {
  return {
    campaignId,
    text: '',
    attachedTo,
    revealed: false,
    revealedInSessionId: sessionId,
  };
}

export function resolveAttachmentLabel(
  bundle: CampaignFixtureBundle,
  kind: string,
  id: string,
): string {
  switch (kind) {
    case 'npc':
      return bundle.npcs.find((n) => n.id === id)?.name ?? 'NPC';
    case 'location':
      return bundle.locations.find((l) => l.id === id)?.name ?? 'Location';
    case 'encounter':
      return bundle.encounters.find((e) => e.id === id)?.title ?? 'Encounter';
    case 'quest':
      return bundle.quests.find((q) => q.id === id)?.title ?? 'Quest';
    case 'item':
      return bundle.items?.find((i) => i.id === id)?.name ?? 'Item';
    default:
      return `${kind} (${id})`;
  }
}
