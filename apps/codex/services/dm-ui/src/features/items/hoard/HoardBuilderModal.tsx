import Check from 'lucide-react/dist/esm/icons/check';
import Coins from 'lucide-react/dist/esm/icons/coins';
import Dices from 'lucide-react/dist/esm/icons/dices';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import X from 'lucide-react/dist/esm/icons/x';
import { useEffect, useId, useState } from 'react';

import type { CampaignFixtureBundle } from '../../../demo/fixture-registry';
import type { CampaignItemHolderKind } from '../../../demo/fixture-registry/types';
import type { BundleStore } from '../../section-shell/bundleStore';
import { RarityBadge } from '../RarityBadge';
import type { SrdItem } from '../useSrdCatalog';
import { rollTreasure, type RolledTreasureResult } from './hoardRoller';
import type { TreasureTier, TreasureType } from './tables2024';
import styles from './HoardBuilderModal.module.css';

export interface HoardBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: CampaignFixtureBundle;
  store: BundleStore;
  compendiumItems?: SrdItem[];
  onItemsAdded?: () => void;
}

export function HoardBuilderModal({
  isOpen,
  onClose,
  bundle,
  store,
  compendiumItems = [],
  onItemsAdded,
}: HoardBuilderModalProps) {
  const [tier, setTier] = useState<TreasureTier>('0-4');
  const [type, setType] = useState<TreasureType>('hoard');
  const [result, setResult] = useState<RolledTreasureResult | null>(null);
  const [selectedHolderId, setSelectedHolderId] = useState<string>('unassigned');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const titleId = useId();

  // Reset or initial roll when opened
  useEffect(() => {
    if (isOpen && !result) {
      setResult(rollTreasure({ tier, type, compendiumItems }));
    }
  }, [isOpen, tier, type, compendiumItems, result]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRoll = () => {
    setAddedCount(null);
    setResult(rollTreasure({ tier, type, compendiumItems }));
  };

  const handleAddAll = async () => {
    if (!result || isAdding) return;
    setIsAdding(true);

    let holder: { kind: CampaignItemHolderKind; id: string } | undefined;
    if (selectedHolderId !== 'unassigned') {
      // Check party characters
      const isPc = bundle.campaign.playerCharacters.some((pc) => pc.id === selectedHolderId);
      if (isPc) {
        holder = { kind: 'party-member', id: selectedHolderId };
      } else {
        // Check locations
        const isLoc = bundle.locations.some((loc) => loc.id === selectedHolderId);
        if (isLoc) {
          holder = { kind: 'location', id: selectedHolderId };
        } else {
          holder = { kind: 'npc', id: selectedHolderId };
        }
      }
    }

    let count = 0;

    // 1. Add coins if any
    if (result.coins.totalGp > 0) {
      const coinDesc = [
        result.coins.cp ? `${result.coins.cp} CP` : '',
        result.coins.sp ? `${result.coins.sp} SP` : '',
        result.coins.ep ? `${result.coins.ep} EP` : '',
        result.coins.gp ? `${result.coins.gp} GP` : '',
        result.coins.pp ? `${result.coins.pp} PP` : '',
      ]
        .filter(Boolean)
        .join(', ');

      await store.addItem('item', {
        name: `Coin Hoard (${result.coins.totalGp.toLocaleString()} gp)`,
        type: 'loot',
        rarity: 'common',
        valueGp: result.coins.totalGp,
        quantity: 1,
        description: `Treasure coins: ${coinDesc}`,
        holder,
        discovered: false,
        identified: true,
        ...(selectedSessionId ? { sessionId: selectedSessionId } : {}),
      });
      count++;
    }

    // 2. Add valuables
    for (const val of result.valuables) {
      await store.addItem('item', {
        name: val.name,
        type: val.category === 'gem' ? 'gem' : 'loot',
        rarity: 'common',
        valueGp: val.unitGp,
        quantity: val.count,
        description: `Rolled from ${result.tier} treasure hoard (${val.totalGp} gp total).`,
        holder,
        discovered: false,
        identified: true,
        ...(selectedSessionId ? { sessionId: selectedSessionId } : {}),
      });
      count++;
    }

    // 3. Add magic items
    for (const item of result.magicItems) {
      await store.addItem('item', {
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        valueGp: item.valueGp,
        attunement: item.attunement,
        description: item.description || `Rolled from ${result.tier} treasure hoard.`,
        source: item.sourceCompendiumId
          ? { ruleset: '2024', entityId: item.sourceCompendiumId }
          : undefined,
        holder,
        discovered: false,
        identified: false,
        ...(selectedSessionId ? { sessionId: selectedSessionId } : {}),
      });
      count++;
    }

    setIsAdding(false);
    setAddedCount(count);
    onItemsAdded?.();
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Sparkles className={styles.titleIcon} size={20} />
            <h2 id={titleId} className={styles.title}>
              Treasure Hoard Builder (2024 DMG)
            </h2>
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.controlsGrid}>
            <div className={styles.controlField}>
              <label htmlFor="tier-select" className={styles.label}>
                Challenge Tier
              </label>
              <select
                id="tier-select"
                className={styles.select}
                value={tier}
                onChange={(e) => setTier(e.target.value as TreasureTier)}
              >
                <option value="0-4">Challenge 0–4 (Tier 1)</option>
                <option value="5-10">Challenge 5–10 (Tier 2)</option>
                <option value="11-16">Challenge 11–16 (Tier 3)</option>
                <option value="17+">Challenge 17+ (Tier 4)</option>
              </select>
            </div>

            <div className={styles.controlField}>
              <label htmlFor="type-select" className={styles.label}>
                Treasure Type
              </label>
              <select
                id="type-select"
                className={styles.select}
                value={type}
                onChange={(e) => setType(e.target.value as TreasureType)}
              >
                <option value="hoard">Treasure Hoard</option>
                <option value="individual">Individual Treasure</option>
              </select>
            </div>

            <button className={styles.rollButton} onClick={handleRoll}>
              <Dices size={18} />
              <span>Roll</span>
            </button>
          </div>

          {result ? (
            <div className={styles.resultsCard}>
              <div className={resultHeaderClass(styles)}>
                <span className={styles.rollBadge}>
                  d100 Roll: <strong>{result.d100Roll}</strong>
                </span>
                <span className={styles.totalValue}>
                  Total: {result.totalGp.toLocaleString()} gp
                </span>
              </div>

              {/* Coins */}
              <div className={styles.coinsSection}>
                <h4 className={styles.sectionHeading}>Coins</h4>
                <div className={styles.coinsGrid}>
                  <div className={styles.coinBox}>
                    <div className={styles.coinLabel}>CP</div>
                    <div className={styles.coinVal}>{result.coins.cp.toLocaleString()}</div>
                  </div>
                  <div className={styles.coinBox}>
                    <div className={styles.coinLabel}>SP</div>
                    <div className={styles.coinVal}>{result.coins.sp.toLocaleString()}</div>
                  </div>
                  <div className={styles.coinBox}>
                    <div className={styles.coinLabel}>EP</div>
                    <div className={styles.coinVal}>{result.coins.ep.toLocaleString()}</div>
                  </div>
                  <div className={styles.coinBox}>
                    <div className={styles.coinLabel}>GP</div>
                    <div className={styles.coinVal}>{result.coins.gp.toLocaleString()}</div>
                  </div>
                  <div className={styles.coinBox}>
                    <div className={styles.coinLabel}>PP</div>
                    <div className={styles.coinVal}>{result.coins.pp.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Valuables (Gems / Art) */}
              {result.valuables.length > 0 && (
                <div className={styles.valuablesSection}>
                  <h4 className={styles.sectionHeading}>Gems & Art Objects</h4>
                  <ul className={styles.itemList}>
                    {result.valuables.map((val, idx) => (
                      <li key={idx} className={styles.itemRow}>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>
                            {val.count} × {val.name}
                          </span>
                        </div>
                        <span className={styles.itemValue}>
                          {val.totalGp.toLocaleString()} gp
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Magic Items */}
              {result.magicItems.length > 0 && (
                <div className={styles.magicItemsSection}>
                  <h4 className={styles.sectionHeading}>Magic Items</h4>
                  <ul className={styles.itemList}>
                    {result.magicItems.map((item, idx) => (
                      <li key={idx} className={styles.itemRow}>
                        <div className={styles.itemInfo}>
                          <RarityBadge rarity={item.rarity} />
                          <span className={styles.itemName}>{item.name}</span>
                        </div>
                        {item.valueGp !== undefined && (
                          <span className={styles.itemValue}>
                            ~{item.valueGp.toLocaleString()} gp
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Holder & Session Assignment */}
              <div className={styles.assignmentArea}>
                <div className={styles.controlField}>
                  <label htmlFor="holder-select" className={styles.label}>
                    Assign Holder
                  </label>
                  <select
                    id="holder-select"
                    className={styles.select}
                    value={selectedHolderId}
                    onChange={(e) => setSelectedHolderId(e.target.value)}
                  >
                    <option value="unassigned">— Unassigned (Placed) —</option>
                    <optgroup label="Party Characters">
                      {bundle.campaign.playerCharacters.map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Locations">
                      {bundle.locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="NPCs">
                      {bundle.npcs.map((npc) => (
                        <option key={npc.id} value={npc.id}>
                          {npc.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className={styles.controlField}>
                  <label htmlFor="session-select" className={styles.label}>
                    Session Reward
                  </label>
                  <select
                    id="session-select"
                    className={styles.select}
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {bundle.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        Session {s.number}: {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.emptyResults}>
              Click Roll to generate treasure.
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
          <button
            className={styles.addBtn}
            onClick={handleAddAll}
            disabled={!result || isAdding || addedCount !== null}
          >
            {addedCount !== null ? (
              <>
                <Check size={16} />
                <span>Added {addedCount} Items!</span>
              </>
            ) : isAdding ? (
              <span>Adding items…</span>
            ) : (
              <>
                <Coins size={16} />
                <span>Add All to Campaign</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function resultHeaderClass(styles: Record<string, string>): string {
  return styles.resultHeader;
}
