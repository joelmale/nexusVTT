import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  generateFactionWeb,
  generateSingleFaction,
  type FactionWebResult,
  type GeneratedFaction,
  type FactionGeneratorOptions,
  type FactionRelationshipType,
} from '@nexus/character-creator';
import Dices from 'lucide-react/dist/esm/icons/dices';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Unlock from 'lucide-react/dist/esm/icons/unlock';
import Network from 'lucide-react/dist/esm/icons/network';
import LayoutList from 'lucide-react/dist/esm/icons/layout-list';
import Users from 'lucide-react/dist/esm/icons/users';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert';

import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { FactionRelationshipMap } from './FactionRelationshipMap';
import styles from './FactionGeneratorModal.module.css';

export interface FactionGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (primaryFactionId: string) => void;
}

const RELATION_COLOR_MAP: Record<
  FactionRelationshipType,
  { bg: string; color: string; border: string }
> = {
  ally: { bg: '#e0ebe4', color: '#244a39', border: '#315f4a' },
  rival: { bg: '#f3dfdd', color: '#a0443f', border: '#a0443f' },
  'uneasy-truce': { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  infiltrated: { bg: '#f3e8ff', color: '#6b21a8', border: '#a855f7' },
  transactional: { bg: '#e0f2fe', color: '#0369a1', border: '#38bdf8' },
  'willful-ignorance': { bg: '#fce7f3', color: '#9d174d', border: '#ec4899' },
  ambivalent: { bg: '#f1f5f9', color: '#475569', border: '#94a3b8' },
  distant: { bg: '#f1f5f9', color: '#475569', border: '#94a3b8' },
  ignorance: { bg: '#f1f5f9', color: '#475569', border: '#94a3b8' },
};

export function FactionGeneratorModal({
  open,
  onClose,
  onCreated,
}: FactionGeneratorModalProps) {
  const { store } = useSectionBundle();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Generator settings
  const [count, setCount] = useState<number>(3);
  const [theme, setTheme] = useState<FactionGeneratorOptions['theme']>('all');
  const [scope, setScope] = useState<'city' | 'regional' | 'world'>('city');
  const [includeRelationships, setIncludeRelationships] = useState<boolean>(true);
  const [keyFiguresMode, setKeyFiguresMode] = useState<'none' | 'leaders' | 'full'>('leaders');
  const [createNpcs, setCreateNpcs] = useState<boolean>(true);

  // View state
  const [activeTab, setActiveTab] = useState<'cards' | 'map'>('cards');
  const [web, setWeb] = useState<FactionWebResult>(() =>
    generateFactionWeb({ count: 3, theme: 'all', scope: 'city', includeRelationships: true }),
  );
  const [lockedTempIds, setLockedTempIds] = useState<Set<string>>(new Set());
  const [selectedFactionId, setSelectedFactionId] = useState<string>();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // Synchronize modal open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      const initial = generateFactionWeb({
        count,
        theme,
        scope,
        includeRelationships,
        keyFiguresMode,
      });
      setWeb(initial);
      setLockedTempIds(new Set());
      setSelectedFactionId(initial.factions[0]?.tempId);
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleCountChange = (newCount: number) => {
    setCount(newCount);
    const updated = generateFactionWeb({
      count: newCount,
      theme,
      scope,
      includeRelationships,
      keyFiguresMode,
    });
    setWeb(updated);
    setLockedTempIds(new Set());
    setSelectedFactionId(updated.factions[0]?.tempId);
  };

  const handleThemeChange = (newTheme: FactionGeneratorOptions['theme']) => {
    setTheme(newTheme);
    const updated = generateFactionWeb({
      count,
      theme: newTheme,
      scope,
      includeRelationships,
      keyFiguresMode,
    });
    setWeb(updated);
    setSelectedFactionId(updated.factions[0]?.tempId);
  };

  const handleScopeChange = (newScope: 'city' | 'regional' | 'world') => {
    setScope(newScope);
    const updated = generateFactionWeb({
      count,
      theme,
      scope: newScope,
      includeRelationships,
      keyFiguresMode,
    });
    setWeb(updated);
  };

  const handleKeyFiguresModeChange = (newMode: 'none' | 'leaders' | 'full') => {
    setKeyFiguresMode(newMode);
    const updated = generateFactionWeb({
      count,
      theme,
      scope,
      includeRelationships,
      keyFiguresMode: newMode,
    });
    setWeb(updated);
  };

  const handleRelationshipsToggle = (nextInclude: boolean) => {
    setIncludeRelationships(nextInclude);
    const updated = generateFactionWeb({
      count,
      theme,
      scope,
      includeRelationships: nextInclude,
      keyFiguresMode,
    });
    setWeb(updated);
  };

  const toggleLock = (tempId: string) => {
    setLockedTempIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  const handleRerollWeb = () => {
    if (lockedTempIds.size === 0) {
      const fresh = generateFactionWeb({
        count,
        theme,
        scope,
        includeRelationships,
        keyFiguresMode,
      });
      setWeb(fresh);
      setSelectedFactionId(fresh.factions[0]?.tempId);
      return;
    }

    // Preserve locked factions and reroll unlocked ones
    const preservedFactions = web.factions.filter((f) => lockedTempIds.has(f.tempId));
    const needed = Math.max(0, count - preservedFactions.length);

    let nextCounter = 100 + Date.now();
    const freshWeb = generateFactionWeb({
      count: needed,
      theme,
      scope,
      includeRelationships: false, // We'll link together
      keyFiguresMode,
    });
    freshWeb.factions.forEach((f) => {
      f.tempId = `faction-temp-${++nextCounter}`;
    });

    const combined = [...preservedFactions, ...freshWeb.factions].slice(0, count);

    // Re-link relationships across all combined factions if enabled
    if (includeRelationships && combined.length > 1) {
      const reconnected = generateFactionWeb({
        count: combined.length,
        theme,
        scope,
        includeRelationships: true,
        keyFiguresMode,
      });
      // Transfer generated relationships onto combined factions
      combined.forEach((faction, idx) => {
        const corresponding = reconnected.factions[idx];
        if (corresponding) {
          faction.relationships = corresponding.relationships.map((rel) => {
            const targetIdx = reconnected.factions.findIndex(
              (f) => f.tempId === rel.targetTempId,
            );
            const actualTarget = targetIdx >= 0 ? combined[targetIdx] : undefined;
            return {
              ...rel,
              targetTempId: actualTarget?.tempId || rel.targetTempId,
              targetFactionName: actualTarget?.name || rel.targetFactionName,
            };
          });
        }
      });
    }

    setWeb({
      flashpoint: freshWeb.flashpoint || web.flashpoint,
      scope,
      theme: theme || 'all',
      factions: combined,
    });
  };

  const handleRerollSingle = (tempId: string) => {
    const single = generateSingleFaction(
      { theme, scope, keyFiguresMode },
      tempId,
    );
    setWeb((prev) => {
      const nextFactions = prev.factions.map((f) => (f.tempId === tempId ? single : f));
      // Re-establish relationships if enabled
      if (includeRelationships && nextFactions.length > 1) {
        for (const other of nextFactions) {
          if (other.tempId !== tempId) {
            // Give single a relationship to other and vice versa
            single.relationships.push({
              targetTempId: other.tempId,
              targetFactionName: other.name,
              type: 'ambivalent',
              summary: `Maintains standard relations with ${other.name}.`,
            });
            other.relationships = other.relationships.filter(
              (r) => r.targetTempId !== tempId,
            );
            other.relationships.push({
              targetTempId: tempId,
              targetFactionName: single.name,
              type: 'ambivalent',
              summary: `Maintains standard relations with ${single.name}.`,
            });
          }
        }
      }
      return {
        ...prev,
        factions: nextFactions,
      };
    });
  };

  const updateFactionField = (
    tempId: string,
    field: keyof GeneratedFaction,
    value: unknown,
  ) => {
    setWeb((prev) => ({
      ...prev,
      factions: prev.factions.map((f) =>
        f.tempId === tempId ? { ...f, [field]: value } : f,
      ),
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    for (const f of web.factions) {
      if (!f.name.trim()) {
        setError('All factions must have a name.');
        return;
      }
    }

    setBusy(true);
    setError(undefined);

    try {
      const tempToRealIdMap: Record<string, string> = {};
      const primaryCreatedIds: string[] = [];

      // Step 1: Create each faction and optional key figures
      for (const faction of web.factions) {
        let leaderNpcId: string | undefined = undefined;

        // If creating NPCs, persist key figures first
        if (createNpcs && faction.keyFigures.length > 0) {
          for (const figure of faction.keyFigures) {
            const npcResult = await store.addItem('npc', {
              name: figure.name,
              role: `${figure.title} (${faction.name})`,
              ancestry: figure.ancestry,
              motivation: figure.motivation,
              relationship: `Key figure of ${faction.name}. ${figure.personality}`,
              tags: ['Faction Leader', faction.name],
              factionIds: [], // Will be backfilled
              locationIds: [],
              sessionIds: [],
            });

            if (npcResult.ok && npcResult.id) {
              if (figure.role === 'leader' && !leaderNpcId) {
                leaderNpcId = npcResult.id;
              }
            }
          }
        }

        // Add the faction
        const factionResult = await store.addItem('faction', {
          name: faction.name.trim(),
          status: faction.status,
          publicFace: faction.publicFace.trim(),
          hiddenAgenda: faction.hiddenAgenda.trim(),
          leaderNpcId: leaderNpcId ?? '',
          alliedFactionIds: [],
          rivalFactionIds: [],
          locationIds: [],
          questIds: [],
        });

        if (!factionResult.ok || !factionResult.id) {
          throw new Error(factionResult.error || 'Failed to create faction.');
        }

        tempToRealIdMap[faction.tempId] = factionResult.id;
        primaryCreatedIds.push(factionResult.id);
      }

      // Step 2: Update allied & rival relationships once all real IDs are known
      for (const faction of web.factions) {
        const realId = tempToRealIdMap[faction.tempId];
        if (!realId) continue;

        const alliedFactionIds: string[] = [];
        const rivalFactionIds: string[] = [];

        for (const rel of faction.relationships) {
          const targetRealId = tempToRealIdMap[rel.targetTempId];
          if (!targetRealId) continue;

          if (rel.type === 'ally') {
            alliedFactionIds.push(targetRealId);
          } else if (
            rel.type === 'rival' ||
            rel.type === 'uneasy-truce' ||
            rel.type === 'infiltrated' ||
            rel.type === 'willful-ignorance'
          ) {
            rivalFactionIds.push(targetRealId);
          }
        }

        if (alliedFactionIds.length > 0 || rivalFactionIds.length > 0) {
          await store.updateItem('faction', realId, {
            alliedFactionIds,
            rivalFactionIds,
          });
        }
      }

      setBusy(false);
      if (primaryCreatedIds[0] && onCreated) {
        onCreated(primaryCreatedIds[0]);
      }
      onClose();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Failed to save factions.');
    }
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>
              <Users size={20} />
              Procedural Faction Generator
            </h3>
            <p className={styles.subtitle}>
              Generate individual organizations or multi-faction political ecosystems with narrative tension.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.rerollButton}
              type="button"
              onClick={handleRerollWeb}
              title="Reroll all unlocked factions"
            >
              <Dices size={15} />
              Reroll Ecosystem
            </button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className={styles.configBar}>
          <label className={styles.configField}>
            <span className={styles.configLabel}>Count</span>
            <select
              className={styles.configSelect}
              value={count}
              onChange={(e) => handleCountChange(Number(e.target.value))}
            >
              <option value={1}>1 (Single Faction)</option>
              <option value={2}>2 (Pair / Rivals)</option>
              <option value={3}>3 (Triad / Tension)</option>
              <option value={4}>4 (Quartet)</option>
              <option value={5}>5 (Full Web)</option>
            </select>
          </label>

          <label className={styles.configField}>
            <span className={styles.configLabel}>Theme</span>
            <select
              className={styles.configSelect}
              value={theme}
              onChange={(e) =>
                handleThemeChange(e.target.value as FactionGeneratorOptions['theme'])
              }
            >
              <option value="all">All Archetypes</option>
              <option value="comedic">Comedic & Satirical (Discworld)</option>
              <option value="churches">Churches & Simple Faiths</option>
              <option value="intrigue">Court Intrigue & Nobility</option>
              <option value="underworld">Underworld & Smugglers</option>
              <option value="arcane">Arcane Academies & Cults</option>
              <option value="military">Military & Mercenaries</option>
            </select>
          </label>

          <label className={styles.configField}>
            <span className={styles.configLabel}>Scope</span>
            <select
              className={styles.configSelect}
              value={scope}
              onChange={(e) =>
                handleScopeChange(e.target.value as 'city' | 'regional' | 'world')
              }
            >
              <option value="city">City / Municipal</option>
              <option value="regional">Regional / Province</option>
              <option value="world">World / Continental</option>
            </select>
          </label>

          <label className={styles.configField}>
            <span className={styles.configLabel}>Key Figures</span>
            <select
              className={styles.configSelect}
              value={keyFiguresMode}
              onChange={(e) =>
                handleKeyFiguresModeChange(e.target.value as 'none' | 'leaders' | 'full')
              }
            >
              <option value="none">None</option>
              <option value="leaders">Leaders Only</option>
              <option value="full">Leaders + Lieutenants</option>
            </select>
          </label>

          {count > 1 && (
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeRelationships}
                onChange={(e) => handleRelationshipsToggle(e.target.checked)}
              />
              Interconnect Relationships
            </label>
          )}

          {keyFiguresMode !== 'none' && (
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={createNpcs}
                onChange={(e) => setCreateNpcs(e.target.checked)}
              />
              Save Figures as NPCs
            </label>
          )}
        </div>

        {/* View Switcher Tabs */}
        {count > 1 && (
          <div className={styles.tabBar}>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'cards' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('cards')}
            >
              <LayoutList size={16} />
              Faction Profiles ({web.factions.length})
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'map' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <Network size={16} />
              Relationship Web Graphic
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className={styles.content}>
          {/* Flashpoint banner */}
          {web.flashpoint && count > 1 && (
            <div className={styles.flashpointBanner}>
              <div className={styles.flashpointHeader}>
                <h4 className={styles.flashpointTitle}>
                  <ShieldAlert size={16} />
                  Central Flashpoint: {web.flashpoint.title}
                </h4>
                <span className={styles.flashpointResource}>
                  Contested: {web.flashpoint.contestedResource}
                </span>
              </div>
              <p className={styles.flashpointSummary}>{web.flashpoint.summary}</p>
              <p className={styles.flashpointStakes}>
                <strong>Stakes:</strong> {web.flashpoint.stakes}
              </p>
            </div>
          )}

          {activeTab === 'map' && count > 1 ? (
            <FactionRelationshipMap
              factions={web.factions}
              selectedFactionId={selectedFactionId}
              onSelectFaction={(id) => {
                setSelectedFactionId(id);
                setActiveTab('cards');
              }}
            />
          ) : (
            <div className={styles.factionsList}>
              {web.factions.map((faction) => {
                const isLocked = lockedTempIds.has(faction.tempId);

                return (
                  <div key={faction.tempId} className={styles.factionCard}>
                    {/* Faction Header */}
                    <div className={styles.factionCardHeader}>
                      <div className={styles.factionCardTitleGroup}>
                        <input
                          className={styles.factionNameInput}
                          value={faction.name}
                          onChange={(e) =>
                            updateFactionField(faction.tempId, 'name', e.target.value)
                          }
                          placeholder="Faction Name"
                        />
                        <span className={styles.archetypeBadge}>
                          {faction.archetype}
                        </span>
                      </div>

                      <div className={styles.cardActions}>
                        <select
                          className={styles.statusSelect}
                          value={faction.status}
                          onChange={(e) =>
                            updateFactionField(faction.tempId, 'status', e.target.value)
                          }
                        >
                          <option value="ally">Party Ally</option>
                          <option value="neutral">Neutral</option>
                          <option value="opposition">Opposition</option>
                          <option value="unknown">Unknown</option>
                        </select>

                        <button
                          type="button"
                          className={`${styles.lockButton} ${isLocked ? styles.locked : ''}`}
                          onClick={() => toggleLock(faction.tempId)}
                          title={isLocked ? 'Unlock faction' : 'Lock faction from rerolls'}
                        >
                          {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>

                        <button
                          type="button"
                          className={styles.cardRerollButton}
                          onClick={() => handleRerollSingle(faction.tempId)}
                          title="Reroll only this faction"
                        >
                          <Dices size={13} />
                          Reroll
                        </button>
                      </div>
                    </div>

                    {/* Inputs Grid */}
                    <div className={styles.gridRow}>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Public Face</span>
                        <textarea
                          className={styles.fieldTextarea}
                          value={faction.publicFace}
                          onChange={(e) =>
                            updateFactionField(
                              faction.tempId,
                              'publicFace',
                              e.target.value,
                            )
                          }
                          rows={2}
                        />
                      </div>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Hidden Agenda (DM Only)</span>
                        <textarea
                          className={styles.fieldTextarea}
                          value={faction.hiddenAgenda}
                          onChange={(e) =>
                            updateFactionField(
                              faction.tempId,
                              'hiddenAgenda',
                              e.target.value,
                            )
                          }
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className={styles.gridRow}>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Motto / Maxim</span>
                        <input
                          className={styles.fieldInput}
                          value={faction.motto}
                          onChange={(e) =>
                            updateFactionField(faction.tempId, 'motto', e.target.value)
                          }
                        />
                      </div>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Primary Asset / Vulnerability</span>
                        <input
                          className={styles.fieldInput}
                          value={`${faction.primaryAsset} / Vuln: ${faction.vulnerability}`}
                          onChange={(e) =>
                            updateFactionField(
                              faction.tempId,
                              'primaryAsset',
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Key Figures */}
                    {faction.keyFigures.length > 0 && (
                      <div className={styles.keyFiguresSection}>
                        <h5 className={styles.keyFiguresTitle}>
                          <Users size={14} />
                          Key Figures ({faction.keyFigures.length})
                        </h5>
                        <div className={styles.gridRow}>
                          {faction.keyFigures.map((fig) => (
                            <div key={fig.name} className={styles.figureCard}>
                              <div className={styles.figureInfo}>
                                <span className={styles.figureName}>
                                  {fig.name} — {fig.title} ({fig.role})
                                </span>
                                <span className={styles.figureDetails}>
                                  {fig.ancestry} • {fig.personality}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Relationships */}
                    {faction.relationships.length > 0 && (
                      <div className={styles.relationsBox}>
                        <h5 className={styles.relationsTitle}>Inter-Faction Dynamics</h5>
                        {faction.relationships.map((rel) => {
                          const styleInfo =
                            RELATION_COLOR_MAP[rel.type] || RELATION_COLOR_MAP.ambivalent;
                          return (
                            <div key={rel.targetTempId} className={styles.relationItem}>
                              <span
                                className={styles.relationBadge}
                                style={{
                                  backgroundColor: styleInfo.bg,
                                  color: styleInfo.color,
                                  border: `1px solid ${styleInfo.border}`,
                                }}
                              >
                                {rel.type.replace('-', ' ')}
                              </span>
                              <span>
                                <strong>{rel.targetFactionName}:</strong> {rel.summary}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {error && <p className={styles.errorNotice}>{error}</p>}
          </div>
          <div className={styles.footerRight}>
            <button
              className={styles.cancelButton}
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className={styles.submitButton}
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Adding to Campaign...'
                : `Add ${web.factions.length === 1 ? 'Faction' : `${web.factions.length} Factions`} to Campaign`}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
