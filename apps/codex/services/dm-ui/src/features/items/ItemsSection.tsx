import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';

import {
  ITEM_RARITIES,
  ITEM_TYPES,
  type CampaignFixtureBundle,
  type CampaignItem,
  type CampaignItemHolderKind,
} from '@/demo/fixture-registry';
import { MentionTextarea } from '@/features/mentions/MentionTextarea';
import { AddRow, EditableSection } from '@/features/section-shell/EditableSection';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityList } from '@/features/section-shell/EntityList';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import { CompendiumPane } from './CompendiumPane';
import { HoardBuilderModal } from './hoard/HoardBuilderModal';
import {
  HOLDER_KIND_OPTIONS,
  ITEM_TYPE_LABELS,
  RARITY_LABELS,
  buildItemsModel,
  holderName,
} from './itemsModel';
import { ItemCard } from './ItemCard';
import { ItemRow } from './ItemRow';
import { RarityBadge } from './RarityBadge';
import styles from './ItemsSection.module.css';
import { SrdItemPicker } from './SrdItemPicker';
import { useSrdCatalog } from './useSrdCatalog';
import { evaluatePartyWealth, getPartyAverageLevel } from './wealthTracker';

/** Holder candidates for the entity select, by holder kind. */
function holderOptions(
  bundle: CampaignFixtureBundle,
  kind: CampaignItemHolderKind,
): Array<{ id: string; label: string }> {
  switch (kind) {
    case 'party-member':
      return bundle.campaign.playerCharacters.map((pc) => ({
        id: pc.id,
        label: pc.name,
      }));
    case 'npc':
      return bundle.npcs.map((npc) => ({ id: npc.id, label: npc.name }));
    case 'location':
      return bundle.locations.map((loc) => ({ id: loc.id, label: loc.name }));
    case 'encounter':
      return bundle.encounters.map((enc) => ({ id: enc.id, label: enc.title }));
    case 'none':
      return [];
  }
}

