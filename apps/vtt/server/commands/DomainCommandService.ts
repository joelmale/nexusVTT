import crypto from 'crypto';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.js';
import type { DomainCommandReceiptRecord, CampaignActorRecord } from '../repositories/base.js';
import type {
  DomainCommand,
  DomainCommandPayload,
  DomainCommandReceipt,
  SpellcastingProfile,
  SpellDefinition,
  ResourcePool,
  ActiveConcentration,
  CastRecord,
  ItemInstance,
  CampaignActor,
} from '@nexus/game-contracts';
import {
  evaluatePreparationPlan,
  evaluateCastEligibility,
} from '@nexus/rules-5e';

export interface DomainCommandContext {
  principalId: string;
  isDm?: boolean;
  roomId?: string;
}
export interface ExecuteCommandResponse {
  receipt: DomainCommandReceipt;
  duplicate?: boolean;
}

export class DomainCommandService {
  constructor(private readonly db: DatabaseService) {}

  private computePayloadHash(payload: DomainCommandPayload): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Authoritatively executes a domain command envelope inside a single PostgreSQL transaction.
   * Guarantees CAS concurrency checks and idempotency deduplication.
   */
  async execute(
    command: DomainCommand,
    context: DomainCommandContext,
  ): Promise<ExecuteCommandResponse> {
    const payloadHash = this.computePayloadHash(command.payload);

    // 1. Idempotency Check: check if receipt already exists
    const existingReceipt = await this.db.commandReceipts.getReceipt(
      command.commandId,
    );
    if (existingReceipt) {
      if (existingReceipt.payloadHash !== payloadHash) {
        throw new Error(
          `Command ID ${command.commandId} was already submitted with a different payload`,
        );
      }
      return {
        receipt: existingReceipt.result as DomainCommandReceipt,
        duplicate: true,
      };
    }

    // 2. Transactional execution
    return this.db.withTransaction(async (client: PoolClient) => {
      let receipt: DomainCommandReceipt;

      switch (command.payload.type) {
        case 'ApplyDamage': {
          receipt = await this.handleApplyDamage(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'HealActor': {
          receipt = await this.handleHealActor(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'AdmitCharacter': {
          receipt = await this.handleAdmitCharacter(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'DeployEncounter': {
          receipt = await this.handleDeployEncounter(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'StartEncounter': {
          receipt = await this.handleStartEncounter(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'AdvanceCombatTurn': {
          receipt = await this.handleAdvanceCombatTurn(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'ApplyPreparationPlan': {
          receipt = await this.handleApplyPreparationPlan(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'CastSpell': {
          receipt = await this.handleCastSpell(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'EndConcentration': {
          receipt = await this.handleEndConcentration(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'RestActor': {
          receipt = await this.handleRestActor(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        case 'TransferItem': {
          receipt = await this.handleTransferItem(
            command,
            command.payload,
            payloadHash,
            context,
            client,
          );
          break;
        }

        default: {
          const unhandledType = (command.payload as { type: string }).type;
          throw new Error(`Unsupported domain command type: ${unhandledType}`);
        }
      }

      // 3. Persist Receipt inside the same transaction
      const receiptRecord: DomainCommandReceiptRecord = {
        commandId: command.commandId,
        principalId: context.principalId,
        scopeKind: 'campaign',
        scopeId: command.campaignId,
        commandType: command.payload.type,
        payloadHash,
        committedAt: new Date(receipt.committedAt),
        result: receipt,
      };

      await this.db.commandReceipts.saveReceipt(receiptRecord, client);

      return { receipt };
    });
  }

  private async handleApplyDamage(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'ApplyDamage' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    const actor = await this.db.campaignActors.lockActorForUpdate(
      payload.targetActorId,
      client,
    );
    if (!actor) {
      throw new Error(`Target actor not found: ${payload.targetActorId}`);
    }

    // Authorization: owner or DM
    if (!context.isDm && actor.ownerId && actor.ownerId !== context.principalId) {
      throw new Error(
        `Principal ${context.principalId} is not authorized to damage actor ${actor.id}`,
      );
    }

    // CAS check on actor version if specified
    const expectedVersion = command.expectedActorVersions?.[actor.id];
    if (expectedVersion !== undefined && expectedVersion !== actor.stateVersion) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `State version mismatch: expected ${expectedVersion}, got ${actor.stateVersion}`,
        },
      };
    }

    // Apply 5e damage rules with temporary HP
    let remainingDamage = Math.max(0, payload.amount);
    let newTempHp = actor.tempHp;

    if (newTempHp > 0) {
      const absorbed = Math.min(newTempHp, remainingDamage);
      newTempHp -= absorbed;
      remainingDamage -= absorbed;
    }

    let newCurrentHp = actor.currentHp;
    let deathSaves = { ...actor.deathSaves };
    const conditions = [...actor.conditions];

    if (remainingDamage > 0) {
      if (newCurrentHp > 0) {
        newCurrentHp = Math.max(0, newCurrentHp - remainingDamage);
        if (newCurrentHp === 0) {
          // Drops to 0 HP: reset death saves and apply unconscious
          deathSaves = { successes: 0, failures: 0 };
          if (!conditions.includes('unconscious')) {
            conditions.push('unconscious');
          }
        }
      } else {
        // Already at 0 HP: damage causes death save failure
        deathSaves.failures = Math.min(3, deathSaves.failures + 1);
        if (deathSaves.failures >= 3 && !conditions.includes('dead')) {
          conditions.push('dead');
        }
      }
    }

    const updateResult = await this.db.campaignActors.updateActorState(
      actor.id,
      {
        expectedVersion: actor.stateVersion,
        currentHp: newCurrentHp,
        tempHp: newTempHp,
        conditions,
        deathSaves,
      },
      client,
    );

    if (updateResult.status === 'conflict') {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: updateResult.currentActor.stateVersion },
          error: 'Concurrent mutation conflict on actor update',
        },
      };
    }

    const updatedActor = updateResult.actor;
    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [updatedActor.id]: updatedActor.stateVersion },
        data: updatedActor,
      },
    };
  }

  private async handleHealActor(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'HealActor' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    const actor = await this.db.campaignActors.lockActorForUpdate(
      payload.targetActorId,
      client,
    );
    if (!actor) {
      throw new Error(`Target actor not found: ${payload.targetActorId}`);
    }

    const expectedVersion = command.expectedActorVersions?.[actor.id];
    if (expectedVersion !== undefined && expectedVersion !== actor.stateVersion) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `State version mismatch: expected ${expectedVersion}, got ${actor.stateVersion}`,
        },
      };
    }

    let newCurrentHp = actor.currentHp;
    let deathSaves = { ...actor.deathSaves };
    let conditions = [...actor.conditions];

    if (payload.amount > 0) {
      if (newCurrentHp === 0) {
        // Healing from 0 HP revives creature, clears unconscious and resets death saves
        deathSaves = { successes: 0, failures: 0 };
        conditions = conditions.filter((c) => c !== 'unconscious');
      }
      newCurrentHp = Math.min(actor.maxHp, newCurrentHp + payload.amount);
    }

    const updateResult = await this.db.campaignActors.updateActorState(
      actor.id,
      {
        expectedVersion: actor.stateVersion,
        currentHp: newCurrentHp,
        conditions,
        deathSaves,
      },
      client,
    );

    if (updateResult.status === 'conflict') {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: updateResult.currentActor.stateVersion },
          error: 'Concurrent mutation conflict on actor update',
        },
      };
    }

    const updatedActor = updateResult.actor;
    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [updatedActor.id]: updatedActor.stateVersion },
        data: updatedActor,
      },
    };
  }

  private async handleAdmitCharacter(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'AdmitCharacter' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    const characterId = payload.characterDefinitionRef.id;
    const character = await this.db.characters.getCharacterById(
      characterId,
      client,
    );
    if (!character) {
      throw new Error(`Character record not found: ${characterId}`);
    }

    // Check if character already admitted into this campaign
    const existingActors = await this.db.campaignActors.getActorsByCampaign(
      command.campaignId,
      client,
    );
    const alreadyAdmitted = existingActors.find((actor) => {
      const src = actor.sourceRef as { kind?: string; id?: string } | null;
      return src?.kind === 'character' && src?.id === character.id;
    });

    if (alreadyAdmitted) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: true,
          committedVersions: { [alreadyAdmitted.id]: alreadyAdmitted.stateVersion },
          data: alreadyAdmitted,
        },
      };
    }

