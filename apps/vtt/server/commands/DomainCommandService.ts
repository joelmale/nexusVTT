import crypto from 'crypto';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.js';
import type { DomainCommandReceiptRecord } from '../repositories/base.js';
import type {
  DomainCommand,
  DomainCommandPayload,
  DomainCommandReceipt,
} from '@nexus/game-contracts';

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
}
