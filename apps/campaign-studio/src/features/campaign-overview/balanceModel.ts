import type {
  CampaignEncounter,
  CampaignFixtureBundle,
  CampaignSession,
} from '@/demo/fixture-registry';
import {
  buildMonsterCatalog,
  rateComposition,
} from '../encounters/monsterCatalog';
import {
  calculateItemsWealth,
  evaluatePartyWealth,
  resolvePartyLevels,
} from '../items/wealthTracker';

export type EncounterDifficultyTier =
  | 'trivial'
  | 'low'
  | 'moderate'
  | 'high'
  | 'deadly';

export type BalanceHealthStatus = 'balanced' | 'caution' | 'danger';

export interface EncounterBalanceItem {
  id: string;
  title: string;
  kind: string;
  rating: EncounterDifficultyTier;
  xp: number;
  creatureCount: number;
  unrated: string[];
}

export interface BalanceModel {
  sessionId?: string;
  sessionTitle: string;
  partySize: number;
  averageLevel: number;
  partyLevels: number[];
  edition: '2014' | '2024';
  encounters: EncounterBalanceItem[];
  totalEncounterXp: number;
  budgetPerEncounter: {
    low: number;
    moderate: number;
    high: number;
    deadly?: number;
  };
  dailyXpBudget: number;
  highestRating: EncounterDifficultyTier;
  wealth: {
    totalGp: number;
    scheduledSessionGp: number;
    status: 'below' | 'expected' | 'above';
    label: string;
    tier: number;
    minGp: number;
    maxGp: number;
  };
  warnings: string[];
  healthStatus: BalanceHealthStatus;
}

const RATING_SEVERITY: Record<EncounterDifficultyTier, number> = {
  trivial: 0,
  low: 1,
  moderate: 2,
  high: 3,
  deadly: 4,
};

/**
 * Builds the comprehensive balance model for a session or campaign.
 * Evaluates 2024/2014 encounter XP budgets, combat lethality, and DMG party wealth guidelines.
 */
