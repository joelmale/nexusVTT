import React, { useState } from 'react';
import type { PanelComponentProps } from '@/services/panelRegistry';
import { commandClient } from '@/services/commandClient';
import styles from './MonsterPanel.module.css';

interface StatBlockData {
  name: string;
  size?: string;
  monsterType?: string;
  alignment?: string;
  armorClass?: number;
  currentHp: number;
  maxHp: number;
  tempHp?: number;
  speed?: string;
  abilities?: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  actions?: Array<{ name: string; description: string }>;
}

export const MonsterPanel: React.FC<PanelComponentProps> = ({ link }) => {
  const [hpChangeAmount, setHpChangeAmount] = useState<number>(5);
  const [liveStats, setLiveStats] = useState<StatBlockData>({
    name: link.title || 'Monster',
    size: 'Medium',
    monsterType: 'Humanoid',
    alignment: 'Neutral Evil',
    armorClass: 15,
    currentHp: 18,
    maxHp: 18,
    tempHp: 0,
    speed: '30 ft.',
    abilities: {
      STR: 14,
      DEX: 12,
      CON: 14,
      INT: 10,
      WIS: 11,
      CHA: 10,
    },
    actions: [
      {
        name: 'Multiattack',
        description: 'The creature makes two melee attacks.',
      },
      {
        name: 'Scimitar',
        description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
      },
    ],
  });

  const getModifier = (score: number): string => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const handleApplyDamage = async () => {
    if (hpChangeAmount <= 0) return;
    const campaignId = link.campaignId || 'default-campaign';

    // Optimistically update local view
    const newHp = Math.max(0, liveStats.currentHp - hpChangeAmount);
    setLiveStats((prev) => ({ ...prev, currentHp: newHp }));

    await commandClient.applyDamage(campaignId, link.id, hpChangeAmount);
  };

  const handleHeal = async () => {
    if (hpChangeAmount <= 0) return;
    const campaignId = link.campaignId || 'default-campaign';

    // Optimistically update local view
    const newHp = Math.min(liveStats.maxHp, liveStats.currentHp + hpChangeAmount);
    setLiveStats((prev) => ({ ...prev, currentHp: newHp }));

    await commandClient.healActor(campaignId, link.id, hpChangeAmount);
  };

  return (
    <div className={styles.container} data-testid="monster-panel">
      <div className={styles.header}>
        <h2 className={styles.title}>{liveStats.name}</h2>
        <div className={styles.subtitle}>
          {liveStats.size} {liveStats.monsterType}, {liveStats.alignment}
        </div>
      </div>

      <div className={styles.statRow}>
        <span className={styles.statLabel}>Armor Class</span>
        <span className={styles.statValue}>{liveStats.armorClass}</span>
      </div>

      <div className={styles.statRow}>
        <span className={styles.statLabel}>Hit Points</span>
        <span className={styles.statValue} data-testid="monster-hp-display">
          {liveStats.currentHp} / {liveStats.maxHp}
          {liveStats.tempHp ? ` (+${liveStats.tempHp})` : ''}
        </span>
      </div>

      <div className={styles.statRow}>
        <span className={styles.statLabel}>Speed</span>
        <span className={styles.statValue}>{liveStats.speed}</span>
      </div>

      <div className={styles.abilityGrid}>
        {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((stat) => {
          const score = liveStats.abilities?.[stat] ?? 10;
          return (
            <div key={stat} className={styles.abilityItem}>
              <span className={styles.abilityName}>{stat}</span>
              <span className={styles.abilityScore}>{score}</span>
              <span className={styles.abilityMod}>({getModifier(score)})</span>
            </div>
          );
        })}
      </div>

      <div className={styles.combatControls}>
        <input
          type="number"
          min="1"
          max="999"
          value={hpChangeAmount}
          onChange={(e) => setHpChangeAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className={styles.hpInput}
          data-testid="monster-hp-input"
        />
        <button
          onClick={handleApplyDamage}
          className={styles.damageBtn}
          data-testid="monster-damage-btn"
        >
          Damage
        </button>
        <button
          onClick={handleHeal}
          className={styles.healBtn}
          data-testid="monster-heal-btn"
        >
          Heal
        </button>
      </div>

      {liveStats.actions && liveStats.actions.length > 0 && (
        <div className={styles.actionSection}>
          <div className={styles.actionTitle}>Actions</div>
          {liveStats.actions.map((act) => (
            <div key={act.name} className={styles.actionItem}>
              <span className={styles.actionItemName}>{act.name}.</span>
              <span>{act.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