    // Extract character HP / stats safely from character.data
    const data = (character.data as Record<string, unknown>) || {};
    const maxHp = Number(data.maxHp || data.hp || 10);
    const currentHp = Number(data.currentHp || data.hp || maxHp);

    const createdActor = await this.db.campaignActors.createActor(
      {
        campaignId: command.campaignId,
        sourceRef: { kind: 'character', id: character.id, revision: payload.characterDefinitionRef.revision },
        ownerId: character.ownerId,
        name: character.name,
        ruleset: {
          system: 'dnd5e',
          edition: '2024',
          contentPackId: 'srd-5.2.1',
          contentRevision: '1.0',
          rulesRevision: '2024.1',
        },
        stateVersion: 1,
        currentHp,
        maxHp,
        tempHp: 0,
        conditions: [],
        deathSaves: { successes: 0, failures: 0 },
        resourcePools: {},
        spellcastingProfiles: [],
        inventory: [],
        activeSessionId: null,
        payload: {
          kind: 'character',
          characterId: character.id,
          classes: Array.isArray(data.classes) ? data.classes : [],
          level: Number(data.level || 1),
          experiencePoints: Number(data.experiencePoints || 0),
          spellcasting: data.spellcasting || null,
        },
      },
      undefined,
      client,
    );

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [createdActor.id]: createdActor.stateVersion },
        data: createdActor,
      },
    };
  }

  private async handleDeployEncounter(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'DeployEncounter' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    if (!context.isDm) {
      throw new Error('Only the Dungeon Master can deploy encounters');
    }

    interface TemplateGroup {
      id?: string;
      monsterRef?: { kind: string; id: string; revision?: number };
      count: number;
      faction?: string;
      customName?: string;
      relativePlacements?: Array<{ x: number; y: number }>;
    }

    interface TemplateData {
      groups?: TemplateGroup[];
      ruleset?: unknown;
    }

    interface MonsterStatBlock {
      name?: string;
      hitPoints?: { average: number };
      armorClass?: Array<{ value: number }>;
      speed?: { walk?: number };
      abilities?: Record<string, { score: number; modifier: number }>;
    }

    // 1. Fetch encounter template from library_objects or fallback
    let templateData: TemplateData | null = null;

    if (payload.templateRef.revision) {
      const rev = await this.db.libraryObjects.getRevision(
        payload.templateRef.id,
        payload.templateRef.revision,
        client,
      );
      if (rev) templateData = rev.data as TemplateData;
    }
    if (!templateData) {
      const obj = await this.db.libraryObjects.getObjectById(
        payload.templateRef.id,
        client,
      );
      if (obj) {
        const rev = await this.db.libraryObjects.getRevision(
          obj.id,
          obj.currentRevision,
          client,
        );
        if (rev) templateData = rev.data as TemplateData;
      }
    }

    const groups: TemplateGroup[] = templateData?.groups || [
      {
        id: crypto.randomUUID(),
        monsterRef: { kind: 'monster', id: 'custom-monster' },
        count: 1,
        faction: 'hostile',
        customName: 'Creature',
      },
    ];

    const spawnedActorIds: string[] = [];
    const participants: Array<{
      actorId: string;
      initiativeRoll: number;
      hasActedThisRound: boolean;
      reactionUsed: boolean;
    }> = [];

    // 2. Iterate groups and spawn individual, isolated campaign_actors for multi-copy monster tracking
    let globalIndex = 0;
    for (const group of groups) {
      let monsterStatBlock: MonsterStatBlock | null = null;

      if (group.monsterRef?.id) {
        const mObj = await this.db.libraryObjects.getObjectById(
          group.monsterRef.id,
          client,
        );
        if (mObj) {
          const mRev = await this.db.libraryObjects.getRevision(
            mObj.id,
            mObj.currentRevision,
            client,
          );
          if (mRev) monsterStatBlock = mRev.data as MonsterStatBlock;
        }
      }

      const baseName = group.customName || monsterStatBlock?.name || 'Creature';
      const hp = monsterStatBlock?.hitPoints?.average ?? 10;

      for (let i = 0; i < group.count; i++) {
        globalIndex++;
        const actorId = crypto.randomUUID();
        const actorName = group.count > 1 ? `${baseName} #${i + 1}` : baseName;
        const relativeX =
          group.relativePlacements?.[i]?.x ?? (globalIndex - 1) * 50;
        const relativeY = group.relativePlacements?.[i]?.y ?? 0;

        await this.db.campaignActors.createActor(
          {
            campaignId: command.campaignId,
            sourceRef: group.monsterRef,
            ownerId: null, // NPC/Monster owned by campaign/DM
            name: actorName,
            ruleset: templateData?.ruleset ?? {
              system: 'dnd5e',
              edition: '2024',
            },
            currentHp: hp,
            maxHp: hp,
            tempHp: 0,
            conditions: [],
            deathSaves: { successes: 0, failures: 0 },
            resourcePools: {},
            spellcastingProfiles: [],
            inventory: [],
            activeSessionId: null,
            payload: {
              kind: 'monster',
              faction: group.faction || 'hostile',
              monsterData: monsterStatBlock,
              placement: {
                sceneId: payload.sceneId,
                x: payload.anchorPosition.x + relativeX,
                y: payload.anchorPosition.y + relativeY,
                hidden: payload.hiddenFromPlayers,
              },
            },
          },
          actorId,
          client,
        );

        spawnedActorIds.push(actorId);
        participants.push({
          actorId,
          initiativeRoll: 0,
          hasActedThisRound: false,
          reactionUsed: false,
        });
      }
    }

    // 3. Create EncounterRun record
    const runId = crypto.randomUUID();
    await this.db.encounterRuns.createRun(
      {
        id: runId,
        campaignId: command.campaignId,
        templateRef: payload.templateRef,
        stage: 'deployed',
        deploymentCommandId: command.commandId,
        activeSessionId: null,
        currentRound: 1,
        currentTurnIndex: 0,
        activeWaveIndex: 0,
        participants,
      },
      client,
    );

    const committedVersions: Record<string, number> = {};
    for (const actorId of spawnedActorIds) {
      committedVersions[actorId] = 1;
    }

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions,
        data: {
          encounterRunId: runId,
          spawnedActorIds,
        },
      },
    };
  }

  private async handleStartEncounter(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'StartEncounter' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    if (!context.isDm) {
      throw new Error('Only the Dungeon Master can start encounters');
    }

    const run = await this.db.encounterRuns.getRunById(
      payload.encounterRunId,
      client,
    );
    if (!run) {
      throw new Error(`Encounter run not found: ${payload.encounterRunId}`);
    }

    // Assign initiative to participants
    const rawParticipants =
      (run.participants as Array<{
        actorId: string;
        initiativeRoll?: number;
      }>) || [];

    const participants = rawParticipants.map((p) => {
      const roll =
        p.initiativeRoll && p.initiativeRoll > 0
          ? p.initiativeRoll
          : Math.floor(Math.random() * 20) + 1;
      return {
        ...p,
        initiativeRoll: roll,
        hasActedThisRound: false,
        reactionUsed: false,
      };
    });

    participants.sort(
      (a, b) => (b.initiativeRoll ?? 0) - (a.initiativeRoll ?? 0),
    );

    await this.db.encounterRuns.updateRun(
      run.id,
      {
        stage: 'active',
        currentRound: 1,
        currentTurnIndex: 0,
        participants,
      },
      client,
    );

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: {},
        data: {
          encounterRunId: run.id,
          stage: 'active',
          currentRound: 1,
          currentTurnIndex: 0,
          activeParticipantId: participants[0]?.actorId,
        },
      },
    };
  }

  private async handleAdvanceCombatTurn(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'AdvanceCombatTurn' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    if (!context.isDm) {
      throw new Error('Only the Dungeon Master can advance combat turns');
    }

    const run = await this.db.encounterRuns.getRunById(
      payload.encounterRunId,
      client,
    );
    if (!run) {
      throw new Error(`Encounter run not found: ${payload.encounterRunId}`);
    }
    if (run.stage !== 'active') {
      throw new Error(`Encounter run is not active (stage: ${run.stage})`);
    }

    const participants =
      (run.participants as Array<{
        actorId: string;
        initiativeRoll?: number;
        hasActedThisRound?: boolean;
        reactionUsed?: boolean;
      }>) || [];

    let nextTurnIndex = run.currentTurnIndex + 1;
    let nextRound = run.currentRound;

    if (nextTurnIndex >= participants.length) {
      nextTurnIndex = 0;
      nextRound += 1;
      participants.forEach((p) => {
        p.hasActedThisRound = false;
        p.reactionUsed = false;
      });
    }

    if (participants[nextTurnIndex]) {
      participants[nextTurnIndex].reactionUsed = false;
    }

    await this.db.encounterRuns.updateRun(
      run.id,
      {
        currentRound: nextRound,
        currentTurnIndex: nextTurnIndex,
        participants,
      },
      client,
    );

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: {},
        data: {
          encounterRunId: run.id,
          currentRound: nextRound,
          currentTurnIndex: nextTurnIndex,
          activeParticipantId: participants[nextTurnIndex]?.actorId,
        },
      },
    };
  }

  private assertCanControlActor(
    actor: { id: string; ownerId: string | null },
    context: DomainCommandContext,
    action: string = 'modify',
  ): void {
    if (!context.isDm && actor.ownerId && actor.ownerId !== context.principalId) {
      throw new Error(
        `Principal ${context.principalId} is not authorized to ${action} actor ${actor.id}`,
      );
    }
  }

  private async handleApplyPreparationPlan(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'ApplyPreparationPlan' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    const actor = await this.db.campaignActors.lockActorForUpdate(
      payload.targetActorId,
      client,
    );
    if (!actor) {
      throw new Error(`Target actor not found: ${payload.targetActorId}`);
    }

    this.assertCanControlActor(actor, context, 'prepare spells for');

    const expectedVersion = command.expectedActorVersions?.[actor.id];
    if (expectedVersion !== undefined && expectedVersion !== actor.stateVersion) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `State version mismatch: expected ${expectedVersion}, got ${actor.stateVersion}`,
        },
      };
    }

    const profiles = (actor.spellcastingProfiles as SpellcastingProfile[]) || [];
    const profile = profiles.find((p) => p.profileId === payload.profileId);
    if (!profile) {
      throw new Error(
        `Spellcasting profile '${payload.profileId}' not found on actor ${actor.id}`,
      );
    }

    const valResult = evaluatePreparationPlan(profile, payload.preparedSpellSlugs);
    if (!valResult.isValid) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `Invalid preparation plan: ${valResult.errors.join('; ')}`,
        },
      };
    }

    profile.preparedSpellSlugs = [...payload.preparedSpellSlugs];

    const updateResult = await this.db.campaignActors.updateActorState(
      actor.id,
      {
        expectedVersion: actor.stateVersion,
        spellcastingProfiles: profiles,
      },
      client,
    );

    if (updateResult.status === 'conflict') {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: updateResult.currentActor.stateVersion },
          error: 'Concurrent mutation conflict on actor update',
        },
      };
    }

    const updatedActor = updateResult.actor;

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [actor.id]: updatedActor.stateVersion },
        data: {
          actorId: actor.id,
          profileId: payload.profileId,
          preparedSpellSlugs: profile.preparedSpellSlugs,
        },
      },
    };
  }

  private async handleCastSpell(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'CastSpell' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    const actor = await this.db.campaignActors.lockActorForUpdate(
      payload.actorId,
      client,
    );
    if (!actor) {
      throw new Error(`Actor not found: ${payload.actorId}`);
    }

    this.assertCanControlActor(actor, context, 'cast spell with');

    const expectedVersion = command.expectedActorVersions?.[actor.id];
    if (expectedVersion !== undefined && expectedVersion !== actor.stateVersion) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `State version mismatch: expected ${expectedVersion}, got ${actor.stateVersion}`,
        },
      };
    }

    let spellDef: SpellDefinition | null = null;
    if (payload.spellRef.revision) {
      const rev = await this.db.libraryObjects.getRevision(
        payload.spellRef.id,
        payload.spellRef.revision,
        client,
      );
      if (rev) spellDef = rev.data as SpellDefinition;
    }
    if (!spellDef) {
      const obj = await this.db.libraryObjects.getObjectById(
        payload.spellRef.id,
        client,
      );
      if (obj) {
        const rev = await this.db.libraryObjects.getRevision(
          obj.id,
          obj.currentRevision,
          client,
        );
        if (rev) spellDef = rev.data as SpellDefinition;
      }
    }

    const effectiveSpellDef: SpellDefinition = spellDef || {
      id: payload.spellRef.id,
      kind: 'spell',
      ruleset: {
        system: 'dnd5e',
        edition: '2024',
        contentPackId: 'srd-5.2.1',
        contentRevision: '1.0',
        rulesRevision: '2024.1',
      },
      name: payload.spellRef.id,
      slug: payload.spellRef.id,
      level: payload.castAtLevel,
      school: 'evocation',
      castingTime: '1 action',
      range: '60 feet',
      duration: 'Instantaneous',
      concentration: false,
      ritual: false,
      components: {
        verbal: true,
        somatic: true,
        material: false,
        materialConsumed: false,
      },
      description: 'Spell',
      classes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: context.principalId,
      schemaVersion: 1,
      revision: 1,
      tags: [],
      archived: false,
    };

    const profiles = (actor.spellcastingProfiles as SpellcastingProfile[]) || [];
    const pools = (actor.resourcePools as Record<string, ResourcePool>) || {};

    const evalResult = evaluateCastEligibility({
      actor: {
        ...actor,
        spellcastingProfiles: profiles,
        resourcePools: pools,
      } as unknown as CampaignActor,
      spell: effectiveSpellDef,
      profileId: payload.profileId,
      castAtLevel: payload.castAtLevel,
    });

    if (!evalResult.canCast) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `Cast ineligible: ${evalResult.reasons.join('; ')}`,
        },
      };
    }

    const consumedResources: Array<{ poolId: string; amount: number; slotLevel?: number }> = [];
    if (evalResult.poolIdToCharge) {
      const pool = pools[evalResult.poolIdToCharge];
      if (pool) {
        if (pool.poolType === 'slots' && evalResult.slotLevelToCharge) {
          const slotKey = evalResult.slotLevelToCharge.toString();
          const slot = pool.slots?.[slotKey];
          if (slot && slot.current > 0) {
            slot.current -= 1;
            consumedResources.push({
              poolId: pool.id,
              amount: 1,
              slotLevel: evalResult.slotLevelToCharge,
            });
          }
        } else if (pool.poolType === 'pact') {
          if (pool.current && pool.current > 0) {
            pool.current -= 1;
            consumedResources.push({
              poolId: pool.id,
              amount: 1,
            });
          }
        }
      }
    }

    let newConcentration: ActiveConcentration | null = null;
    if (effectiveSpellDef.concentration) {
      newConcentration = {
        castId: command.commandId,
        spellRef: payload.spellRef,
        spellName: effectiveSpellDef.name,
        startedAtRound: 1,
        startedAtTurn: 0,
        targetActorIds: payload.targetActorIds || [],
        drawingIds: [],
      };
    }

    const currentPayload = (actor.payload as Record<string, unknown>) || {};
    const updatedPayload = {
      ...currentPayload,
      concentration: newConcentration ?? (evalResult.willBreakConcentration ? null : currentPayload.concentration),
    };

    const updateResult = await this.db.campaignActors.updateActorState(
      actor.id,
      {
        expectedVersion: actor.stateVersion,
        resourcePools: pools,
        payload: updatedPayload,
      },
      client,
    );

    if (updateResult.status === 'conflict') {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: updateResult.currentActor.stateVersion },
          error: 'Concurrent mutation conflict on actor update',
        },
      };
    }

    const updatedActor = updateResult.actor;

    const castRecord: CastRecord = {
      castId: command.commandId,
      campaignActorId: actor.id,
      spellRef: payload.spellRef,
      spellName: effectiveSpellDef.name,
      castAtLevel: payload.castAtLevel,
      sourceProfileId: payload.profileId,
      consumedResources,
      targets: payload.targetActorIds || [],
      state: 'resolved',
      timestamp: new Date().toISOString(),
    };

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [actor.id]: updatedActor.stateVersion },
        data: {
          castRecord,
          remainingPools: pools,
        },
      },
    };
  }

  private async handleEndConcentration(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'EndConcentration' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    const actor = await this.db.campaignActors.lockActorForUpdate(
      payload.actorId,
      client,
    );
    if (!actor) {
      throw new Error(`Actor not found: ${payload.actorId}`);
    }

    this.assertCanControlActor(actor, context, 'end concentration for');

    const expectedVersion = command.expectedActorVersions?.[actor.id];
    if (expectedVersion !== undefined && expectedVersion !== actor.stateVersion) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `State version mismatch: expected ${expectedVersion}, got ${actor.stateVersion}`,
        },
      };
    }

    const currentPayload = (actor.payload as Record<string, unknown>) || {};
    const updatedPayload = {
      ...currentPayload,
      concentration: null,
    };

    const updateResult = await this.db.campaignActors.updateActorState(
      actor.id,
      {
        expectedVersion: actor.stateVersion,
        payload: updatedPayload,
      },
      client,
    );

    if (updateResult.status === 'conflict') {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: updateResult.currentActor.stateVersion },
          error: 'Concurrent mutation conflict on actor update',
        },
      };
    }

    const updatedActor = updateResult.actor;

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [actor.id]: updatedActor.stateVersion },
        data: {
          actorId: actor.id,
          castId: payload.castId,
        },
      },
    };
  }

  private async handleRestActor(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'RestActor' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    const actor = await this.db.campaignActors.lockActorForUpdate(
      payload.actorId,
      client,
    );
    if (!actor) {
      throw new Error(`Actor not found: ${payload.actorId}`);
    }

    this.assertCanControlActor(actor, context, 'rest');

    const expectedVersion = command.expectedActorVersions?.[actor.id];
    if (expectedVersion !== undefined && expectedVersion !== actor.stateVersion) {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: actor.stateVersion },
          error: `State version mismatch: expected ${expectedVersion}, got ${actor.stateVersion}`,
        },
      };
    }

    let currentHp = actor.currentHp;
    let tempHp = actor.tempHp;
    let conditions = Array.isArray(actor.conditions) ? [...actor.conditions] : [];
    let deathSaves = (actor.deathSaves as { successes: number; failures: number }) || { successes: 0, failures: 0 };
    const pools = JSON.parse(JSON.stringify(actor.resourcePools || {})) as Record<string, ResourcePool>;

    if (payload.restType === 'long') {
      currentHp = actor.maxHp;
      tempHp = 0;
      deathSaves = { successes: 0, failures: 0 };
      conditions = conditions.filter((c) => c !== 'unconscious');

      for (const pool of Object.values(pools)) {
        if (pool.poolType === 'slots' && pool.slots) {
          for (const slot of Object.values(pool.slots)) {
            slot.current = slot.total;
          }
        } else if (pool.poolType === 'pact') {
          pool.current = pool.max ?? pool.current;
        } else if (pool.max !== undefined) {
          pool.current = pool.max;
        }
      }
    } else {
      // Short rest
      for (const pool of Object.values(pools)) {
        if (pool.resetOn === 'short-rest') {
          if (pool.poolType === 'pact') {
            pool.current = pool.max ?? pool.current;
          } else if (pool.max !== undefined) {
            pool.current = pool.max;
          }
        }
      }

      if (payload.hitDiceToSpend && payload.hitDiceToSpend > 0) {
        const healPerDie = Math.max(1, Math.floor(actor.maxHp / 4));
        currentHp = Math.min(actor.maxHp, currentHp + payload.hitDiceToSpend * healPerDie);
        if (currentHp > 0) {
          conditions = conditions.filter((c) => c !== 'unconscious');
          deathSaves = { successes: 0, failures: 0 };
        }
      }
    }

    const updateResult = await this.db.campaignActors.updateActorState(
      actor.id,
      {
        expectedVersion: actor.stateVersion,
        currentHp,
        tempHp,
        conditions,
        deathSaves,
        resourcePools: pools,
      },
      client,
    );

    if (updateResult.status === 'conflict') {
      return {
        commandId: command.commandId,
        principalId: context.principalId,
        campaignId: command.campaignId,
        payloadHash,
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          committedVersions: { [actor.id]: updateResult.currentActor.stateVersion },
          error: 'Concurrent mutation conflict on actor update',
        },
      };
    }

    const updatedActor = updateResult.actor;

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions: { [actor.id]: updatedActor.stateVersion },
        data: {
          actorId: actor.id,
          restType: payload.restType,
          currentHp,
          resourcePools: pools,
        },
      },
    };
  }

  private async handleTransferItem(
    command: DomainCommand,
    payload: Extract<DomainCommandPayload, { type: 'TransferItem' }>,
    payloadHash: string,
    context: DomainCommandContext,
    client: PoolClient,
  ): Promise<DomainCommandReceipt> {
    if (!payload.sourceActorId && !payload.targetActorId) {
      throw new Error('TransferItem must specify at least sourceActorId or targetActorId');
    }

    const sourceId = payload.sourceActorId;
    const targetId = payload.targetActorId;

    let sourceActor: CampaignActorRecord | null = null;
    let targetActor: CampaignActorRecord | null = null;

    if (sourceId && targetId) {
      const [firstId, secondId] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
      const first = await this.db.campaignActors.lockActorForUpdate(firstId, client);
      const second = await this.db.campaignActors.lockActorForUpdate(secondId, client);
      sourceActor = sourceId === firstId ? first : second;
      targetActor = targetId === firstId ? first : second;
    } else if (sourceId) {
      sourceActor = await this.db.campaignActors.lockActorForUpdate(sourceId, client);
    } else if (targetId) {
      targetActor = await this.db.campaignActors.lockActorForUpdate(targetId, client);
    }

    if (sourceId && !sourceActor) {
      throw new Error(`Source actor not found: ${sourceId}`);
    }
    if (targetId && !targetActor) {
      throw new Error(`Target actor not found: ${targetId}`);
    }

    if (sourceActor) {
      this.assertCanControlActor(sourceActor, context, 'transfer items from');
      const expectedSourceVer = command.expectedActorVersions?.[sourceActor.id];
      if (expectedSourceVer !== undefined && expectedSourceVer !== sourceActor.stateVersion) {
        return {
          commandId: command.commandId,
          principalId: context.principalId,
          campaignId: command.campaignId,
          payloadHash,
          committedAt: new Date().toISOString(),
          result: {
            success: false,
            committedVersions: { [sourceActor.id]: sourceActor.stateVersion },
            error: `Source state version mismatch: expected ${expectedSourceVer}, got ${sourceActor.stateVersion}`,
          },
        };
      }
    }

    if (targetActor) {
      const expectedTargetVer = command.expectedActorVersions?.[targetActor.id];
      if (expectedTargetVer !== undefined && expectedTargetVer !== targetActor.stateVersion) {
        return {
          commandId: command.commandId,
          principalId: context.principalId,
          campaignId: command.campaignId,
          payloadHash,
          committedAt: new Date().toISOString(),
          result: {
            success: false,
            committedVersions: { [targetActor.id]: targetActor.stateVersion },
            error: `Target state version mismatch: expected ${expectedTargetVer}, got ${targetActor.stateVersion}`,
          },
        };
      }
    }

    const quantityToTransfer = payload.quantity ?? 1;
    const committedVersions: Record<string, number> = {};
    let transferredItem: ItemInstance | null = null;

    if (sourceActor) {
      const inventory = JSON.parse(JSON.stringify(sourceActor.inventory || [])) as ItemInstance[];
      const itemIndex = inventory.findIndex((item) => item.instanceId === payload.itemInstanceId);
      if (itemIndex === -1) {
        throw new Error(
          `Item instance ${payload.itemInstanceId} not found in actor ${sourceActor.id}'s inventory`,
        );
      }

      const existingItem = inventory[itemIndex];
      if (existingItem.quantity < quantityToTransfer) {
        throw new Error(
          `Insufficient item quantity to transfer: requested ${quantityToTransfer}, available ${existingItem.quantity}`,
        );
      } else if (existingItem.quantity === quantityToTransfer) {
        transferredItem = { ...existingItem };
        inventory.splice(itemIndex, 1);
      } else {
        existingItem.quantity -= quantityToTransfer;
        transferredItem = {
          ...existingItem,
          instanceId: crypto.randomUUID(),
          quantity: quantityToTransfer,
        };
      }

      const updateResult = await this.db.campaignActors.updateActorState(
        sourceActor.id,
        {
          expectedVersion: sourceActor.stateVersion,
          inventory,
        },
        client,
      );

      if (updateResult.status === 'conflict') {
        return {
          commandId: command.commandId,
          principalId: context.principalId,
          campaignId: command.campaignId,
          payloadHash,
          committedAt: new Date().toISOString(),
          result: {
            success: false,
            committedVersions: { [sourceActor.id]: updateResult.currentActor.stateVersion },
            error: 'Concurrent mutation conflict on source actor',
          },
        };
      }

      committedVersions[sourceActor.id] = updateResult.actor.stateVersion;
    }

    if (targetActor && transferredItem) {
      const inventory = JSON.parse(JSON.stringify(targetActor.inventory || [])) as ItemInstance[];
      inventory.push(transferredItem);

      const updateResult = await this.db.campaignActors.updateActorState(
        targetActor.id,
        {
          expectedVersion: targetActor.stateVersion,
          inventory,
        },
        client,
      );

      if (updateResult.status === 'conflict') {
        return {
          commandId: command.commandId,
          principalId: context.principalId,
          campaignId: command.campaignId,
          payloadHash,
          committedAt: new Date().toISOString(),
          result: {
            success: false,
            committedVersions: { [targetActor.id]: updateResult.currentActor.stateVersion },
            error: 'Concurrent mutation conflict on target actor',
          },
        };
      }

      committedVersions[targetActor.id] = updateResult.actor.stateVersion;
    }

    return {
      commandId: command.commandId,
      principalId: context.principalId,
      campaignId: command.campaignId,
      payloadHash,
      committedAt: new Date().toISOString(),
      result: {
        success: true,
        committedVersions,
        data: {
          transferredItem,
          sourceActorId: sourceId,
          targetActorId: targetId,
        },
      },
    };
  }
}
