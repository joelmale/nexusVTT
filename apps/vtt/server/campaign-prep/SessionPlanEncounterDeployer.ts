import crypto from 'crypto';
import type { DomainCommand, SessionPlan } from '@nexus/game-contracts';
import { domainCommandSchema } from '@nexus/game-contracts';

import type { DatabaseService } from '../database.js';
import { SessionPlanActivationError } from '../repositories/CampaignPrepRepository.js';
import type { SessionPlanActivationRecord } from '../repositories/base.js';

export interface DeployActivationEncounterRequest {
  campaignId: string;
  activationId: string;
  stepId: string;
  principalId: string;
  sceneId: string;
  anchorPosition: { x: number; y: number };
  hiddenFromPlayers: boolean;
}

export interface DeployActivationEncounterResult {
  encounterRunId: string;
  /** True when this step had already been deployed and nothing new was created. */
  duplicate: boolean;
  activation: SessionPlanActivationRecord;
}

type DeployerDatabase = Pick<
  DatabaseService,
  'campaignPrep' | 'commandReceipts' | 'domainCommands'
>;

const RECORD_ATTEMPTS = 3;

/**
 * Stable command id for one (activation, step) pair. The command receipt table
 * then guarantees a single DeployEncounter execution across retries, reconnects
 * and server restarts.
 */
export function deploymentCommandId(
  activationId: string,
  stepId: string,
): string {
  const bytes = crypto
    .createHash('sha256')
    .update(`session-plan-encounter:${activationId}:${stepId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function runIdFromReceipt(receipt: unknown): string | undefined {
  const id = (
    receipt as { result?: { data?: { encounterRunId?: unknown } } } | null
  )?.result?.data?.encounterRunId;
  return typeof id === 'string' ? id : undefined;
}

function storedRunId(
  activation: SessionPlanActivationRecord,
  stepId: string,
): string | undefined {
  const state = activation.stepStates?.[stepId] as
    { encounterRunId?: unknown } | undefined;
  return typeof state?.encounterRunId === 'string'
    ? state.encounterRunId
    : undefined;
}

export class SessionPlanEncounterDeployer {
  constructor(private readonly db: DeployerDatabase) {}

  async deploy(
    request: DeployActivationEncounterRequest,
  ): Promise<DeployActivationEncounterResult> {
    const loaded = await this.db.campaignPrep.getActivation(
      request.campaignId,
      request.activationId,
    );
    if (!loaded) {
      throw new SessionPlanActivationError(
        'Session plan activation not found',
        'not-found',
      );
    }
    if (loaded.activation.status !== 'active') {
      throw new SessionPlanActivationError(
        'Only an active session plan can deploy encounters',
        'inactive',
      );
    }
    const step = (loaded.plan as SessionPlan).steps.find(
      (candidate) => candidate.id === request.stepId,
    );
    if (!step || step.type !== 'deploy-encounter') {
      throw new SessionPlanActivationError(
        'The requested step is not an encounter deployment step',
        'invalid-step',
      );
    }

    const existing = storedRunId(loaded.activation, request.stepId);
    if (existing) {
      return {
        encounterRunId: existing,
        duplicate: true,
        activation: loaded.activation,
      };
    }

    const commandId = deploymentCommandId(request.activationId, request.stepId);
    let encounterRunId = runIdFromReceipt(
      (await this.db.commandReceipts.getReceipt(commandId))?.result,
    );
    let duplicate = Boolean(encounterRunId);

    if (!encounterRunId) {
      const command: DomainCommand = domainCommandSchema.parse({
        commandId,
        protocolVersion: '1.0',
        campaignId: request.campaignId,
        issuerUserId: request.principalId,
        timestamp: new Date().toISOString(),
        expectedActorVersions: {},
        payload: {
          type: 'DeployEncounter',
          templateRef: step.encounterRef,
          sceneId: request.sceneId,
          anchorPosition: request.anchorPosition,
          hiddenFromPlayers: request.hiddenFromPlayers,
        },
      });

      try {
        const executed = await this.db.domainCommands.execute(command, {
          principalId: request.principalId,
          isDm: true,
        });
        if (!executed.receipt.result.success) {
          throw new SessionPlanActivationError(
            executed.receipt.result.error || 'Encounter deployment rejected',
            'conflict',
          );
        }
        encounterRunId = runIdFromReceipt(executed.receipt);
        duplicate = Boolean(executed.duplicate);
      } catch (error) {
        // A concurrent deploy of the same step committed first; its receipt
        // is the single source of truth.
        const raced = runIdFromReceipt(
          (await this.db.commandReceipts.getReceipt(commandId))?.result,
        );
        if (!raced) throw error;
        encounterRunId = raced;
        duplicate = true;
      }
    }

    if (!encounterRunId) {
      throw new Error('Encounter deployment did not return an encounter run');
    }

    const activation = await this.recordRun(request, encounterRunId);
    return { encounterRunId, duplicate, activation };
  }

  private async recordRun(
    request: DeployActivationEncounterRequest,
    encounterRunId: string,
  ): Promise<SessionPlanActivationRecord> {
    for (let attempt = 1; ; attempt++) {
      const fresh = await this.db.campaignPrep.getActivation(
        request.campaignId,
        request.activationId,
      );
      if (!fresh) {
        throw new SessionPlanActivationError(
          'Session plan activation not found',
          'not-found',
        );
      }
      const recorded = storedRunId(fresh.activation, request.stepId);
      if (recorded) return fresh.activation;

      const prior = fresh.activation.stepStates?.[request.stepId];
      try {
        return await this.db.campaignPrep.updateSessionPlanActivationProgress({
          campaignId: request.campaignId,
          activationId: request.activationId,
          expectedRevision: fresh.activation.revision,
          stepStates: {
            [request.stepId]: {
              ...(typeof prior === 'object' && prior !== null ? prior : {}),
              encounterRunId,
              deployedAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        const conflict =
          error instanceof SessionPlanActivationError &&
          error.code === 'conflict';
        if (!conflict || attempt >= RECORD_ATTEMPTS) throw error;
      }
    }
  }
}
