import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useCapabilityNotice } from '@/features/capability-notice';
import { SessionPlan } from '@/features/session-plan/SessionPlan';
import { buildSessionPlanModel } from '@/features/session-plan/buildSessionPlanModel';
import type {
  SessionPlanViewModel,
  SessionStepViewModel,
} from '@/features/session-plan/sessionPlanModels';
import type {
  SessionPlan as CampaignSessionPlan,
  SessionPlanStep,
} from '@/demo/ashes-of-veyra/types';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { SectionRoute } from '@/features/section-shell/SectionRoute';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import {
  activateSessionPlan,
  fetchSessionPlanStatus,
  publishSessionPlan,
  type PublishSessionPlanInput,
} from '@/services/campaign-prep-api';

interface SessionPlanContentProps {
  campaignId: string;
  sessionId: string;
  model: SessionPlanViewModel;
  /** Only bundles with publishing enabled call the prep API. */
  canPublish: boolean;
  store?: BundleStore;
  bundle?: import('@/demo/fixture-registry').CampaignFixtureBundle;
  session?: import('@/demo/fixture-registry').CampaignSession;
}

function buildPlanPatchFromSteps(
  steps: SessionStepViewModel[],
  existingPlan?: CampaignSessionPlan,
): CampaignSessionPlan {
  const stepKinds: Record<string, SessionPlanStep['kind']> = {
    'Opening recap': 'recap',
    'Activate scene': 'scene',
    'Open note': 'note',
    'Deploy encounter': 'encounter',
    'Share handout': 'handout',
    'Decision point': 'choice',
    'Closing beat': 'closing',
    Reminder: 'note',
    reminder: 'note',
    'open-scene': 'scene',
    'activate-scene': 'scene',
    'deploy-encounter': 'encounter',
    'share-handout': 'handout',
    'reveal-entry': 'note',
    'open-entry': 'note',
  };

  const planSteps: SessionPlanStep[] = steps.map((s, idx) => ({
    id: s.id,
    order: idx + 1,
    kind: stepKinds[s.command] ?? 'note',
    track: s.track,
    title: s.title,
    durationMinutes: s.durationMinutes,
    visibility: s.visibility,
    body: s.body,
    objectId: s.objectId || s.encounterId,
    sceneTemplateId: s.sceneTemplateId,
    mapId: s.mapId,
  }));

  const estimatedMinutes = planSteps.reduce(
    (acc, s) => acc + s.durationMinutes,
    0,
  );

  return {
    revision: (existingPlan?.revision ?? 0) + 1,
    lastEdited: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    estimatedMinutes,
    readiness: existingPlan?.readiness ?? [],
    dependencies: existingPlan?.dependencies ?? [],
    steps: planSteps,
    notes: existingPlan?.notes ?? [],
    playerFacingSummary: existingPlan?.playerFacingSummary ?? '',
    attachments: existingPlan?.attachments ?? [],
    defaultVisibility: existingPlan?.defaultVisibility ?? 'dm-only',
  };
}

