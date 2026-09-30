import {
  campaignObjectRefKey,
  type CampaignObjectRef,
  type SessionPlan,
} from '@nexus/game-contracts';
import type { PoolClient } from 'pg';

import {
  BaseRepository,
  type CampaignPrepObjectKind,
  type CampaignPrepObjectLinkRecord,
  type CampaignPrepObjectRecord,
  type CampaignPrepObjectRevisionRecord,
  type CampaignPrepObjectStatus,
  type SessionPlanActivationRecord,
  type SessionPlanActivationStatus,
} from './base.js';

export class CampaignPrepRevisionConflictError extends Error {
  constructor(
    public readonly objectId: string,
    public readonly expectedRevision: number,
  ) {
    super(
      `Campaign prep object ${objectId} is no longer at revision ${expectedRevision}`,
    );
    this.name = 'CampaignPrepRevisionConflictError';
  }
}

export class SessionPlanActivationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'not-found'
      | 'not-ready'
      | 'invalid-revision'
      | 'inactive'
      | 'invalid-step'
      | 'conflict',
  ) {
    super(message);
    this.name = 'SessionPlanActivationError';
  }
}

interface CampaignPrepRevisionInput {
  revision: number;
  schemaVersion: number;
  data: unknown;
  dependencies: CampaignObjectRef[];
  createdBy: string;
  requestId: string;
}

interface CreateCampaignPrepObjectInput {
  id?: string;
  campaignId: string;
  kind: CampaignPrepObjectKind;
  title: string;
  status?: CampaignPrepObjectStatus;
  createdBy: string;
}

interface AddCampaignPrepRevisionInput extends CampaignPrepRevisionInput {
  title?: string;
  status?: CampaignPrepObjectStatus;
}

interface CampaignPrepObjectFilter {
  kind?: CampaignPrepObjectKind;
  status?: CampaignPrepObjectStatus;
}

export interface ActivateSessionPlanInput {
  campaignId: string;
  sessionPlanId: string;
  /** When given, must equal the plan's current (published) revision. */
  planRevision?: number;
  sessionId: string;
  activatedBy?: string | null;
  /** Activation command ID. Replaying it returns the original activation. */
  requestId: string;
}

export interface ActivateSessionPlanResult {
  activation: SessionPlanActivationRecord;
  plan: SessionPlan;
  /** True when `requestId` had already been committed. */
  replayed: boolean;
}

export interface UpdateSessionPlanActivationProgressInput {
  campaignId: string;
  activationId: string;
  /** The activation revision the caller observed. */
  expectedRevision: number;
  currentStepIndex?: number;
  /** Each entry replaces that step's state; other steps are untouched. */
  stepStates?: Record<string, unknown>;
  status?: SessionPlanActivationStatus;
}

export interface AdvanceSessionPlanActivationInput {
  campaignId: string;
  activationId: string;
  stepId: string;
  stepIndex: number;
  completedBy?: string;
  expectedRevision?: number;
}

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function mainTrackSteps(plan: SessionPlan): SessionPlan['steps'] {
  return (plan.steps ?? []).filter((step) => step.track !== 'parallel');
}

export class CampaignPrepRepository extends BaseRepository {
  async getObject(
    campaignId: string,
    objectId: string,
    client?: PoolClient,
  ): Promise<CampaignPrepObjectRecord | null> {
    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectRecord>(
      `SELECT * FROM campaign_objects
       WHERE "campaignId" = $1 AND id = $2`,
      [campaignId, objectId],
    );
    return result.rows[0] ?? null;
  }

  async getRevision(
    objectId: string,
    revision: number,
    client?: PoolClient,
  ): Promise<CampaignPrepObjectRevisionRecord | null> {
    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectRevisionRecord>(
      `SELECT * FROM campaign_object_revisions
         WHERE "objectId" = $1 AND revision = $2`,
      [objectId, revision],
    );
    return result.rows[0] ?? null;
  }

