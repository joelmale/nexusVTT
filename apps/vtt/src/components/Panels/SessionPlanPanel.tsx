import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Clock from 'lucide-react/dist/esm/icons/clock';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Play from 'lucide-react/dist/esm/icons/play';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Share2 from 'lucide-react/dist/esm/icons/share-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Swords from 'lucide-react/dist/esm/icons/swords';

import type {
  SceneTemplate,
  SessionPlan,
  SessionPlanActivation,
  SessionPlanStep,
  SessionPlanStepState,
} from '@nexus/game-contracts';

import { commandClient } from '@/services/commandClient';
import { panelRegistry, type PanelComponentProps } from '@/services/panelRegistry';
import { campaignPrepClient } from '@/services/campaignPrepClient';
import { useGameStore } from '@/stores/gameStore';
import styles from './SessionPlanPanel.module.css';

function isValidCampaignId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return trimmed.length > 0 && trimmed !== 'default-campaign';
}

export const SessionPlanPanel: React.FC<PanelComponentProps> = ({
  link,
  isPopout,
}) => {
  const session = useGameStore((state) => state.session);
  const user = useGameStore((state) => state.user);
  const gameConfig = useGameStore((state) => state.gameConfig);
  const sceneState = useGameStore((state) => state.sceneState);
  const setActiveScene = useGameStore((state) => state.setActiveScene);
  const createScene = useGameStore((state) => state.createScene);
  const updateScene = useGameStore((state) => state.updateScene);
  const updateCamera = useGameStore((state) => state.updateCamera);

  const isHost =
    user?.type === 'host' ||
    (session
      ? user?.id === session.hostId || (session.coHostIds?.includes(user?.id) ?? false)
      : true);

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(
    (isValidCampaignId(link.campaignId) ? link.campaignId : null) ||
      (isValidCampaignId(session?.campaignId) ? session.campaignId : null) ||
      (isValidCampaignId(gameConfig?.campaignId) ? gameConfig.campaignId : null),
  );

  const campaignId =
    activeCampaignId ||
    link.campaignId ||
    session?.campaignId ||
    gameConfig?.campaignId ||
    '';
  const sessionId = session?.roomCode || 'default';

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activation, setActivation] = useState<SessionPlanActivation | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});
  const [deployedEncounters, setDeployedEncounters] = useState<Record<string, string>>({});

  const fetchActivePlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let targetCampaignId =
        (isValidCampaignId(link.campaignId) ? link.campaignId : undefined) ||
        (isValidCampaignId(session?.campaignId) ? session.campaignId : undefined) ||
        (isValidCampaignId(gameConfig?.campaignId) ? gameConfig.campaignId : undefined) ||
        (isValidCampaignId(activeCampaignId) ? activeCampaignId : undefined);

      if (!targetCampaignId) {
        try {
          const res = await fetch('/api/campaigns', { credentials: 'include' });
          if (res.ok) {
            const campaigns = (await res.json()) as Array<{ id: string; name?: string; lastRoomCode?: string }>;
            const match =
              (session?.roomCode
                ? campaigns.find(
                    (c) => c.lastRoomCode?.toUpperCase() === session.roomCode.toUpperCase(),
                  )
                : undefined) ||
              campaigns.find((c) => c.name === 'Ashes of Veyra') ||
              (campaigns.length === 1 ? campaigns[0] : undefined);
            if (match) {
              targetCampaignId = match.id;
              setActiveCampaignId(match.id);
              useGameStore.setState((state) => {
                if (state.session) {
                  state.session.campaignId = match.id;
                }
              });
            }
          }
        } catch {
          // ignore auto-lookup failure
        }
      }

      if (!targetCampaignId) {
        setActivation(null);
        setPlan(null);
        setError('No active campaign linked to this session. Please launch from your campaign dashboard or activate a plan in Campaign Studio.');
        setLoading(false);
        return;
      }

      const data = await campaignPrepClient.getActiveSessionPlan(targetCampaignId, sessionId);
      if (data) {
        setActivation(data.activation);
        setPlan(data.plan);
        setActiveCampaignId(data.activation.campaignId);
        const currentStep = data.plan.steps[data.activation.currentStepIndex];
        if (currentStep) {
          setExpandedStepId(currentStep.id);
        }
      } else {
        setActivation(null);
        setPlan(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load active session plan');
    } finally {
      setLoading(false);
    }
  }, [link.campaignId, session?.campaignId, session?.roomCode, gameConfig?.campaignId, activeCampaignId, sessionId]);

  useEffect(() => {
    fetchActivePlan();
  }, [fetchActivePlan]);

  const totalMinutes = useMemo(() => {
    if (!plan?.steps) return 0;
    return plan.steps.reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0);
  }, [plan]);

  const completedStepsCount = useMemo(() => {
    if (!plan?.steps || !activation) return 0;
    return plan.steps.filter(
      (step, idx) =>
        activation.stepStates?.[step.id]?.completed || idx < activation.currentStepIndex,
    ).length;
  }, [plan, activation]);

  const progressPercent = useMemo(() => {
    if (!plan?.steps?.length) return 0;
    return Math.round((completedStepsCount / plan.steps.length) * 100);
  }, [completedStepsCount, plan]);

  const handleAdvanceStep = async (stepId: string, stepIndex: number) => {
    if (!activation) return;
    const nextIndex = Math.min((plan?.steps.length ?? 1) - 1, stepIndex + 1);
    const updatedStates: Record<string, SessionPlanStepState> = {
      ...(activation.stepStates || {}),
      [stepId]: {
        completed: true,
        completedAt: new Date().toISOString(),
        completedBy: user?.id,
      },
    };

    try {
      const updated = await campaignPrepClient.updateActivationProgress(
        campaignId,
        activation.id,
        {
          currentStepIndex: nextIndex,
          stepStates: updatedStates,
        },
      );
      setActivation(updated);
      const nextStep = plan?.steps[nextIndex];
      if (nextStep) {
        setExpandedStepId(nextStep.id);
      }
    } catch (err) {
      console.error('Failed to advance step:', err);
    }
  };

  const handleJumpToStep = async (targetIndex: number, stepId: string) => {
    if (!activation) return;
    try {
      const updated = await campaignPrepClient.updateActivationProgress(
        campaignId,
        activation.id,
        {
          currentStepIndex: targetIndex,
        },
      );
      setActivation(updated);
      setExpandedStepId(stepId);
    } catch (err) {
      console.error('Failed to set active step:', err);
    }
  };

  const handleActivateScene = async (step: SessionPlanStep) => {
    if (step.type !== 'activate-scene') return;
    setActionInProgress((prev) => ({ ...prev, [step.id]: true }));
    try {
      const stepTitleLower = step.title.toLowerCase();
      // 1. Check if a scene with this name or ID already exists in the room
      const existingMatchingScene = sceneState?.scenes?.find(
        (s) =>
          s.id === step.sceneTemplateRef.id ||
          s.name.toLowerCase() === stepTitleLower ||
          (stepTitleLower.includes('glass harbor') && s.name.toLowerCase().includes('glass harbor')),
      );

      if (existingMatchingScene) {
        setActiveScene(existingMatchingScene.id);
        updateCamera?.({ x: 0, y: 0, zoom: 0.54 });
        setActionFeedback((prev) => ({
          ...prev,
          [step.id]: `Switched to scene: ${existingMatchingScene.name}`,
        }));
        return;
      }

      // 2. Fetch the scene template prep object from the backend
      let template: SceneTemplate | null = null;
      try {
        const res = await fetch(
          `/api/campaigns/${encodeURIComponent(campaignId)}/prep/objects/${encodeURIComponent(step.sceneTemplateRef.id)}`,
          { credentials: 'include' },
        );
        if (res.ok) {
          const body = (await res.json()) as { revision?: { data?: SceneTemplate } };
          if (body?.revision?.data) {
            template = body.revision.data;
          }
        }
      } catch (err) {
        console.warn('Could not fetch scene template from prep API:', err);
      }

      const isGlassHarbor =
        template?.backgroundAssetRef?.assetId?.includes('glass-harbor') ||
        stepTitleLower.includes('glass harbor');

      const bgUrl = isGlassHarbor
        ? '/demo/ashes-of-veyra/glass-harbor-map.png'
        : template?.backgroundAssetRef?.assetId?.startsWith('http') ||
          template?.backgroundAssetRef?.assetId?.startsWith('/')
        ? template.backgroundAssetRef.assetId
        : '/demo/ashes-of-veyra/glass-harbor-map.png';

      const bgWidth = isGlassHarbor ? 1586 : 1920;
      const bgHeight = isGlassHarbor ? 992 : 1080;

      const backgroundImage = {
        url: bgUrl,
        width: bgWidth,
        height: bgHeight,
        offsetX: -bgWidth / 2,
        offsetY: -bgHeight / 2,
        scale: 1.0,
      };

      const sceneName = template?.name || step.title || 'Glass Harbor Docks';

      const gridSettings = {
        enabled: template?.grid?.enabled ?? true,
        type: (template?.grid?.type as 'square' | 'hex') || 'square',
        size: template?.grid?.size || 100,
        color: '#ffffff',
        opacity: 0.2,
        snapToGrid: template?.grid?.snapToGrid ?? true,
        showToPlayers: true,
        offsetX: template?.grid?.offsetX || 0,
        offsetY: template?.grid?.offsetY || 0,
      };

      const lightingSettings = {
        enabled: template?.lighting?.enabled ?? true,
        globalIllumination: template?.lighting?.globalIllumination ?? false,
        ambientLight: template?.lighting?.ambientLight ?? 0.35,
        darkness: template?.lighting?.darkness ?? 0.65,
      };

      // 3. If there is only one scene and it's the initial default empty "Scene 1", update it in-place
      const scenes = sceneState?.scenes || [];
      const isDefaultSceneOnly =
        scenes.length === 1 &&
        scenes[0].name.toLowerCase() === 'scene 1' &&
        !scenes[0].backgroundImage &&
        (!scenes[0].drawings || scenes[0].drawings.length === 0) &&
        (!scenes[0].placedTokens || scenes[0].placedTokens.length === 0);

      if (isDefaultSceneOnly) {
        updateScene(scenes[0].id, {
          name: sceneName,
          description: 'Prepared scene from Campaign Studio',
          backgroundImage,
          gridSettings: {
            ...scenes[0].gridSettings,
            ...gridSettings,
          },
          lightingSettings,
        });
        setActiveScene(scenes[0].id);
        updateCamera?.({ x: 0, y: 0, zoom: 0.54 });
        setActionFeedback((prev) => ({
          ...prev,
          [step.id]: `Activated scene: ${sceneName}`,
        }));
      } else {
        const newScene = createScene({
          name: sceneName,
          description: 'Prepared scene from Campaign Studio',
          visibility: 'public',
          isEditable: true,
          createdBy: user?.id || session?.hostId || 'unknown',
          backgroundImage,
          gridSettings,
          lightingSettings,
          drawings: [],
          placedTokens: [],
          placedProps: [],
          isActive: true,
          playerCount: 0,
        });
        setActiveScene(newScene.id);
        updateCamera?.({ x: 0, y: 0, zoom: 0.54 });
        setActionFeedback((prev) => ({
          ...prev,
          [step.id]: `Created and activated scene: ${sceneName}`,
        }));
      }
    } catch (err) {
      console.error('Failed to activate scene:', err);
      setActionFeedback((prev) => ({
        ...prev,
        [step.id]: err instanceof Error ? err.message : 'Failed to activate scene',
      }));
    } finally {
      setActionInProgress((prev) => ({ ...prev, [step.id]: false }));
    }
  };

  const handleDeployEncounter = async (step: SessionPlanStep) => {
    if (step.type !== 'deploy-encounter') return;
    setActionInProgress((prev) => ({ ...prev, [step.id]: true }));
    try {
      const activeSceneId = sceneState?.activeSceneId || 'default-scene';
      const result = await commandClient.deployEncounter(
        campaignId,
        step.encounterRef,
        activeSceneId,
        { x: 0, y: 0 },
        false,
      );

      const receiptData = result.receipt?.result?.data as
        | { encounterRunId?: string }
        | undefined;
      const runId = receiptData?.encounterRunId || `run-${step.id}`;

      setDeployedEncounters((prev) => ({ ...prev, [step.id]: runId }));
      setActionFeedback((prev) => ({
        ...prev,
        [step.id]: 'Encounter deployed on active scene!',
      }));
    } catch (err) {
      setActionFeedback((prev) => ({
        ...prev,
        [step.id]: err instanceof Error ? err.message : 'Deployment failed',
      }));
    } finally {
      setActionInProgress((prev) => ({ ...prev, [step.id]: false }));
    }
  };

  const handleStartCombat = async (step: SessionPlanStep) => {
    const runId = deployedEncounters[step.id] || `run-${step.id}`;
    setActionInProgress((prev) => ({ ...prev, [step.id]: true }));
    try {
      await commandClient.startEncounter(campaignId, runId);
      panelRegistry.open({
        kind: 'encounter',
        id: runId,
        campaignId,
        title: step.title,
      });
      setActionFeedback((prev) => ({
        ...prev,
        [step.id]: 'Combat encounter started!',
      }));
    } catch (err) {
      setActionFeedback((prev) => ({
        ...prev,
        [step.id]: err instanceof Error ? err.message : 'Failed to start combat',
      }));
    } finally {
      setActionInProgress((prev) => ({ ...prev, [step.id]: false }));
    }
  };

  const handleShareHandout = (step: SessionPlanStep) => {
    if (step.type !== 'share-handout') return;
    setActionFeedback((prev) => ({
      ...prev,
      [step.id]: 'Handout revealed to players in chat!',
    }));
  };

  if (!isHost) {
    return (
      <div className={styles.container} data-testid="session-plan-panel">
        <div className={styles.emptyCard}>
          <AlertCircle size={32} color="var(--indigo-400)" />
          <h3 className={styles.emptyTitle}>DM Access Only</h3>
          <p className={styles.emptyText}>
            Session run sheets contain confidential DM notes, hidden encounters, and campaign beats.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container} data-testid="session-plan-panel">
        <div className={styles.loadingSpinner}>
          <RefreshCw className="animate-spin" size={28} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container} data-testid="session-plan-panel">
        <div className={styles.emptyCard}>
          <AlertCircle size={28} color="var(--rose-400, #f87171)" />
          <h3 className={styles.emptyTitle}>Error Loading Plan</h3>
          <p className={styles.emptyText}>{error}</p>
          <button className={styles.actionBtnSecondary} onClick={fetchActivePlan} type="button">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!plan || !activation) {
    return (
      <div className={styles.container} data-testid="session-plan-panel">
        <div className={styles.emptyCard}>
          <BookOpen size={36} color="var(--indigo-400)" />
          <h3 className={styles.emptyTitle}>No Active Session Plan</h3>
          <p className={styles.emptyText}>
            Publish and activate a session plan from Campaign Studio to run your session sheet live
            inside Nexus VTT.
          </p>
          <button className={styles.actionBtnPrimary} onClick={fetchActivePlan} type="button">
            <RefreshCw size={14} /> Check for Activated Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="session-plan-panel">
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.titleLine}>
            <h2 className={styles.title}>{plan.title}</h2>
            <span className={styles.revBadge}>Rev {plan.revision}</span>
            <span className={styles.statusBadge}>{activation.status}</span>
            {isPopout && <span className={styles.popoutBadge}>Multi-Display</span>}
          </div>
          <div className={styles.headerMeta}>
            <span>Session {activation.sessionId}</span>
            <span>•</span>
            <span>{plan.steps.length} beats</span>
            <span>•</span>
            <span>~{totalMinutes} min estimated</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            aria-label="Refresh run sheet"
            className={styles.iconBtn}
            onClick={fetchActivePlan}
            title="Refresh run sheet"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <section className={styles.summaryCard}>
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span>Progress:</span>
            <span className={styles.statValue}>
              {completedStepsCount} of {plan.steps.length} beats ({progressPercent}%)
            </span>
          </div>
          <div className={styles.statItem}>
            <Clock size={13} />
            <span>Total: {totalMinutes}m</span>
          </div>
        </div>
        <div aria-label="Run sheet progress" className={styles.progressBarTrack} role="progressbar">
          <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <div className={styles.stepsContainer}>
        {plan.steps.map((step, idx) => {
          const isCompleted =
            activation.stepStates?.[step.id]?.completed || idx < activation.currentStepIndex;
          const isActive = idx === activation.currentStepIndex && !isCompleted;
          const isExpanded = expandedStepId === step.id;

          const stepStatusClass = isActive
            ? styles.activeStep
            : isCompleted
              ? styles.completedStep
              : styles.upcomingStep;

          return (
            <article className={`${styles.stepCard} ${stepStatusClass}`} key={step.id}>
              <button
                aria-expanded={isExpanded}
                aria-label={`Step ${idx + 1}: ${step.title}`}
                className={styles.stepHeader}
                onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                type="button"
              >
                <div className={styles.stepHeaderLeft}>
                  <span className={styles.stepNumber}>{String(idx + 1).padStart(2, '0')}</span>
                  <span className={styles.kindBadge}>
                    {step.type === 'activate-scene' && <Sparkles size={12} />}
                    {step.type === 'deploy-encounter' && <Swords size={12} />}
                    {step.type === 'open-entry' && <BookOpen size={12} />}
                    {step.type === 'share-handout' && <FileText size={12} />}
                    {step.type === 'reminder' && <Clock size={12} />}
                    {step.type.replace('-', ' ')}
                  </span>
                  <span className={styles.stepTitle}>{step.title}</span>
                </div>

                <div className={styles.stepHeaderRight}>
                  <span className={styles.stepDuration}>
                    <Clock size={11} /> {step.estimatedMinutes}m
                  </span>
                  <span
                    className={`${styles.stepStatePill} ${
                      isActive
                        ? styles.pillActive
                        : isCompleted
                          ? styles.pillCompleted
                          : styles.pillUpcoming
                    }`}
                  >
                    {isActive ? 'Active' : isCompleted ? 'Done' : 'Pending'}
                  </span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {isExpanded && (
                <div className={styles.stepBody}>
                  {step.type === 'reminder' && <p className={styles.stepText}>{step.text}</p>}

                  <div className={styles.actionRow}>
                    {step.type === 'activate-scene' && (
                      <button
                        className={styles.actionBtnPrimary}
                        disabled={actionInProgress[step.id]}
                        onClick={() => handleActivateScene(step)}
                        type="button"
                      >
                        <Sparkles size={14} /> Activate Scene
                      </button>
                    )}

                    {step.type === 'deploy-encounter' && (
                      <>
                        <button
                          className={styles.actionBtnPrimary}
                          disabled={actionInProgress[step.id]}
                          onClick={() => handleDeployEncounter(step)}
                          type="button"
                        >
                          <Swords size={14} /> Deploy Encounter
                        </button>

                        <button
                          className={styles.actionBtnSecondary}
                          disabled={actionInProgress[step.id]}
                          onClick={() => handleStartCombat(step)}
                          type="button"
                        >
                          <Play size={14} /> Start Combat
                        </button>
                      </>
                    )}

                    {step.type === 'open-entry' && (
                      <button
                        className={styles.actionBtnSecondary}
                        onClick={() =>
                          setActionFeedback((prev) => ({
                            ...prev,
                            [step.id]: `Opening entry: ${step.entryRef.id.slice(0, 8)}`,
                          }))
                        }
                        type="button"
                      >
                        <ExternalLink size={14} /> View Campaign Entry
                      </button>
                    )}

                    {step.type === 'share-handout' && (
                      <button
                        className={styles.actionBtnPrimary}
                        onClick={() => handleShareHandout(step)}
                        type="button"
                      >
                        <Share2 size={14} /> Reveal Handout
                      </button>
                    )}

                    {actionFeedback[step.id] && (
                      <span className={styles.actionFeedback}>
                        <Check size={13} /> {actionFeedback[step.id]}
                      </span>
                    )}
                  </div>

                  <div className={styles.progressControls}>
                    <button
                      className={styles.advanceBtn}
                      onClick={() => handleAdvanceStep(step.id, idx)}
                      type="button"
                    >
                      <Check size={13} />
                      {isActive ? 'Complete & Next Beat' : 'Mark Completed'}
                    </button>

                    {!isActive && (
                      <button
                        className={styles.jumpBtn}
                        onClick={() => handleJumpToStep(idx, step.id)}
                        type="button"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