function SessionPlanContent({
  campaignId,
  sessionId,
  model,
  canPublish,
  store,
  bundle,
  session,
}: SessionPlanContentProps) {
  const { notifyCapability } = useCapabilityNotice();
  const [persistedRevision, setPersistedRevision] = useState<number>();
  const [publishState, setPublishState] = useState<
    'idle' | 'publishing' | 'published' | 'error'
  >('idle');
  const [publishMessage, setPublishMessage] = useState<string>();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const draftRef = useRef<CampaignSessionPlan>(
    model.authoring ?? buildPlanPatchFromSteps(model.steps),
  );
  const editRevision = useRef(0);
  const [planId, setPlanId] = useState(model.planId);
  const activationRequest = useRef<string | undefined>(undefined);
  const [activateState, setActivateState] = useState<
    'idle' | 'activating' | 'activated' | 'error'
  >('idle');

  const activeModel = useMemo(() => {
    if (persistedRevision === undefined) return model;
    return {
      ...model,
      revision: persistedRevision,
    };
  }, [model, persistedRevision]);

  useEffect(() => {
    if (!canPublish) return;
    let mounted = true;
    async function hydrate() {
      try {
        const status = await fetchSessionPlanStatus({
          campaignId,
          planTitle: model.title,
          ...(store?.editable && model.sessionId
            ? { sessionId: model.sessionId, planId: model.planId }
            : {}),
        });
        if (!mounted) return;
        if (editRevision.current > 0) return;
        setPlanId(status.planId);
        if (status.published && status.revision) {
          setPersistedRevision(status.revision);
          setPublishState('published');
          setIsDirty(false);
          setPublishMessage(
            `Published revision ${status.revision} is ready in Nexus VTT.`,
          );
          if (status.isActivated) {
            setActivateState('activated');
          }
        }
      } catch {
        // Unauthenticated or offline: keep initial draft state without blocking the UI
      }
    }
    hydrate();
    return () => {
      mounted = false;
    };
  }, [
    campaignId,
    canPublish,
    model.campaignTitle,
    model.title,
    model.planId,
    model.sessionId,
    store?.editable,
  ]);

  function createPublishInput(
    steps: SessionStepViewModel[],
  ): PublishSessionPlanInput {
    return {
      campaignId,
      planId,
      ...(store?.editable ? { sessionId: model.sessionId } : {}),
      authoring: draftRef.current,
      campaignDescription: activeModel.campaignDescription,
      campaignTitle: activeModel.campaignTitle,
      planTitle: activeModel.title,
      revision: activeModel.revision,
      sceneMapPath: activeModel.sceneMapPath,
      steps,
    };
  }

  async function publishPlan(steps: SessionStepViewModel[]) {
    const publishingEdit = editRevision.current;
    setPublishState('publishing');
    setPublishMessage(
      'Saving the campaign objects and validating dependencies.',
    );
    try {
      const observed = store?.editable ? await saveDraft() : undefined;
      const result = await publishSessionPlan({
        ...createPublishInput(steps),
        ...(observed
          ? { planId: observed.planId, revision: observed.revision! }
          : {}),
      });
      const unchanged = editRevision.current === publishingEdit;
      setPublishState(unchanged ? 'published' : 'idle');
      setIsDirty(!unchanged);
      setPersistedRevision(result.plan.revision);
      setPlanId(result.plan.id);
      setPublishMessage(
        `Published revision ${result.plan.revision} to Nexus VTT.`,
      );
      if (store?.editable) await store.reload();
    } catch (error) {
      setPublishState('error');
      setPublishMessage(
        error instanceof Error
          ? error.message
          : 'The plan could not be published.',
      );
    }
  }

  async function activatePlan(steps: SessionStepViewModel[]) {
    if (isDirty || isSaving || publishState !== 'published') {
      setPublishMessage(
        'Save and publish your changes before playing this plan.',
      );
      return;
    }
    const isRestart = activateState === 'activated';
    setActivateState('activating');
    setPublishMessage(
      isRestart
        ? 'Restarting the run sheet at step 1...'
        : 'Activating plan in Nexus VTT...',
    );
    try {
      activationRequest.current ??= crypto.randomUUID();
      const result = await activateSessionPlan({
        ...createPublishInput(steps),
        activationRequestId: activationRequest.current,
      });
      setActivateState('activated');
      if (result.plan?.revision) {
        setPersistedRevision(result.plan.revision);
      }
      setPublishMessage(
        isRestart
          ? `Run restarted for session ${result.activation.sessionId}. Step 1 is ready in VTT.`
          : `Plan activated for session ${result.activation.sessionId}! Step 1 is ready in VTT.`,
      );
      activationRequest.current = undefined;
    } catch (error) {
      setActivateState('error');
      setPublishMessage(
        error instanceof Error
          ? error.message
          : 'The plan could not be activated.',
      );
    }
  }

  function beginDraft() {
    setIsDirty(true);
    setPublishState('idle');
    setPublishMessage(
      `Draft created from published revision ${persistedRevision ?? model.revision}.`,
    );
  }

  function markDirty() {
    editRevision.current += 1;
    setIsDirty(true);
    setPublishState('idle');
    setPublishMessage('You have unpublished changes.');
  }

  function handleStepsChange(newSteps: SessionStepViewModel[]) {
    draftRef.current = buildPlanPatchFromSteps(newSteps, draftRef.current);
    markDirty();
  }

  function handleAuthoringChange(patch: Partial<CampaignSessionPlan>) {
    draftRef.current = { ...draftRef.current, ...patch };
    markDirty();
  }

  async function saveDraft() {
    if (!store?.editable)
      throw new Error('This campaign is read-only. Clone it to save changes.');
    const snapshot = structuredClone(draftRef.current);
    const observedEdit = editRevision.current;
    setIsSaving(true);
    try {
      const result = await store.updateItem('session', sessionId, {
        plan: snapshot,
      });
      if (!result.ok)
        throw new Error(
          result.error ||
            'The draft could not be saved. Your edits are still available.',
        );
      const status = await fetchSessionPlanStatus({
        campaignId,
        sessionId,
        planTitle: model.title,
      });
      setPlanId(status.planId);
      if (status.revision) setPersistedRevision(status.revision);
      if (editRevision.current === observedEdit) {
        setIsDirty(false);
        setPublishMessage('Draft saved. Publish it before playing in VTT.');
      }
      return status;
    } catch (error) {
      setPublishMessage(
        error instanceof Error
          ? error.message
          : 'The draft could not be saved.',
      );
      setPublishState('error');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SessionPlan
      activateState={activateState}
      bundle={bundle}
      isDirty={isDirty}
      isSaving={isSaving}
      model={activeModel}
      onActivate={canPublish ? activatePlan : undefined}
      onBeginDraft={beginDraft}
      onCapability={notifyCapability}
      onDirty={markDirty}
      onPublish={canPublish ? publishPlan : undefined}
      onStepsChange={handleStepsChange}
      onAuthoringChange={handleAuthoringChange}
      onSaveDraft={
        store?.editable
          ? () => {
              void saveDraft().catch(() => undefined);
            }
          : undefined
      }
      persistedRevision={persistedRevision}
      publishMessage={publishMessage}
      publishState={publishState}
      session={session}
    />
  );
}

function SessionPlanPage() {
  const { bundle, basePath, store } = useSectionBundle();
  const { sessionId = '' } = useParams();
  const session = useMemo(
    () => bundle.sessions.find((item) => item.id === sessionId),
    [bundle, sessionId],
  );
  const model = useMemo(
    () => buildSessionPlanModel(bundle, sessionId, basePath),
    [bundle, sessionId, basePath],
  );

  if (!model) {
    return (
      <main>
        <EmptyState
          action={<Link to={`${basePath}/sessions`}>Back to Sessions</Link>}
          description="This session does not exist in this campaign."
          title="Session not found"
        />
      </main>
    );
  }

  return (
    <SessionPlanContent
      bundle={bundle}
      campaignId={bundle.campaignId}
      canPublish={
        store?.editable === true || bundle.features.publishSessionPlans
      }
      key={`${bundle.slug}/${sessionId}`}
      model={model}
      session={session}
      sessionId={sessionId}
      store={store}
    />
  );
}

export function SessionPlanRoute() {
  return (
    <SectionRoute title="Session plan">
      <SessionPlanPage />
    </SectionRoute>
  );
}
