import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useCapabilityNotice } from '@/features/capability-notice';
import { SessionPlan } from '@/features/session-plan/SessionPlan';
import { buildSessionPlanModel } from '@/features/session-plan/buildSessionPlanModel';
import type {
  SessionPlanViewModel,
  SessionStepViewModel,
} from '@/features/session-plan/sessionPlanModels';
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
  model: SessionPlanViewModel;
  /** Only bundles with publishing enabled call the prep API. */
  canPublish: boolean;
}

function SessionPlanContent({
  campaignId,
  model,
  canPublish,
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
      persistedRevision={persistedRevision}
      publishMessage={publishMessage}
      publishState={publishState}
    />
  );
}

function SessionPlanPage() {
  const { bundle, basePath } = useSectionBundle();
  const { sessionId = '' } = useParams();
  const model = useMemo(
    () => buildSessionPlanModel(bundle, sessionId, basePath),
    [bundle, sessionId, basePath],
  );

  if (!model) {
    const session = bundle.sessions.find((item) => item.id === sessionId);
    return (
      <main>
        <EmptyState
          action={<Link to={`${basePath}/sessions`}>Back to Sessions</Link>}
          description={
            session
              ? `Session ${session.number} has no run sheet yet.`
              : 'This session does not exist in this campaign.'
          }
          title={session ? 'No plan for this session' : 'Session not found'}
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
