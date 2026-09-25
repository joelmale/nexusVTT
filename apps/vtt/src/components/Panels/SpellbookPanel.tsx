import React, { useState } from 'react';
import type { PanelComponentProps } from '@/services/panelRegistry';
import { useCharacterStore } from '@/stores/characterStore';
import { commandClient } from '@/services/commandClient';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Zap from 'lucide-react/dist/esm/icons/zap';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import styles from './SpellbookPanel.module.css';

interface SpellViewItem {
  slug: string;
  name: string;
  level: number;
  school: string;
  isConcentration: boolean;
  isRitual: boolean;
  isPrepared: boolean;
}

interface SpellcastingProfileState {
  profileId: string;
  name: string;
  ability: string;
  saveDC: number;
  attackBonus: number;
  preparationMode: 'prepared' | 'known' | 'innate';
  slots: Record<number, { current: number; max: number }>;
}

export const SpellbookPanel: React.FC<PanelComponentProps> = ({ link }) => {
  const characters = useCharacterStore((state) => state.characters);
  const character = characters.find((c) => c.id === link.id);

  const campaignId = link.campaignId || 'default-campaign';
  const actorId = link.id;

  const [profile, setProfile] = useState<SpellcastingProfileState>({
    profileId: 'primary-profile',
    name: character ? `${character.class || 'Caster'} Spellcasting` : 'Spellcasting Profile',
    ability: 'INT',
    saveDC: 15,
    attackBonus: 7,
    preparationMode: 'prepared',
    slots: {
      1: { current: 4, max: 4 },
      2: { current: 3, max: 3 },
      3: { current: 2, max: 2 },
    },
  });

  const [concentration, setConcentration] = useState<{
    spellSlug: string;
    castId: string;
    castAtLevel: number;
  } | null>(null);

  const [spells, setSpells] = useState<SpellViewItem[]>([
    {
      slug: 'fire-bolt',
      name: 'Fire Bolt',
      level: 0,
      school: 'Evocation',
      isConcentration: false,
      isRitual: false,
      isPrepared: true,
    },
    {
      slug: 'mage-armor',
      name: 'Mage Armor',
      level: 1,
      school: 'Abjuration',
      isConcentration: false,
      isRitual: false,
      isPrepared: true,
    },
    {
      slug: 'magic-missile',
      name: 'Magic Missile',
      level: 1,
      school: 'Evocation',
      isConcentration: false,
      isRitual: false,
      isPrepared: true,
    },
    {
      slug: 'shield',
      name: 'Shield',
      level: 1,
      school: 'Abjuration',
      isConcentration: false,
      isRitual: false,
      isPrepared: true,
    },
    {
      slug: 'detect-magic',
      name: 'Detect Magic',
      level: 1,
      school: 'Divination',
      isConcentration: true,
      isRitual: true,
      isPrepared: false,
    },
    {
      slug: 'misty-step',
      name: 'Misty Step',
      level: 2,
      school: 'Conjuration',
      isConcentration: false,
      isRitual: false,
      isPrepared: true,
    },
    {
      slug: 'hold-person',
      name: 'Hold Person',
      level: 2,
      school: 'Enchantment',
      isConcentration: true,
      isRitual: false,
      isPrepared: true,
    },
    {
      slug: 'fireball',
      name: 'Fireball',
      level: 3,
      school: 'Evocation',
      isConcentration: false,
      isRitual: false,
      isPrepared: true,
    },
  ]);

  const [selectedLevels, setSelectedLevels] = useState<Record<string, number>>({});
  const [preparedPlanSlugs, setPreparedPlanSlugs] = useState<string[]>(
    spells.filter((s) => s.isPrepared).map((s) => s.slug),
  );
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  const handleTogglePreparation = (slug: string) => {
    setPreparedPlanSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleApplyPlan = async () => {
    try {
      const res = await commandClient.applyPreparationPlan(
        campaignId,
        actorId,
        profile.profileId,
        preparedPlanSlugs,
      );

      if (res.success) {
        setSpells((prev) =>
          prev.map((s) => ({
            ...s,
            isPrepared: preparedPlanSlugs.includes(s.slug),
          })),
        );
        setStatusMessage({ text: 'Preparation plan applied successfully.' });
      } else {
        setStatusMessage({ text: 'Failed to apply plan.', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error applying preparation plan.', isError: true });
    }
  };

  const handleCastSpell = async (spell: SpellViewItem) => {
    const levelToCast =
      spell.level === 0 ? 0 : selectedLevels[spell.slug] || spell.level;

    if (levelToCast > 0) {
      const available = profile.slots[levelToCast]?.current ?? 0;
      if (available <= 0) {
        setStatusMessage({
          text: `No level ${levelToCast} slots remaining!`,
          isError: true,
        });
        return;
      }
    }

    try {
      const res = await commandClient.castSpell(
        campaignId,
        actorId,
        { kind: 'spell', id: crypto.randomUUID(), revision: 1 },
        profile.profileId,
        levelToCast,
      );

      if (res.success) {
        if (levelToCast > 0) {
          setProfile((prev) => ({
            ...prev,
            slots: {
              ...prev.slots,
              [levelToCast]: {
                ...prev.slots[levelToCast],
                current: Math.max(0, (prev.slots[levelToCast]?.current ?? 1) - 1),
              },
            },
          }));
        }

        if (spell.isConcentration) {
          setConcentration({
            spellSlug: spell.slug,
            castId: crypto.randomUUID(),
            castAtLevel: levelToCast,
          });
        }

        setStatusMessage({
          text: `Cast ${spell.name}${levelToCast > 0 ? ` at level ${levelToCast}` : ''}!`,
        });
      } else {
        setStatusMessage({ text: 'Cast failed.', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error dispatching spell cast.', isError: true });
    }
  };

  const handleEndConcentration = async () => {
    if (!concentration) return;
    try {
      await commandClient.endConcentration(campaignId, actorId, concentration.castId);
      setConcentration(null);
      setStatusMessage({ text: 'Concentration ended.' });
    } catch {
      setStatusMessage({ text: 'Error ending concentration.', isError: true });
    }
  };

  const handleRest = async (restType: 'short' | 'long') => {
    try {
      const res = await commandClient.restActor(campaignId, actorId, restType);
      if (res.success) {
        if (restType === 'long') {
          setProfile((prev) => {
            const restoredSlots: Record<number, { current: number; max: number }> = {};
            for (const [lvl, s] of Object.entries(prev.slots)) {
              restoredSlots[parseInt(lvl, 10)] = { ...s, current: s.max };
            }
            return { ...prev, slots: restoredSlots };
          });
        }
        setStatusMessage({
          text: `${restType === 'long' ? 'Long' : 'Short'} rest completed.`,
        });
      }
    } catch {
      setStatusMessage({ text: `Failed to complete ${restType} rest.`, isError: true });
    }
  };

  return (
    <div className={styles.container} data-testid="spellbook-panel">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>
            <BookOpen size={20} />
            {character ? `${character.name}'s Spellbook` : link.title || 'Spellbook'}
          </h2>
          <div className={styles.subtitle}>{profile.name}</div>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Ability</span>
            <span className={styles.statValue}>{profile.ability}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Save DC</span>
            <span className={styles.statValue}>{profile.saveDC}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Attack</span>
            <span className={styles.statValue}>+{profile.attackBonus}</span>
          </div>
        </div>
      </div>

      {/* Active Concentration Banner */}
      {concentration && (
        <div className={styles.concentrationBanner} data-testid="concentration-banner">
          <div className={styles.concentrationText}>
            <Zap size={16} />
            <span>
              Concentrating on <strong>{concentration.spellSlug}</strong> (Level{' '}
              {concentration.castAtLevel})
            </span>
          </div>
          <button
            onClick={handleEndConcentration}
            className={styles.endConcentrationBtn}
            data-testid="end-concentration-btn"
          >
            <EyeOff size={14} />
            End
          </button>
        </div>
      )}

      {/* Spell Slots */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span>Spell Slots</span>
          <div className={styles.restActions}>
            <button
              onClick={() => handleRest('short')}
              className={styles.restBtn}
              data-testid="short-rest-btn"
              title="Short Rest"
            >
              <Moon size={14} />
              Short Rest
            </button>
            <button
              onClick={() => handleRest('long')}
              className={styles.restBtn}
              data-testid="long-rest-btn"
              title="Long Rest"
            >
              <Sun size={14} />
              Long Rest
            </button>
          </div>
        </div>

        <div className={styles.slotsGrid} data-testid="slots-grid">
          {Object.entries(profile.slots).map(([lvl, s]) => (
            <div key={lvl} className={styles.slotCard} data-testid={`slot-card-${lvl}`}>
              <span className={styles.slotLevel}>Level {lvl}</span>
              <span className={styles.slotCount}>
                {s.current} / {s.max}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Spells List */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span>Spells & Preparations</span>
          <button
            onClick={handleApplyPlan}
            className={styles.applyPlanBtn}
            data-testid="apply-plan-btn"
          >
            Apply Plan
          </button>
        </div>

        {statusMessage && (
          <div
            className={`${styles.statusMessage} ${
              statusMessage.isError ? styles.statusError : styles.statusSuccess
            }`}
            data-testid="spellbook-status"
          >
            {statusMessage.text}
          </div>
        )}

        <div className={styles.spellList}>
          {spells.map((spell) => {
            const isPrepared = preparedPlanSlugs.includes(spell.slug);
            const selectedLevel = selectedLevels[spell.slug] || spell.level;

            return (
              <div key={spell.slug} className={styles.spellItem} data-testid={`spell-item-${spell.slug}`}>
                <div className={styles.spellInfo}>
                  <div className={styles.spellNameRow}>
                    {spell.level > 0 && (
                      <input
                        type="checkbox"
                        checked={isPrepared}
                        onChange={() => handleTogglePreparation(spell.slug)}
                        className={styles.prepareCheckbox}
                        aria-label={`Prepare ${spell.name}`}
                        data-testid={`prepare-checkbox-${spell.slug}`}
                      />
                    )}
                    <span className={styles.spellName}>{spell.name}</span>
                    {spell.level === 0 ? (
                      <span className={styles.preparedBadge}>Cantrip</span>
                    ) : isPrepared ? (
                      <span className={styles.preparedBadge}>Prepared</span>
                    ) : null}
                    {spell.isRitual && <span className={styles.ritualBadge}>Ritual</span>}
                    {spell.isConcentration && (
                      <span className={styles.ritualBadge}>Conc</span>
                    )}
                  </div>
                  <div className={styles.spellMeta}>
                    Level {spell.level} • {spell.school}
                  </div>
                </div>

                <div className={styles.spellActions}>
                  {spell.level > 0 && (
                    <select
                      value={selectedLevel}
                      onChange={(e) =>
                        setSelectedLevels({
                          ...selectedLevels,
                          [spell.slug]: parseInt(e.target.value, 10),
                        })
                      }
                      className={styles.levelSelect}
                      data-testid={`level-select-${spell.slug}`}
                    >
                      {Object.keys(profile.slots)
                        .map((l) => parseInt(l, 10))
                        .filter((l) => l >= spell.level)
                        .map((l) => (
                          <option key={l} value={l}>
                            Lvl {l} ({profile.slots[l]?.current ?? 0} left)
                          </option>
                        ))}
                    </select>
                  )}

                  <button
                    onClick={() => handleCastSpell(spell)}
                    className={styles.castBtn}
                    data-testid={`cast-btn-${spell.slug}`}
                  >
                    <Sparkles size={14} />
                    Cast
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