  async listObjects(
    campaignId: string,
    filter: CampaignPrepObjectFilter = {},
    client?: PoolClient,
  ): Promise<CampaignPrepObjectRecord[]> {
    const conditions = ['"campaignId" = $1'];
    const params: unknown[] = [campaignId];

    if (filter.kind) {
      params.push(filter.kind);
      conditions.push(`kind = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectRecord>(
      `SELECT * FROM campaign_objects
       WHERE ${conditions.join(' AND ')}
       ORDER BY "updatedAt" DESC`,
      params,
    );
    return result.rows;
  }

  async getBacklinks(
    reference: CampaignObjectRef,
    client?: PoolClient,
  ): Promise<CampaignPrepObjectLinkRecord[]> {
    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectLinkRecord>(
      `SELECT links.* FROM campaign_object_links links
         INNER JOIN campaign_objects objects
           ON objects.id = links."sourceObjectId"
          AND objects."currentRevision" = links."sourceRevision"
         WHERE links."targetKey" = $1
         ORDER BY links."createdAt" DESC`,
      [campaignObjectRefKey(reference)],
    );
    return result.rows;
  }

  async createObject(
    object: CreateCampaignPrepObjectInput,
    revision: CampaignPrepRevisionInput,
    client?: PoolClient,
  ): Promise<{
    object: CampaignPrepObjectRecord;
    revision: CampaignPrepObjectRevisionRecord;
  }> {
    return this.withTransaction(client, async (executor) => {
      const objectResult = await executor.query<CampaignPrepObjectRecord>(
        object.id
          ? `INSERT INTO campaign_objects
               (id, "campaignId", kind, title, "currentRevision", status, "createdBy", "updatedBy")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
             RETURNING *`
          : `INSERT INTO campaign_objects
               ("campaignId", kind, title, "currentRevision", status, "createdBy", "updatedBy")
             VALUES ($1, $2, $3, $4, $5, $6, $6)
             RETURNING *`,
        object.id
          ? [
              object.id,
              object.campaignId,
              object.kind,
              object.title,
              revision.revision,
              object.status ?? 'draft',
              object.createdBy,
            ]
          : [
              object.campaignId,
              object.kind,
              object.title,
              revision.revision,
              object.status ?? 'draft',
              object.createdBy,
            ],
      );
      const createdObject = objectResult.rows[0];
      const createdRevision = await this.insertRevision(
        createdObject.id,
        revision,
        executor,
      );
      await this.insertLinks(
        createdObject.id,
        revision.revision,
        revision.dependencies,
        executor,
      );

      return { object: createdObject, revision: createdRevision };
    });
  }

  async addRevision(
    campaignId: string,
    objectId: string,
    expectedRevision: number,
    revision: AddCampaignPrepRevisionInput,
    client?: PoolClient,
  ): Promise<{
    object: CampaignPrepObjectRecord;
    revision: CampaignPrepObjectRevisionRecord;
  }> {
    if (revision.revision !== expectedRevision + 1) {
      throw new Error(
        'The new revision must immediately follow the expected revision',
      );
    }

    return this.withTransaction(client, async (executor) => {
      const objectResult = await executor.query<CampaignPrepObjectRecord>(
        `UPDATE campaign_objects
         SET "currentRevision" = $3,
             title = COALESCE($4, title),
             status = COALESCE($5, status),
             "updatedBy" = $6,
             "updatedAt" = NOW()
         WHERE "campaignId" = $1
           AND id = $2
           AND "currentRevision" = $7
         RETURNING *`,
        [
          campaignId,
          objectId,
          revision.revision,
          revision.title ?? null,
          revision.status ?? null,
          revision.createdBy,
          expectedRevision,
        ],
      );
      const updatedObject = objectResult.rows[0];
      if (!updatedObject) {
        throw new CampaignPrepRevisionConflictError(objectId, expectedRevision);
      }

      const createdRevision = await this.insertRevision(
        objectId,
        revision,
        executor,
      );
      await this.insertLinks(
        objectId,
        revision.revision,
        revision.dependencies,
        executor,
      );

      return { object: updatedObject, revision: createdRevision };
    });
  }

  /**
   * Pins a published plan revision to a live session in one transaction.
   *
   * The activation row doubles as the command receipt: replaying the same
   * `requestId` returns it unchanged instead of restarting the run. A new
   * `requestId` for the same session is an explicit restart that completes
   * the prior run. Activations of one campaign session are serialized so at
   * most one stays active (also enforced by a partial unique index).
   */
  async activateSessionPlan(
    input: ActivateSessionPlanInput,
    client?: PoolClient,
  ): Promise<ActivateSessionPlanResult> {
    return this.withTransaction(client, async (executor) => {
      await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `session-plan-activation:${input.campaignId}:${input.sessionId}`,
      ]);

      const replay = await executor.query<SessionPlanActivationRecord>(
        `SELECT * FROM session_plan_activations
         WHERE "campaignId" = $1 AND "requestId" = $2`,
        [input.campaignId, input.requestId],
      );
      const existing = replay.rows[0];
      if (existing) {
        if (
          existing.sessionPlanId !== input.sessionPlanId ||
          existing.sessionId !== input.sessionId ||
          (input.planRevision !== undefined &&
            existing.planRevision !== input.planRevision)
        ) {
          throw new SessionPlanActivationError(
            `Activation request ${input.requestId} was already used for a different plan or session`,
            'conflict',
          );
        }
        const pinned = await this.getRevision(
          existing.sessionPlanId,
          existing.planRevision,
          executor,
        );
        if (!pinned) {
          throw new SessionPlanActivationError(
            `Session plan revision ${existing.planRevision} does not exist`,
            'invalid-revision',
          );
        }
        return {
          activation: existing,
          plan: pinned.data as SessionPlan,
          replayed: true,
        };
      }

      const object = await this.getObject(
        input.campaignId,
        input.sessionPlanId,
        executor,
      );
      if (!object || object.kind !== 'session-plan') {
        throw new SessionPlanActivationError(
          `Session plan ${input.sessionPlanId} not found in campaign ${input.campaignId}`,
          'not-found',
        );
      }
      if (object.status !== 'ready') {
        throw new SessionPlanActivationError(
          `Session plan ${input.sessionPlanId} is currently ${object.status}; only ready plans can be activated`,
          'not-ready',
        );
      }
      // Only the current revision of a ready plan passed publish validation;
      // earlier revisions may be unvalidated drafts.
      if (
        input.planRevision !== undefined &&
        input.planRevision !== object.currentRevision
      ) {
        throw new SessionPlanActivationError(
          `Session plan ${input.sessionPlanId} is published at revision ${object.currentRevision}, not ${input.planRevision}`,
          'conflict',
        );
      }

      const revisionNumber = object.currentRevision;
      const revision = await this.getRevision(
        object.id,
        revisionNumber,
        executor,
      );
      if (!revision) {
        throw new SessionPlanActivationError(
          `Session plan ${input.sessionPlanId} revision ${revisionNumber} does not exist`,
          'invalid-revision',
        );
      }

      // A new activation command for this session restarts the run.
      await executor.query(
        `UPDATE session_plan_activations
         SET status = 'completed',
             "completedAt" = COALESCE("completedAt", NOW()),
             revision = revision + 1,
             "updatedAt" = NOW()
         WHERE "campaignId" = $1 AND "sessionId" = $2 AND status = 'active'`,
        [input.campaignId, input.sessionId],
      );

      let inserted;
      try {
        inserted = await executor.query<SessionPlanActivationRecord>(
          `INSERT INTO session_plan_activations
             ("campaignId", "sessionPlanId", "planRevision", "sessionId", "currentStepIndex", status, "stepStates", "activatedBy", "requestId")
           VALUES ($1, $2, $3, $4, 0, 'active', '{}'::jsonb, $5, $6)
           RETURNING *`,
          [
            input.campaignId,
            input.sessionPlanId,
            revisionNumber,
            input.sessionId,
            input.activatedBy ?? null,
            input.requestId,
          ],
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new SessionPlanActivationError(
            'Another activation for this session or request committed concurrently',
            'conflict',
          );
        }
        throw error;
      }

      return {
        activation: inserted.rows[0],
        plan: revision.data as SessionPlan,
        replayed: false,
      };
    });
  }

  async getActiveSessionPlanActivation(
    campaignId: string,
    sessionId?: string,
    client?: PoolClient,
  ): Promise<{
    activation: SessionPlanActivationRecord;
    plan: SessionPlan;
  } | null> {
    const executor = this.getExecutor(client);
    let query = `SELECT * FROM session_plan_activations WHERE "campaignId" = $1 AND status = 'active'`;
    const params: unknown[] = [campaignId];
    if (sessionId) {
      params.push(sessionId);
      query += ` AND "sessionId" = $2`;
    }
    query += ` ORDER BY "createdAt" DESC LIMIT 1`;

    const result = await executor.query<SessionPlanActivationRecord>(
      query,
      params,
    );
    const activation = result.rows[0];
    if (!activation) return null;

    const revision = await this.getRevision(
      activation.sessionPlanId,
      activation.planRevision,
      client,
    );
    if (!revision) return null;

    return {
      activation,
      plan: revision.data as SessionPlan,
    };
  }

  async getActivation(
    campaignId: string,
    activationId: string,
    client?: PoolClient,
  ): Promise<{
    activation: SessionPlanActivationRecord;
    plan: SessionPlan;
  } | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<SessionPlanActivationRecord>(
      `SELECT * FROM session_plan_activations WHERE id = $1 AND "campaignId" = $2`,
      [activationId, campaignId],
    );
    const activation = result.rows[0];
    if (!activation) return null;

    const revision = await this.getRevision(
      activation.sessionPlanId,
      activation.planRevision,
      client,
    );
    if (!revision) return null;

    return {
      activation,
      plan: revision.data as SessionPlan,
    };
  }

  async updateSessionPlanActivationProgress(
    input: UpdateSessionPlanActivationProgressInput,
    client?: PoolClient,
  ): Promise<SessionPlanActivationRecord> {
    return this.withTransaction(client, async (executor) => {
      const activation = await this.lockActivation(
        input.campaignId,
        input.activationId,
        executor,
      );
      if (activation.revision !== input.expectedRevision) {
        throw new SessionPlanActivationError(
          `Session plan activation ${input.activationId} is at revision ${activation.revision}, not ${input.expectedRevision}`,
          'conflict',
        );
      }

      if (input.currentStepIndex !== undefined) {
        const revision = await this.getRevision(
          activation.sessionPlanId,
          activation.planRevision,
          executor,
        );
        if (!revision) {
          throw new SessionPlanActivationError(
            `Session plan revision ${activation.planRevision} does not exist`,
            'invalid-revision',
          );
        }
        const stepCount = mainTrackSteps(revision.data as SessionPlan).length;
        if (input.currentStepIndex >= Math.max(stepCount, 1)) {
          throw new SessionPlanActivationError(
            `Step index ${input.currentStepIndex} is outside the plan's ${stepCount} main steps`,
            'invalid-step',
          );
        }
      }