export function ItemsSection() {
  const { bundle, basePath, store } = useSectionBundle();
  const { itemId } = useParams<{ itemId: string }>();
  const { get, set } = useSectionQuery();
  const [hoardOpen, setHoardOpen] = useState(false);

  const rarity = get('rarity');
  const holder = get('holder');
  const discovery = get('discovery');
  const session = get('session');
  const q = get('q');
  const activeTab = get('tab') === 'compendium' ? 'compendium' : 'items';

  const model = useMemo(
    () => buildItemsModel(bundle, { q, rarity, holder, discovery, session }),
    [bundle, q, rarity, holder, discovery, session],
  );
  const selected = itemId
    ? (bundle.items ?? []).find((item) => item.id === itemId)
    : undefined;

  const compendiumEdition =
    bundle.campaign?.edition === '2014' || bundle.catalog?.edition === '2014'
      ? '2014'
      : '2024';

  const { catalog: compendiumCatalog } = useSrdCatalog(compendiumEdition);

  const averageLevel = getPartyAverageLevel(bundle.campaign.playerCharacters);
  const wealthEval = evaluatePartyWealth(
    model.placedGp,
    bundle.campaign.playerCharacters.length,
    averageLevel,
  );

  const footer = (
    <>
      <AddRow
        defaults={{ itemType: 'other', rarity: 'none' }}
        kind="item"
        label="Add item"
        nameField="name"
        sectionPath="items"
      />
      <SrdItemPicker />
    </>
  );

  const list =
    model.totalCount === 0 ? null : (
      <EntityList
        ariaLabel="Items list"
        getHref={(item) => `${basePath}/items/${encodeURIComponent(item.id)}`}
        getId={(item) => item.id}
        groups={model.groups}
        renderRow={(item) => (
          <ItemRow
            heldBy={holderName(bundle, item.holder)}
            item={item}
          />
        )}
        selectedId={selected?.id}
      />
    );

  const tabs = (
    <div aria-label="Treasury tabs" className={styles.tabs} role="tablist">
      <button
        aria-selected={activeTab === 'items'}
        className={`${styles.tab} ${activeTab === 'items' ? styles.tabActive : ''}`}
        onClick={() => set('tab', 'items')}
        role="tab"
        type="button"
      >
        Campaign items
        <span className={styles.tabCount}>{model.totalCount}</span>
      </button>
      <button
        aria-selected={activeTab === 'compendium'}
        className={`${styles.tab} ${activeTab === 'compendium' ? styles.tabActive : ''}`}
        onClick={() => set('tab', 'compendium')}
        role="tab"
        type="button"
      >
        Compendium ({compendiumEdition})
      </button>
    </div>
  );

  if (activeTab === 'compendium') {
    return (
      <SectionLayout
        empty={<CompendiumPane />}
        list={null}
        sectionPath="items"
        tabs={tabs}
        title="Items"
      />
    );
  }

  return (
    <>
      <SectionLayout
        actions={
          <button
            type="button"
            className={styles.hoardActionBtn}
            onClick={() => setHoardOpen(true)}
            aria-label="Open Hoard Builder"
          >
            <Sparkles size={15} />
            <span>Hoard ✦</span>
          </button>
        }
        count={model.totalCount}
        detail={selected ? <ItemDetail item={selected} /> : undefined}
        empty={
          model.totalCount === 0 ? (
            <EmptyState
              action={footer}
              description={
                store.editable
                  ? 'Add loot and treasure, then hand it to a party member, an NPC, a location or an encounter.'
                  : 'Items you add will appear here, grouped by who holds them.'
              }
              title="No items yet."
            />
          ) : undefined
        }
        filters={
          <FilterBar
            facets={[
              {
                allLabel: 'Anyone',
                key: 'holder',
                label: 'Holder',
                options: model.holderOptions,
              },
              {
                allLabel: 'All rarities',
                key: 'rarity',
                label: 'Rarity',
                options: model.rarityOptions,
              },
              {
                allLabel: 'All items',
                key: 'discovery',
                label: 'Discovery',
                options: model.discoveryOptions,
              },
              ...(model.sessionOptions.length > 0
                ? [
                    {
                      allLabel: 'All sessions',
                      key: 'session',
                      label: 'Session',
                      options: model.sessionOptions,
                    },
                  ]
                : []),
            ]}
            plural="items"
            resultCount={model.visibleCount}
            searchLabel="Search items"
            singular="item"
          />
        }
        list={list}
        listFooter={footer}
        notFound={Boolean(itemId) && !selected}
        sectionPath="items"
        selectedId={itemId}
        summary={
          <SectionSummary
            stats={[
              { label: 'Total', value: model.totalCount },
              { label: 'Undiscovered', value: model.undiscoveredCount },
              { label: 'Placed GP', value: `${model.placedGp.toLocaleString()} gp` },
              { label: 'Wealth', value: wealthEval.label },
            ]}
            title="Item Overview"
          >
            <p>
              Select an item to see who holds it, whether the party has found
              it, and the quests it belongs to.
            </p>
          </SectionSummary>
        }
        tabs={tabs}
        title="Items"
      />
      <HoardBuilderModal
        isOpen={hoardOpen}
        onClose={() => setHoardOpen(false)}
        bundle={bundle}
        store={store}
        compendiumItems={compendiumCatalog}
      />
    </>
  );
}

