import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  type CampaignItemHolderKind,
  ITEM_RARITIES,
  ITEM_TYPES,
} from '@/demo/fixture-registry';
import { FilterBar, type FilterFacet } from '@/features/section-shell/FilterBar';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';
import type { SrdItem } from '@/services/srd-items-api';

import {
  ITEM_TYPE_LABELS,
  RARITY_LABELS,
} from './itemsModel';
import { searchItems } from './itemSearch';
import { RarityBadge } from './RarityBadge';
import { useSrdCatalog } from './useSrdCatalog';
import styles from './CompendiumPane.module.css';

interface CompendiumPaneProps {
  onAddedItem?: (itemId: string) => void;
}

export function CompendiumPane({ onAddedItem }: CompendiumPaneProps) {
  const { bundle, basePath, store } = useSectionBundle();
  const { get, set } = useSectionQuery();

  const campaignEdition =
    bundle.campaign?.edition === '2014' || bundle.catalog?.edition === '2014'
      ? '2014'
      : '2024';

  const [ruleset, setRuleset] = useState<string>(get('ruleset') || campaignEdition);
  const { catalog, loading, error, isFallback, reload, useFallbackCatalog } = useSrdCatalog(ruleset);

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | undefined>();

  // Add form state
  const [holderKind, setHolderKind] = useState<CampaignItemHolderKind>('none');
  const [holderEntityId, setHolderEntityId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [sessionId, setSessionId] = useState<string>('');

  const q = get('q');
  const rarityFilter = get('rarity');
  const typeFilter = get('type');

  // Search and filter
  const searchResults = useMemo(() => {
    let rawQuery = q.trim();
    if (rarityFilter) rawQuery += ` rarity:${rarityFilter}`;
    if (typeFilter) rawQuery += ` type:${typeFilter}`;
    return searchItems(catalog, rawQuery);
  }, [catalog, q, rarityFilter, typeFilter]);

  const selectedResult = useMemo(
    () => searchResults.find((r) => r.item.id === selectedId) ?? searchResults[0],
    [searchResults, selectedId],
  );

  const selectedItem: SrdItem | undefined = selectedResult?.item;

  // Track which SRD items are already in campaign
  const inCampaignIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of bundle.items ?? []) {
      if (item.source?.entityId) {
        ids.add(item.source.entityId);
      }
    }
    return ids;
  }, [bundle.items]);

  // Facets
  const facets: FilterFacet[] = [
    {
      key: 'type',
      label: 'Type',
      options: ITEM_TYPES.map((t) => ({
        value: t,
        label: ITEM_TYPE_LABELS[t] ?? t,
      })),
    },
    {
      key: 'rarity',
      label: 'Rarity',
      options: ITEM_RARITIES.map((r) => ({
        value: r,
        label: RARITY_LABELS[r] ?? r,
      })),
    },
  ];

  const handleRulesetChange = (newRuleset: string) => {
    setRuleset(newRuleset);
    set('ruleset', newRuleset);
    setSelectedId(undefined);
  };

  const handleAdd = async () => {
    if (!selectedItem || !store.editable) return;
    setAdding(true);
    setAddSuccess(undefined);

    let holder: { kind: CampaignItemHolderKind; entityId?: string } = {
      kind: holderKind,
    };
    if (holderKind !== 'none' && holderEntityId) {
      holder = { kind: holderKind, entityId: holderEntityId };
    }

    const payload = {
      name: selectedItem.name,
      itemType: selectedItem.itemType,
      rarity: selectedItem.rarity,
      requiresAttunement: selectedItem.requiresAttunement,
      ...(selectedItem.attunementNote ? { attunementNote: selectedItem.attunementNote } : {}),
      ...(selectedItem.valueGp !== undefined ? { valueGp: selectedItem.valueGp } : {}),
      ...(selectedItem.weightLb !== undefined ? { weightLb: selectedItem.weightLb } : {}),
      quantity: Math.max(1, Number(quantity) || 1),
      description: selectedItem.description,
      holder,
      discovered: false,
      identified: true,
      source: { ruleset: selectedItem.ruleset, entityId: selectedItem.id },
      ...(sessionId ? { sessionId } : {}),
    };

    const result = await store.addItem('item', payload);
    setAdding(false);

    if (result.ok && result.id) {
      setAddSuccess(result.id);
      onAddedItem?.(result.id);
    }
  };

  return (
    <div className={styles.compendium}>
      <div className={styles.topBar}>
        <div className={styles.rulesetSwitch}>
          <span>Ruleset:</span>
          <button
            className={`${styles.rulesetBtn} ${ruleset === '2024' ? styles.active : ''}`}
            onClick={() => handleRulesetChange('2024')}
            type="button"
          >
            2024
          </button>
          <button
            className={`${styles.rulesetBtn} ${ruleset === '2014' ? styles.active : ''}`}
            onClick={() => handleRulesetChange('2014')}
            type="button"
          >
            2014 (legacy)
          </button>
        </div>
      </div>

      <FilterBar
        facets={facets}
        plural="items"
        resultCount={searchResults.length}
        searchLabel="Search Compendium items"
        singular="item"
      />

      {loading ? <p>Loading compendium...</p> : null}

      {error ? (
        <div className={styles.errorNotice} role="alert">
          <p>{error}</p>
          <div className={styles.errorActions}>
            <button onClick={() => void reload()} type="button">
              Retry
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={useFallbackCatalog}
              type="button"
            >
              Use bundled catalog
            </button>
          </div>
        </div>
      ) : null}

      {isFallback && !error ? (
        <div className={styles.fallbackNotice}>
          <span>Using bundled {ruleset} SRD catalog (live rules service has no published items).</span>
          <button
            className={styles.checkServerBtn}
            onClick={() => void reload()}
            type="button"
          >
            Check server
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className={styles.body}>
          <div
            aria-label="Compendium items list"
            className={styles.listColumn}
            role="listbox"
          >
            {searchResults.map((result) => {
              const item = result.item;
              const isSelected = selectedItem?.id === item.id;
              const inCampaign = inCampaignIds.has(item.id);

              return (
                <button
                  aria-selected={isSelected}
                  className={`${styles.itemRow} ${isSelected ? styles.selected : ''}`}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setAddSuccess(undefined);
                  }}
                  role="option"
                  type="button"
                >
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>
                      {result.matchedNameHighlights.map((seg, idx) =>
                        seg.match ? (
                          <mark className={styles.highlight} key={idx}>
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={idx}>{seg.text}</span>
                        ),
                      )}
                    </span>
                    <span className={styles.itemMeta}>
                      {ITEM_TYPE_LABELS[item.itemType as keyof typeof ITEM_TYPE_LABELS] ?? item.itemType}
                      {item.valueGp !== undefined ? ` · ${item.valueGp} gp` : ''}
                    </span>
                  </div>
                  <div className={styles.itemBadges}>
                    {inCampaign ? (
                      <span className={styles.inCampaignBadge}>✓ In campaign</span>
                    ) : null}
                    <RarityBadge rarity={item.rarity} />
                  </div>
                </button>
              );
            })}
            {searchResults.length === 0 ? (
              <p className={styles.noSelection}>No compendium items match your query.</p>
            ) : null}
          </div>

          <div className={styles.detailColumn}>
            {selectedItem ? (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.title}>{selectedItem.name}</h2>
                  <p className={styles.subtitle}>
                    {ITEM_TYPE_LABELS[selectedItem.itemType as keyof typeof ITEM_TYPE_LABELS] ?? selectedItem.itemType}
                    {selectedItem.rarity !== 'none'
                      ? `, ${RARITY_LABELS[selectedItem.rarity]}`
                      : ''}
                    {selectedItem.requiresAttunement
                      ? ` (${selectedItem.attunementNote || 'requires attunement'})`
                      : ''}
                  </p>
                </div>

                <div className={styles.properties}>
                  {selectedItem.valueGp !== undefined ? (
                    <span className={styles.propItem}>
                      <strong>Value:</strong> {selectedItem.valueGp} gp
                    </span>
                  ) : null}
                  {selectedItem.weightLb !== undefined ? (
                    <span className={styles.propItem}>
                      <strong>Weight:</strong> {selectedItem.weightLb} lb
                    </span>
                  ) : null}
                </div>

                <div className={styles.description}>
                  {selectedItem.description || 'No description provided.'}
                </div>

                {store.editable ? (
                  <div className={styles.addBox}>
                    <h3 className={styles.addBoxHeading}>Add to Campaign</h3>
                    <div className={styles.addControls}>
                      <div className={styles.addControl}>
                        <label htmlFor="give-to-kind">Give to</label>
                        <select
                          id="give-to-kind"
                          onChange={(e) => {
                            setHolderKind(e.target.value as CampaignItemHolderKind);
                            setHolderEntityId('');
                          }}
                          value={holderKind}
                        >
                          <option value="none">Unassigned</option>
                          <option value="party-member">Party member</option>
                          <option value="npc">NPC</option>
                          <option value="location">Location</option>
                          <option value="encounter">Encounter</option>
                        </select>
                      </div>

                      {holderKind !== 'none' ? (
                        <div className={styles.addControl}>
                          <label htmlFor="give-to-entity">Select entity</label>
                          <select
                            id="give-to-entity"
                            onChange={(e) => setHolderEntityId(e.target.value)}
                            value={holderEntityId}
                          >
                            <option value="">Choose...</option>
                            {holderKind === 'party-member'
                              ? bundle.campaign.playerCharacters.map((pc) => (
                                  <option key={pc.id} value={pc.id}>
                                    {pc.name}
                                  </option>
                                ))
                              : holderKind === 'npc'
                                ? bundle.npcs.map((npc) => (
                                    <option key={npc.id} value={npc.id}>
                                      {npc.name}
                                    </option>
                                  ))
                                : holderKind === 'location'
                                  ? bundle.locations.map((loc) => (
                                      <option key={loc.id} value={loc.id}>
                                        {loc.name}
                                      </option>
                                    ))
                                  : bundle.encounters.map((enc) => (
                                      <option key={enc.id} value={enc.id}>
                                        {enc.title}
                                      </option>
                                    ))}
                          </select>
                        </div>
                      ) : null}

                      <div className={styles.addControl}>
                        <label htmlFor="item-qty">Quantity</label>
                        <input
                          id="item-qty"
                          min="1"
                          onChange={(e) => setQuantity(e.target.value)}
                          type="number"
                          value={quantity}
                        />
                      </div>

                      <div className={styles.addControl}>
                        <label htmlFor="item-session">Hand out in session</label>
                        <select
                          id="item-session"
                          onChange={(e) => setSessionId(e.target.value)}
                          value={sessionId}
                        >
                          <option value="">None (Unscheduled)</option>
                          {(bundle.sessions ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              Session {s.number}: {s.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      className={styles.addButton}
                      disabled={adding}
                      onClick={() => void handleAdd()}
                      type="button"
                    >
                      {adding
                        ? 'Adding...'
                        : inCampaignIds.has(selectedItem.id)
                          ? 'Add Another to Campaign'
                          : 'Add to Campaign'}
                    </button>

                    {addSuccess ? (
                      <div className={styles.successNotice} role="status">
                        <span>✓ Added to campaign!</span>
                        <Link to={`${basePath}/items/${encodeURIComponent(addSuccess)}`}>
                          View in Campaign Items →
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.noSelection}>Select an item from the list to preview.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
