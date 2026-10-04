import { useEffect, useMemo, useState } from 'react';
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
    'Reminder': 'note',
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
    objectId: s.encounterId,
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
  };
}

function SessionPlanContent({
  campaignId,
  sessionId,
  model,
  canPublish,
  store,
}: SessionPlanContentProps) {
  const { notifyCapability } = useCapabilityNotice();
  const [persistedRevision, setPersistedRevision] = useState<number>();
  const [publishState, setPublishState] = useState<
    'idle' | 'publishing' | 'published' | 'error'
  >('idle');
  const [publishMessage, setPublishMessage] = useState<string>();
  const [isDirty, setIsDirty] = useState(false);
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
        });
        if (!mounted) return;
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
  }, [campaignId, canPublish, model.campaignTitle, model.title]);

  function createPublishInput(
    steps: SessionStepViewModel[],
  ): PublishSessionPlanInput {
    return {
      campaignId,
      campaignDescription: activeModel.campaignDescription,
      campaignTitle: activeModel.campaignTitle,
      planTitle: activeModel.title,
      revision: activeModel.revision,
      sceneMapPath: activeModel.sceneMapPath,
      steps,
    };
  }

  async function publishPlan(steps: SessionStepViewModel[]) {
    setPublishState('publishing');
    setPublishMessage(
      'Saving the campaign objects and validating dependencies.',
    );
    try {
      const result = await publishSessionPlan(createPublishInput(steps));
      setPublishState('published');
      setIsDirty(false);
      setPersistedRevision(result.plan.revision);
      setPublishMessage(
        `Published revision ${result.plan.revision} to Nexus VTT.`,
      );
      if (store?.editable && sessionId) {
        const session = store.bundle.sessions.find((s) => s.id === sessionId);
        const updatedPlan = buildPlanPatchFromSteps(steps, session?.plan);
        updatedPlan.revision = result.plan.revision;
        await store.updateItem('session', sessionId, { plan: updatedPlan });
      }
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
    const isRestart = activateState === 'activated';
    setActivateState('activating');
    setPublishMessage(
      isRestart
        ? 'Restarting the run sheet at step 1...'
        : 'Activating plan in Nexus VTT...',
    );
    try {
      const result = await activateSessionPlan(createPublishInput(steps));
      setActivateState('activated');
      if (result.plan?.revision) {
        setPersistedRevision(result.plan.revision);
      }
      setPublishMessage(
        isRestart
          ? `Run restarted for session ${result.activation.sessionId}. Step 1 is ready in VTT.`
          : `Plan activated for session ${result.activation.sessionId}! Step 1 is ready in VTT.`,
      );
      if (store?.editable && sessionId && result.plan?.revision) {
        const session = store.bundle.sessions.find((s) => s.id === sessionId);
        const updatedPlan = buildPlanPatchFromSteps(steps, session?.plan);
        updatedPlan.revision = result.plan.revision;
        await store.updateItem('session', sessionId, { plan: updatedPlan });
      }
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
    setIsDirty(true);
    setPublishState('idle');
    setPublishMessage('You have unpublished changes.');
  }

  async function handleStepsChange(newSteps: SessionStepViewModel[]) {
    markDirty();
    if (store?.editable && sessionId) {
      const session = store.bundle.sessions.find((s) => s.id === sessionId);
      const updatedPlan = buildPlanPatchFromSteps(newSteps, session?.plan);
      await store.updateItem('session', sessionId, { plan: updatedPlan });
    }
  }

  return (
    <SessionPlan
      activateState={activateState}
      isDirty={isDirty}
      model={activeModel}
      onActivate={canPublish ? activatePlan : undefined}
      onBeginDraft={beginDraft}
      onCapability={notifyCapability}
      onDirty={markDirty}
      onPublish={canPublish ? publishPlan : undefined}
      onStepsChange={handleStepsChange}
      persistedRevision={persistedRevision}
      publishMessage={publishMessage}
      publishState={publishState}
    />
  );
}

function SessionPlanPage() {
  const { bundle, basePath, store } = useSectionBundle();
  const { sessionId = '' } = useParams();
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
      campaignId={bundle.campaignId}
      canPublish={bundle.features.publishSessionPlans}
      key={`${bundle.slug}/${sessionId}`}
      model={model}
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