function ItemDetail({ item }: { item: CampaignItem }) {
  const { bundle, basePath, store } = useSectionBundle();
  const navigate = useNavigate();
  const heldBy = holderName(bundle, item.holder);
  const partyHolder = item.holder.kind === 'party-member';

  const handleQuickUpdate = async (patch: Partial<CampaignItem>) => {
    if (!store.editable) return;
    await store.updateItem('item', item.id, patch);
  };

  const handleDuplicate = async () => {
    if (!store.editable) return;
    const result = await store.addItem('item', {
      ...item,
      name: `${item.name} (Copy)`,
    });
    if (result.ok && result.id) {
      navigate(`${basePath}/items/${encodeURIComponent(result.id)}`);
    }
  };

  return (
    <EditableSection
      heading={item.name}
      headerExtras={<RarityBadge rarity={item.rarity} />}
      id={item.id}
      initialDraft={{
        name: item.name,
        playerName: item.playerName ?? '',
        itemType: item.itemType,
        rarity: item.rarity,
        requiresAttunement: item.requiresAttunement,
        attunementNote: item.attunementNote ?? '',
        valueGp: item.valueGp === undefined ? '' : String(item.valueGp),
        weightLb: item.weightLb === undefined ? '' : String(item.weightLb),
        quantity: String(item.quantity),
        description: item.description,
        mechanics: item.mechanics ?? '',
        holder: item.holder,
        sessionId: item.sessionId ?? '',
        discovered: item.discovered,
        identified: item.identified,
        questIds: item.questIds,
      }}
      kind="item"
      listPath="items"
      renderForm={(draft, setDraft) => {
        const holder = (draft.holder ?? {
          kind: 'none',
        }) as CampaignItem['holder'];
        const questIds = (draft.questIds ?? []) as string[];
        const candidates = holderOptions(bundle, holder.kind);
        return (
          <div className={styles.form}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Basics</legend>
              <label>
                Name
                <input
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  type="text"
                  value={String(draft.name ?? '')}
                />
              </label>
              <label>
                Player-facing Name
                <input
                  onChange={(e) =>
                    setDraft({ ...draft, playerName: e.target.value })
                  }
                  placeholder="e.g. Ornate silver blade, Unknown potion"
                  type="text"
                  value={String(draft.playerName ?? '')}
                />
              </label>
              <div className={styles.pair}>
                <label>
                  Type
                  <select
                    onChange={(e) =>
                      setDraft({ ...draft, itemType: e.target.value })
                    }
                    value={String(draft.itemType ?? 'other')}
                  >
                    {ITEM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ITEM_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rarity
                  <select
                    onChange={(e) => setDraft({ ...draft, rarity: e.target.value })}
                    value={String(draft.rarity ?? 'none')}
                  >
                    {ITEM_RARITIES.map((value) => (
                      <option key={value} value={value}>
                        {RARITY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.pair}>
                <label>
                  Value (gp)
                  <input
                    min={0}
                    onChange={(e) =>
                      setDraft({ ...draft, valueGp: e.target.value })
                    }
                    type="number"
                    value={String(draft.valueGp ?? '')}
                  />
                </label>
                <label>
                  Weight (lb)
                  <input
                    min={0}
                    onChange={(e) =>
                      setDraft({ ...draft, weightLb: e.target.value })
                    }
                    type="number"
                    value={String(draft.weightLb ?? '')}
                  />
                </label>
                <label>
                  Quantity
                  <input
                    min={1}
                    onChange={(e) =>
                      setDraft({ ...draft, quantity: e.target.value })
                    }
                    type="number"
                    value={String(draft.quantity ?? '1')}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Rules text</legend>
              <label className={styles.check}>
                <input
                  checked={draft.requiresAttunement === true}
                  onChange={(e) =>
                    setDraft({ ...draft, requiresAttunement: e.target.checked })
                  }
                  type="checkbox"
                />
                Requires attunement
              </label>
              {draft.requiresAttunement === true ? (
                <label>
                  Attunement note
                  <input
                    onChange={(e) =>
                      setDraft({ ...draft, attunementNote: e.target.value })
                    }
                    placeholder="e.g. by a spellcaster"
                    type="text"
                    value={String(draft.attunementNote ?? '')}
                  />
                </label>
              ) : null}
              <label>
                Description
                <MentionTextarea
                  onChange={(description) => setDraft({ ...draft, description })}
                  rows={4}
                  value={String(draft.description ?? '')}
                />
              </label>
              <label>
                Mechanics
                <textarea
                  onChange={(e) =>
                    setDraft({ ...draft, mechanics: e.target.value })
                  }
                  rows={3}
                  value={String(draft.mechanics ?? '')}
                />
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Placement</legend>
              <div className={styles.pair}>
                <label>
                  Held by
                  <select
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        holder: {
                          kind: e.target.value as CampaignItemHolderKind,
                        },
                      })
                    }
                    value={holder.kind}
                  >
                    {HOLDER_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {holder.kind !== 'none' ? (
                  <label>
                    Who or where
                    <select
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          holder: e.target.value
                            ? { kind: holder.kind, id: e.target.value }
                            : { kind: holder.kind },
                        })
                      }
                      value={holder.id ?? ''}
                    >
                      <option value="">Choose...</option>
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <label>
                Scheduled Session Reward
                <select
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sessionId: e.target.value || undefined,
                    })
                  }
                  value={String(draft.sessionId ?? '')}
                >
                  <option value="">None (unscheduled)</option>
                  {(bundle.sessions ?? []).map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title || `Session ${session.number ?? session.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.check}>
                <input
                  checked={draft.discovered === true}
                  onChange={(e) =>
                    setDraft({ ...draft, discovered: e.target.checked })
                  }
                  type="checkbox"
                />
                Discovered by the party
              </label>
              <label className={styles.check}>
                <input
                  checked={draft.identified === true}
                  onChange={(e) =>
                    setDraft({ ...draft, identified: e.target.checked })
                  }
                  type="checkbox"
                />
                Identified
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Story & Quests</legend>
              {bundle.quests.length === 0 ? <p>No quests yet.</p> : null}
              {bundle.quests.map((quest) => (
                <label className={styles.check} key={quest.id}>
                  <input
                    checked={questIds.includes(quest.id)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        questIds: e.target.checked
                          ? [...questIds, quest.id]
                          : questIds.filter((id) => id !== quest.id),
                      })
                    }
                    type="checkbox"
                  />
                  {quest.title}
                </label>
              ))}
            </fieldset>
          </div>
        );
      }}
      toPatch={(draft, initial) => {
        const patch: Record<string, unknown> = {};
        const text = (key: string) => String(draft[key] ?? '').trim();
        for (const key of ['itemType', 'rarity']) {
          if (draft[key] !== initial[key]) patch[key] = draft[key];
        }
        if (draft.name !== initial.name) patch.name = text('name');
        if (draft.playerName !== initial.playerName) {
          patch.playerName = text('playerName') || undefined;
        }
        if (draft.sessionId !== initial.sessionId) {
          patch.sessionId = text('sessionId') || undefined;
        }
        for (const key of ['requiresAttunement', 'discovered', 'identified']) {
          if (draft[key] !== initial[key]) patch[key] = draft[key] === true;
        }
        if (draft.attunementNote !== initial.attunementNote) {
          patch.attunementNote = text('attunementNote');
        }
        for (const key of ['valueGp', 'weightLb']) {
          if (draft[key] !== initial[key]) patch[key] = text(key);
        }
        if (draft.quantity !== initial.quantity) {
          patch.quantity = Math.max(
            1,
            Math.round(Number(text('quantity')) || 1),
          );
        }
        if (draft.description !== initial.description) {
          patch.description = String(draft.description ?? '');
        }
        if (draft.mechanics !== initial.mechanics) {
          patch.mechanics = String(draft.mechanics ?? '');
        }
        if (JSON.stringify(draft.holder) !== JSON.stringify(initial.holder)) {
          patch.holder = draft.holder;
        }
        if (
          JSON.stringify(draft.questIds) !== JSON.stringify(initial.questIds)
        ) {
          patch.questIds = draft.questIds;
        }
        return patch;
      }}
    >
      <ItemCard
        bundle={bundle}
        editable={store.editable}
        heldBy={heldBy}
        hideHeaderTitle
        item={item}
        onDuplicate={store.editable ? handleDuplicate : undefined}
        onQuickUpdate={handleQuickUpdate}
        partyHolder={partyHolder}
      />
    </EditableSection>
  );
}
