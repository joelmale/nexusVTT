import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadEncounterRun,
  type EncounterRunView,
} from '@/services/encounterRunClient';
import type { PanelComponentProps } from '@/services/panelRegistry';
import { commandClient } from '@/services/commandClient';
import styles from './EncounterPanel.module.css';

interface ParticipantDisplay {
  actorId: string;
  name: string;
  initiativeRoll: number;
}

export const EncounterPanel: React.FC<PanelComponentProps> = ({ link }) => {
  const campaignId = link.campaignId;
  const encounterRunId = link.id;
  const [view, setView] = useState<EncounterRunView>();
  const [status, setStatus] = useState<string>();
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (!campaignId) {
      return;
    }
    const observed = ++generation.current;
    try {
      const loaded = await loadEncounterRun(campaignId, encounterRunId);
      if (observed !== generation.current) return;
      setView(loaded);
      setStatus(undefined);
    } catch (error) {
      if (observed !== generation.current) return;
      setView(undefined);
      setStatus(
        error instanceof Error ? error.message : 'Could not load encounter.',
      );
    }
  }, [campaignId, encounterRunId]);
  const cancelPendingRefresh = useCallback(() => {
    generation.current += 1;
  }, []);
  useEffect(() => {
    // Load external committed state; setters run after the asynchronous request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const reload = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener('online', reload);
    window.addEventListener('nexus-domain-command-executed', reload);
    window.addEventListener('nexus-campaign-actors-changed', reload);
    return () => {
      cancelPendingRefresh();
      window.removeEventListener('online', reload);
      window.removeEventListener('nexus-domain-command-executed', reload);
      window.removeEventListener('nexus-campaign-actors-changed', reload);
    };
  }, [refresh, cancelPendingRefresh]);
  const act = async (kind: 'start' | 'advance') => {
    if (!campaignId || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result =
        kind === 'start'
          ? await commandClient.startEncounter(campaignId, encounterRunId)
          : await commandClient.advanceCombatTurn(campaignId, encounterRunId);
      await refresh();
      if (!result.success)
        setStatus(
          result.error ||
            'The action was not confirmed. Refresh before retrying.',
        );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'The action was not confirmed.',
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const stage = view?.run.stage;
  const currentRound = view?.run.currentRound;
  const currentTurnIndex = view?.run.currentTurnIndex ?? 0;
  const participants: ParticipantDisplay[] = (view?.run.participants ?? []).map(
    (participant) => ({
      ...participant,
      name:
        view?.actors.find((actor) => actor.id === participant.actorId)?.name ||
        'Unavailable actor',
    }),
  );
  const activeParticipant = participants[currentTurnIndex];
  const handleStartCombat = () => void act('start');
  const handleNextTurn = () => void act('advance');

  return (
    <div className={styles.container} data-testid="encounter-panel">
      <div className={styles.header}>
        <h2 className={styles.title}>{link.title || 'Encounter'}</h2>
        <span className={styles.stageBadge} data-testid="encounter-stage">
          {stage}
        </span>
      </div>

      {!campaignId && (
        <p role="status">Open this encounter from its campaign.</p>
      )}
      {status && <p role="status">{status}</p>}
      {campaignId && !view && !status && (
        <p role="status">Loading committed encounter…</p>
      )}
      <button type="button" disabled={pending} onClick={() => void refresh()}>
        Refresh encounter
      </button>
      <div className={styles.roundTracker}>
        <div className={styles.roundStat}>
          <span className={styles.roundLabel}>Round</span>
          <span className={styles.roundValue} data-testid="encounter-round">
            {currentRound}
          </span>
        </div>
        <div className={styles.roundStat}>
          <span className={styles.roundLabel}>Turn</span>
          <span className={styles.roundValue} data-testid="encounter-turn">
            {stage === 'active' ? currentTurnIndex + 1 : '-'}
          </span>
        </div>
        <div className={styles.roundStat}>
          <span className={styles.roundLabel}>Active</span>
          <span
            className={styles.roundValue}
            style={{ fontSize: '14px', color: 'var(--text-primary, #fff)' }}
            data-testid="encounter-active-participant"
          >
            {stage === 'active' ? activeParticipant?.name : 'Not Started'}
          </span>
        </div>
      </div>

      <div className={styles.controls}>
        {stage === 'deployed' || stage === 'staged' ? (
          <button
            disabled={pending || !view || Boolean(status)}
            onClick={handleStartCombat}
            className={styles.primaryBtn}
            data-testid="start-combat-btn"
          >
            ⚔️ Start Combat
          </button>
        ) : (
          <button
            disabled={pending || stage !== 'active' || Boolean(status)}
            onClick={handleNextTurn}
            className={styles.primaryBtn}
            data-testid="next-turn-btn"
          >
            ⏭️ Next Turn
          </button>
        )}
      </div>

      <div className={styles.participantsList}>
        {participants.map((p, index) => {
          const isActive = stage === 'active' && index === currentTurnIndex;
          return (
            <div
              key={p.actorId}
              className={`${styles.participantCard} ${
                isActive ? styles.participantCardActive : ''
              }`}
              data-testid={`participant-${p.actorId}`}
            >
              <div className={styles.participantInfo}>
                <span className={styles.initBadge}>{p.initiativeRoll}</span>
                <span className={styles.participantName}>{p.name}</span>
              </div>
              {isActive && (
                <span className={styles.turnIndicator}>CURRENT TURN</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
