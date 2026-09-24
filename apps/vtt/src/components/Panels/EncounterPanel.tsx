import React, { useState } from 'react';
import type { PanelComponentProps } from '@/services/panelRegistry';
import { commandClient } from '@/services/commandClient';
import styles from './EncounterPanel.module.css';

interface ParticipantDisplay {
  actorId: string;
  name: string;
  initiativeRoll: number;
}

export const EncounterPanel: React.FC<PanelComponentProps> = ({ link }) => {
  const campaignId = link.campaignId || 'default-campaign';
  const encounterRunId = link.id;

  const [stage, setStage] = useState<'staged' | 'deployed' | 'active' | 'completed'>('deployed');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [participants] = useState<ParticipantDisplay[]>([
    { actorId: 'p-1', name: 'Astarion', initiativeRoll: 18 },
    { actorId: 'p-2', name: 'Goblin #1', initiativeRoll: 14 },
    { actorId: 'p-3', name: 'Shadowheart', initiativeRoll: 11 },
    { actorId: 'p-4', name: 'Goblin #2', initiativeRoll: 8 },
  ]);

  const handleStartCombat = async () => {
    setStage('active');
    setCurrentRound(1);
    setCurrentTurnIndex(0);

    await commandClient.startEncounter(campaignId, encounterRunId);
  };

  const handleNextTurn = async () => {
    let nextIndex = currentTurnIndex + 1;
    let nextRound = currentRound;

    if (nextIndex >= participants.length) {
      nextIndex = 0;
      nextRound += 1;
    }

    setCurrentTurnIndex(nextIndex);
    setCurrentRound(nextRound);

    await commandClient.advanceCombatTurn(campaignId, encounterRunId);
  };

  const activeParticipant = participants[currentTurnIndex];

  return (
    <div className={styles.container} data-testid="encounter-panel">
      <div className={styles.header}>
        <h2 className={styles.title}>{link.title || 'Encounter'}</h2>
        <span className={styles.stageBadge} data-testid="encounter-stage">
          {stage}
        </span>
      </div>

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
        {stage !== 'active' ? (
          <button
            onClick={handleStartCombat}
            className={styles.primaryBtn}
            data-testid="start-combat-btn"
          >
            ⚔️ Start Combat
          </button>
        ) : (
          <button
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