      if (input.status === 'active' && activation.status !== 'active') {
        const competing = await executor.query<{ id: string }>(
          `SELECT id FROM session_plan_activations
           WHERE "campaignId" = $1 AND "sessionId" = $2
             AND status = 'active' AND id <> $3
           LIMIT 1`,
          [input.campaignId, activation.sessionId, activation.id],
        );
        if (competing.rows[0]) {
          throw new SessionPlanActivationError(
            'Another session plan is already active for this session',
            'conflict',
          );
        }
      }

      const result = await executor.query<SessionPlanActivationRecord>(
        `UPDATE session_plan_activations
         SET "currentStepIndex" = COALESCE($3, "currentStepIndex"),
             "stepStates" = "stepStates" || COALESCE($4::jsonb, '{}'::jsonb),
             status = COALESCE($5, status),
             "completedAt" = CASE
               WHEN $5 = 'completed' THEN COALESCE("completedAt", NOW())
               WHEN $5 = 'active' THEN NULL
               ELSE "completedAt"
             END,
             revision = revision + 1,
             "updatedAt" = NOW()
         WHERE id = $1 AND "campaignId" = $2 AND revision = $6
         RETURNING *`,
        [
          input.activationId,
          input.campaignId,
          input.currentStepIndex,
          input.stepStates ? JSON.stringify(input.stepStates) : null,
          input.status ?? null,
          input.expectedRevision,
        ],
      );
      const updated = result.rows[0];
      if (!updated) {
        throw new SessionPlanActivationError(
          'Session plan progress changed while it was being updated',
          'conflict',
        );
      }
      return updated;
    });
  }

  async advanceSessionPlanActivation(
    input: AdvanceSessionPlanActivationInput,
    client?: PoolClient,
  ): Promise<SessionPlanActivationRecord> {
    return this.withTransaction(client, async (executor) => {
      const activation = await this.lockActivation(
        input.campaignId,
        input.activationId,
        executor,
      );
      if (
        input.expectedRevision !== undefined &&
        activation.revision !== input.expectedRevision
      ) {
        throw new SessionPlanActivationError(
          `Session plan activation ${input.activationId} is at revision ${activation.revision}, not ${input.expectedRevision}`,
          'conflict',
        );
      }
      if (activation.status !== 'active') {
        throw new SessionPlanActivationError(
          'Only an active session plan can advance',
          'inactive',
        );
      }

      const revision = await this.getRevision(
        activation.sessionPlanId,
        activation.planRevision,
        executor,
      );
      if (!revision) {
        throw new SessionPlanActivationError(
          `Session plan revision ${activation.planRevision} does not exist`,
          'invalid-revision',
        );
      }

      const mainSteps = mainTrackSteps(revision.data as SessionPlan);
      const step = mainSteps[input.stepIndex];
      if (
        !step ||
        step.id !== input.stepId ||
        input.stepIndex !== activation.currentStepIndex
      ) {
        throw new SessionPlanActivationError(
          'The requested step is not the active session-plan step',
          'invalid-step',
        );
      }

      const priorState = activation.stepStates?.[input.stepId];
      const stepStates = {
        ...activation.stepStates,
        [input.stepId]: {
          // Keep runtime facts such as a deployed encounterRunId.
          ...(typeof priorState === 'object' && priorState !== null
            ? priorState
            : {}),
          completed: true,
          completedAt: new Date().toISOString(),
          completedBy: input.completedBy,
        },
      };
      const nextStepIndex = Math.min(
        input.stepIndex + 1,
        Math.max(mainSteps.length - 1, 0),
      );
      const updatedResult = await executor.query<SessionPlanActivationRecord>(
        `UPDATE session_plan_activations
           SET "currentStepIndex" = $3,
               "stepStates" = $4::jsonb,
               revision = revision + 1,
               "updatedAt" = NOW()
           WHERE id = $1
             AND "campaignId" = $2
             AND status = 'active'
             AND "currentStepIndex" = $5
             AND revision = $6
           RETURNING *`,
        [
          input.activationId,
          input.campaignId,
          nextStepIndex,
          JSON.stringify(stepStates),
          input.stepIndex,
          activation.revision,
        ],
      );
      const updated = updatedResult.rows[0];
      if (!updated) {
        throw new SessionPlanActivationError(
          'Session plan progress changed while the step was being completed',
          'conflict',
        );
      }
      return updated;
    });
  }

  private async lockActivation(
    campaignId: string,
    activationId: string,
    executor: PoolClient,
  ): Promise<SessionPlanActivationRecord> {
    const result = await executor.query<SessionPlanActivationRecord>(
      `SELECT * FROM session_plan_activations
       WHERE id = $1 AND "campaignId" = $2
       FOR UPDATE`,
      [activationId, campaignId],
    );
    const activation = result.rows[0];
    if (!activation) {
      throw new SessionPlanActivationError(
        `Session plan activation ${activationId} not found in campaign ${campaignId}`,
        'not-found',
      );
    }
    return activation;
  }

  private async insertRevision(
    objectId: string,
    revision: CampaignPrepRevisionInput,
    client: PoolClient,
  ): Promise<CampaignPrepObjectRevisionRecord> {
    const result = await client.query<CampaignPrepObjectRevisionRecord>(
      `INSERT INTO campaign_object_revisions
         ("objectId", revision, "schemaVersion", data, "dependencyManifest", "createdBy", "requestId")
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
       RETURNING *`,
      [
        objectId,
        revision.revision,
        revision.schemaVersion,
        JSON.stringify(revision.data),
        JSON.stringify(revision.dependencies),
        revision.createdBy,
        revision.requestId,
      ],
    );
    return result.rows[0];
  }

  private async insertLinks(
    objectId: string,
    revision: number,
    dependencies: CampaignObjectRef[],
    client: PoolClient,
  ): Promise<void> {
    const insertedKeys = new Set<string>();

    for (const dependency of dependencies) {
      const targetKey = campaignObjectRefKey(dependency);
      if (insertedKeys.has(targetKey)) {
        continue;
      }
      insertedKeys.add(targetKey);

      await client.query(
        `INSERT INTO campaign_object_links
           ("sourceObjectId", "sourceRevision", "targetKey", target)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [objectId, revision, targetKey, JSON.stringify(dependency)],
      );
    }
  }

  private async withTransaction<T>(
    client: PoolClient | undefined,
    operation: (executor: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (client) {
      return operation(client);
    }

    const transactionClient = await this.pool.connect();
    try {
      await transactionClient.query('BEGIN');
      const result = await operation(transactionClient);
      await transactionClient.query('COMMIT');
      return result;
    } catch (error) {
      await transactionClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      transactionClient.release();
    }
  }
}
