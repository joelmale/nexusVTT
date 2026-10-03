import type {
  CampaignClue,
  CampaignEncounter,
  CampaignFaction,
  CampaignHandout,
  CampaignLocation,
  CampaignNpc,
  CampaignQuest,
  CampaignSession,
  PlanDependency,
  QuestObjective,
  ReadinessItem,
  SessionPlan,
  SessionPlanStep,
} from '@/demo/ashes-of-veyra/types';

export interface SpineGeneratorOptions {
  campaignTitle?: string;
  sessionNumber: number;
  targetDurationMinutes?: number;
  previousSession?: CampaignSession;
  quests?: CampaignQuest[];
  objectives?: QuestObjective[];
  primaryLocation?: CampaignLocation;
  encounters?: CampaignEncounter[];
  npcs?: CampaignNpc[];
  factions?: CampaignFaction[];
  handouts?: CampaignHandout[];
  clues?: CampaignClue[];
}

export interface GeneratedSessionSpine {
  suggestedTitle: string;
  suggestedSummary: string;
  playerFacingSummary: string;
  plan: SessionPlan;
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generates an evocative session title suggestion from the primary quest, location, or encounter.
 */
export function generateSuggestedTitle(options: SpineGeneratorOptions): string {
  const { primaryLocation, quests, encounters, sessionNumber } = options;

  if (quests && quests.length > 0 && quests[0].title) {
    const qTitle = quests[0].title;
    if (primaryLocation?.name) {
      return `${qTitle}: ${primaryLocation.name}`;
    }
    return qTitle;
  }

  if (primaryLocation?.name) {
    return `Expedition to ${primaryLocation.name}`;
  }

  if (encounters && encounters.length > 0 && encounters[0].title) {
    return `Confrontation: ${encounters[0].title}`;
  }

  return `Session ${sessionNumber} Journey`;
}

/**
 * Synthesizes selected campaign entities into a cohesive, paced 5-8 beat session spine.
 */
export function generateSessionSpine(
  options: SpineGeneratorOptions,
): GeneratedSessionSpine {
  const {
    campaignTitle = 'the campaign',
    sessionNumber,
    targetDurationMinutes = 240, // 4 hours default
    previousSession,
    quests = [],
    objectives = [],
    primaryLocation,
    encounters = [],
    npcs = [],
    factions = [],
    handouts = [],
    clues = [],
  } = options;

  const steps: SessionPlanStep[] = [];
  const readiness: ReadinessItem[] = [];
  const dependencies: PlanDependency[] = [];
  const attachments: string[] = [];

  let order = 1;

  // 1. Opening Recap Beat (15-20 min)
  const recapDuration = Math.round(targetDurationMinutes * 0.08);
  const recapBody = previousSession?.summary
    ? `Recap previous events from Session #${previousSession.number} ("${previousSession.title}"): ${previousSession.summary}. Re-establish current party position, resting status, and immediate goals.`
    : `Set the stage for Session #${sessionNumber}. Highlight where the party left off and remind them of active campaign threads in ${campaignTitle}.`;

  steps.push({
    id: generateId('step-recap'),
    order: order++,
    kind: 'recap',
    track: 'main',
    title: `Opening Recap: Session #${sessionNumber - 1 > 0 ? sessionNumber - 1 : 1} Follow-up`,
    durationMinutes: Math.max(15, recapDuration),
    visibility: 'shared',
    body: recapBody,
  });

  // 2. Establishing Scene / Arrival Beat (25-35 min)
  const sceneDuration = Math.round(targetDurationMinutes * 0.12);
  const locationName = primaryLocation?.name ?? 'the current area';
  const locationDesc = primaryLocation?.shortDescription
    ? ` ${primaryLocation.shortDescription}`
    : '';

  steps.push({
    id: generateId('step-scene'),
    order: order++,
    kind: 'scene',
    track: 'main',
    title: `Arrival at ${locationName}`,
    durationMinutes: Math.max(25, sceneDuration),
    visibility: 'shared',
    objectId: primaryLocation?.id,
    body: `Establish sensory atmosphere, lighting, and ambient details at ${locationName}.${locationDesc} Transition from the journey into active exploration.`,
  });

  if (primaryLocation) {
    dependencies.push({
      objectId: primaryLocation.id,
      status: 'ready',
    });
    readiness.push({
      id: generateId('ready-loc'),
      label: `Prepare map and ambient description for ${primaryLocation.name}`,
      complete: Boolean(primaryLocation.shortDescription),
    });
  }

  // 3. Social or Investigation Beat (NPCs / Factions / Quests) (35-50 min)
  if (npcs.length > 0 || factions.length > 0 || objectives.length > 0) {
    const socialDuration = Math.round(targetDurationMinutes * 0.18);
    const featuredNpc = npcs[0];
    const featuredFaction = factions[0];
    const featuredObjective = objectives[0];

    let socialTitle = 'Investigation & Discovery';
    let socialBody = 'The party seeks clues and examines their surroundings.';

    if (featuredNpc) {
      socialTitle = `Encounter: ${featuredNpc.name}`;
      socialBody = `Interaction with ${featuredNpc.name} (${featuredNpc.role}). Motivation: ${featuredNpc.motivation || 'Guarded'}. Relationship: ${featuredNpc.relationship || 'Cautious'}.`;
      dependencies.push({
        objectId: featuredNpc.id,
        status: 'ready',
      });
      readiness.push({
        id: generateId('ready-npc'),
        label: `Review roleplay notes and motivation for ${featuredNpc.name}`,
        complete: true,
      });
    } else if (featuredFaction) {
      socialTitle = `Faction Tension: ${featuredFaction.name}`;
      socialBody = `Navigating presence or patrols of ${featuredFaction.name} (${featuredFaction.status}). Public face: ${featuredFaction.publicFace}.`;
      dependencies.push({
        objectId: featuredFaction.id,
        status: 'ready',
      });
    }

    if (featuredObjective) {
      socialBody += ` Primary focus: Advance objective "${featuredObjective.title}".`;
    }

    steps.push({
      id: generateId('step-social'),
      order: order++,
      kind: featuredNpc ? 'scene' : 'choice',
      track: 'main',
      title: socialTitle,
      durationMinutes: Math.max(30, socialDuration),
      visibility: 'shared',
      objectId: featuredNpc?.id ?? featuredFaction?.id,
      body: socialBody,
    });
  }

  // 4. Primary Combat, Trap, or Hazard Encounter (50-75 min)
  if (encounters.length > 0) {
    const encounter = encounters[0];
    const encounterDuration = Math.round(targetDurationMinutes * 0.25);
    const compDesc = encounter.composition
      .map((c) => `${c.count}x ${c.name}${c.cr ? ` (CR ${c.cr})` : ''}`)
      .join(', ');

    let encBody = `Deploy ${encounter.title} (${encounter.difficulty} difficulty, ${encounter.kind}).`;
    if (compDesc) encBody += ` Enemies: ${compDesc}.`;
    if (encounter.tactics) encBody += ` Tactics: ${encounter.tactics}.`;
    if (encounter.trapDetails) {
      encBody += ` Trap mechanism: ${encounter.trapDetails.complexity} (Detect DC ${encounter.trapDetails.detectionDc ?? 10}, Disarm DC ${encounter.trapDetails.disarmDc ?? 10}).`;
    }

    steps.push({
      id: generateId('step-encounter'),
      order: order++,
      kind: 'encounter',
      track: 'main',
      title: `${encounter.kind === 'trap' ? 'Trap / Hazard' : 'Combat'}: ${encounter.title}`,
      durationMinutes: Math.max(45, encounterDuration),
      visibility: 'dm-only',
      objectId: encounter.id,
      body: encBody,
    });

    dependencies.push({
      objectId: encounter.id,
      status: 'ready',
    });
    readiness.push({
      id: generateId('ready-enc'),
      label: `Review monster statblocks & battle tactics for ${encounter.title}`,
      complete: encounter.composition.length > 0,
    });

    // Secondary encounter as parallel / branch beat if multiple selected
    if (encounters.length > 1) {
      const secEncounter = encounters[1];
      steps.push({
        id: generateId('step-sec-enc'),
        order: order++,
        kind: 'encounter',
        track: 'parallel',
        title: `Optional / Patrol Encounter: ${secEncounter.title}`,
        durationMinutes: 30,
        visibility: 'dm-only',
        objectId: secEncounter.id,
        body: `Optional complication or patrolling reinforcement: ${secEncounter.title} (${secEncounter.difficulty}). Trigger: ${secEncounter.trigger || 'If alarm sounds or noise is made'}.`,
      });
      dependencies.push({
        objectId: secEncounter.id,
        status: 'ready',
      });
    }
  }

  // 5. Handout / Clue / Lore Revelation Beat (15-25 min)
  if (handouts.length > 0 || clues.length > 0) {
    const handoutDuration = Math.round(targetDurationMinutes * 0.1);
    const featuredHandout = handouts[0];
    const featuredClue = clues[0];

    let handoutTitle = 'Uncover Clue / Handout';
    let handoutBody = 'The adventurers uncover critical documentation or evidence.';

    if (featuredHandout) {
      handoutTitle = `Handout: ${featuredHandout.title}`;
      handoutBody = `Provide player-facing handout "${featuredHandout.title}". Summary: ${featuredHandout.summary || 'Critical intel'}.`;
      attachments.push(featuredHandout.id);
      dependencies.push({
        objectId: featuredHandout.id,
        status: 'ready',
      });
      readiness.push({
        id: generateId('ready-doc'),
        label: `Prepare and verify handout visibility for "${featuredHandout.title}"`,
        complete: true,
      });
    } else if (featuredClue) {
      handoutTitle = `Clue Discovery: ${featuredClue.title}`;
      handoutBody = `Clue reveals: ${featuredClue.meaning}. Priority: ${featuredClue.priority}.`;
      dependencies.push({
        objectId: featuredClue.id,
        status: 'ready',
      });
    }

    steps.push({
      id: generateId('step-handout'),
      order: order++,
      kind: 'handout',
      track: 'main',
      title: handoutTitle,
      durationMinutes: Math.max(15, handoutDuration),
      visibility: 'shared',
      objectId: featuredHandout?.id ?? featuredClue?.id,
      body: handoutBody,
    });
  }

  // 6. Pivotal Decision Point / Dilemma (25-35 min)
  const choiceDuration = Math.round(targetDurationMinutes * 0.12);
  const qObjective = objectives[0];
  const choicePrompt = qObjective
    ? `How to resolve objective "${qObjective.title}": Negotiate, infiltrate, or force a breakthrough?`
    : factions.length > 1
      ? `Aligning with ${factions[0].name} or negotiating with ${factions[1].name}?`
      : 'Key fork in the road: choose the direct hazardous route or the subtle stealth approach.';

  steps.push({
    id: generateId('step-choice'),
    order: order++,
    kind: 'choice',
    track: 'main',
    title: 'Decision Point: Fork in the Path',
    durationMinutes: Math.max(20, choiceDuration),
    visibility: 'shared',
    body: choicePrompt,
  });

  // 7. Closing Beat & Cliffhanger (15-20 min)
  const closingDuration = Math.round(targetDurationMinutes * 0.08);
  steps.push({
    id: generateId('step-closing'),
    order: order++,
    kind: 'closing',
    track: 'main',
    title: 'Closing Beat & Cliffhanger',
    durationMinutes: Math.max(15, closingDuration),
    visibility: 'shared',
    body: 'Bring the session to a tense or meaningful conclusion. Distribute experience points / milestone progression and leave a cliffhanger for next week.',
  });

  // Standard readiness items
  readiness.push({
    id: generateId('ready-vtt'),
    label: 'Publish session plan and sync scene assets to Nexus VTT',
    complete: false,
  });

  // Calculate total minutes from beats
  const estimatedMinutes = steps.reduce(
    (sum, step) => sum + step.durationMinutes,
    0,
  );

  const suggestedTitle = generateSuggestedTitle(options);
  const locSnippet = primaryLocation ? ` at ${primaryLocation.name}` : '';
  const questSnippet = quests.length > 0 ? ` focusing on "${quests[0].title}"` : '';

  const suggestedSummary = `Session #${sessionNumber}${questSnippet}${locSnippet}. Includes ${steps.length} run-sheet beats covering exploration, encounters, and key decisions.`;
  const playerFacingSummary = `Prepare for Session #${sessionNumber} of ${campaignTitle}! Our heroes venture into ${locationName} to pursue urgent leads and face looming dangers.`;

  const notes = [
    `Session #${sessionNumber} authored with ${steps.length} beats.`,
    primaryLocation ? `Primary location: ${primaryLocation.name}.` : '',
    encounters.length > 0 ? `Primary encounter: ${encounters[0].title}.` : '',
    quests.length > 0 ? `Active quest: ${quests[0].title}.` : '',
  ].filter(Boolean);

  const plan: SessionPlan = {
    revision: 1,
    lastEdited: 'Just now',
    estimatedMinutes,
    readiness,
    dependencies,
    steps,
    notes,
    playerFacingSummary,
    attachments,
  };

  return {
    suggestedTitle,
    suggestedSummary,
    playerFacingSummary,
    plan,
  };
}