export function buildBalanceModel(
  bundle: CampaignFixtureBundle,
  preferredSessionId?: string,
): BalanceModel {
  const edition = bundle.campaign.edition === '2014' ? '2014' : '2024';

  const sId =
    preferredSessionId ||
    bundle.campaign.currentSessionId ||
    bundle.catalog.selectedSessionId;
  const session: CampaignSession | undefined =
    bundle.sessions.find((s) => s.id === sId) ?? bundle.sessions[0];

  // Party stats: bundle.campaign.playerCharacters levels; if empty, use current session's partyLevel before falling back to [1, 1, 1, 1]
  const partyLevels = resolvePartyLevels(
    bundle.campaign?.playerCharacters,
    session?.partyLevel,
  );
  const partySize = partyLevels.length;
  const averageLevel =
    Math.round(
      (partyLevels.reduce((sum, lvl) => sum + lvl, 0) / partySize) * 10,
    ) / 10;

  // Filter encounters relevant to session (or all if session has none linked)
  const candidateEncounters: CampaignEncounter[] = session
    ? bundle.encounters.filter((e) => e.sessionIds.includes(session.id))
    : bundle.encounters;

  const relevantEncounters =
    candidateEncounters.length > 0 ? candidateEncounters : bundle.encounters;

  const catalog = buildMonsterCatalog(bundle.homebrewMonsters);

  let totalEncounterXp = 0;
  let highestRating: EncounterDifficultyTier = 'trivial';
  const partyBudgetAccumulator = { low: 0, moderate: 0, high: 0, deadly: 0 };

  const encounters: EncounterBalanceItem[] = relevantEncounters.map((enc) => {
    const ratingResult = rateComposition(
      enc.composition,
      catalog,
      partyLevels,
      edition,
    );

    let rating: EncounterDifficultyTier = 'trivial';
    let xp = 0;
    let creatureCount = 0;

    for (const comp of enc.composition) {
      if (!comp.nonCreature) {
        creatureCount += Math.max(0, comp.count);
      }
    }

    if (ratingResult.result) {
      rating = ratingResult.result.rating;
      xp = ratingResult.result.rawXp || ratingResult.result.xp;

      // Accumulate sample encounter budgets
      partyBudgetAccumulator.low = Math.max(
        partyBudgetAccumulator.low,
        ratingResult.result.budget.low,
      );
      partyBudgetAccumulator.moderate = Math.max(
        partyBudgetAccumulator.moderate,
        ratingResult.result.budget.moderate,
      );
      partyBudgetAccumulator.high = Math.max(
        partyBudgetAccumulator.high,
        ratingResult.result.budget.high,
      );
      if (ratingResult.result.budget.deadly) {
        partyBudgetAccumulator.deadly = Math.max(
          partyBudgetAccumulator.deadly,
          ratingResult.result.budget.deadly,
        );
      }
    } else {
      // Fallback mapping if composition is empty
      if (enc.difficulty === 'high') rating = 'high';
      else if (enc.difficulty === 'moderate') rating = 'moderate';
      else rating = 'low';
    }

    totalEncounterXp += xp;

    if (RATING_SEVERITY[rating] > RATING_SEVERITY[highestRating]) {
      highestRating = rating;
    }

    return {
      id: enc.id,
      title: enc.title,
      kind: enc.kind,
      rating,
      xp,
      creatureCount,
      unrated: ratingResult.unrated,
    };
  });

  // Calculate standard reference budgets if no encounters had rated monsters
  if (partyBudgetAccumulator.high === 0) {
    // 2024 standard high threshold ~400-500 XP per character at early levels
    const estHighPerChar = Math.max(100, Math.round(averageLevel * 300));
    partyBudgetAccumulator.low = Math.round(estHighPerChar * 0.3 * partySize);
    partyBudgetAccumulator.moderate = Math.round(
      estHighPerChar * 0.6 * partySize,
    );
    partyBudgetAccumulator.high = Math.round(estHighPerChar * partySize);
  }

  // Daily budget estimate (~3 high encounters per adventuring day)
  const dailyXpBudget = partyBudgetAccumulator.high * 3;

  // Wealth tracking
  const campaignItems = bundle.items ?? [];
  const totalWealthGp = calculateItemsWealth(campaignItems);
  const wealthEval = evaluatePartyWealth(totalWealthGp, partySize, averageLevel);

  const sessionItems = session
    ? campaignItems.filter((i) => i.sessionId === session.id)
    : [];
  const scheduledSessionGp = calculateItemsWealth(sessionItems);

  // Generate actionable warnings (warns, never blocks)
  const warnings: string[] = [];

  const deadlyEncounters = encounters.filter((e) => e.rating === 'deadly');
  if (deadlyEncounters.length > 0) {
    const names = deadlyEncounters.map((e) => `"${e.title}"`).join(', ');
    warnings.push(
      `High lethal risk: ${names} rated Deadly for ${partySize} level ${averageLevel} characters.`,
    );
  }

  if (totalEncounterXp > dailyXpBudget && encounters.length > 1) {
    warnings.push(
      `High stamina drain: Combined encounters (${totalEncounterXp} XP) exceed party's estimated daily XP budget (${dailyXpBudget} XP). Consider planning a Short Rest.`,
    );
  }

  if (wealthEval.status === 'below') {
    warnings.push(
      `Treasure deficit: Total campaign wealth (${totalWealthGp} gp) is below recommended Tier ${wealthEval.range.tier} threshold (${wealthEval.range.minGp} gp).`,
    );
  }

  let healthStatus: BalanceHealthStatus = 'balanced';
  if (deadlyEncounters.length > 0 || totalEncounterXp > dailyXpBudget * 1.25) {
    healthStatus = 'danger';
  } else if (warnings.length > 0) {
    healthStatus = 'caution';
  }

  return {
    sessionId: session?.id,
    sessionTitle: session?.title ?? 'Active Session',
    partySize,
    averageLevel,
    partyLevels,
    edition,
    encounters,
    totalEncounterXp,
    budgetPerEncounter: partyBudgetAccumulator,
    dailyXpBudget,
    highestRating,
    wealth: {
      totalGp: totalWealthGp,
      scheduledSessionGp,
      status: wealthEval.status,
      label: wealthEval.label,
      tier: wealthEval.range.tier,
      minGp: wealthEval.range.minGp,
      maxGp: wealthEval.range.maxGp,
    },
    warnings,
    healthStatus,
  };
}
