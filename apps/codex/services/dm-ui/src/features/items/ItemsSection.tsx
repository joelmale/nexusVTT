import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import {
  ITEM_RARITIES,
  ITEM_TYPES,
  resolveEntity,
  type CampaignFixtureBundle,
  type CampaignItem,
  type CampaignItemHolderKind,
} from '@/demo/fixture-registry';
import { MentionText } from '@/features/mentions/MentionText';
import { MentionTextarea } from '@/features/mentions/MentionTextarea';
import { AddRow, EditableSection } from '@/features/section-shell/EditableSection';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityChip, EntityLink } from '@/features/section-shell/EntityLink';
import { EntityList } from '@/features/section-shell/EntityList';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';
import { mentionIds } from '@/lib/mentions';

import {
  HOLDER_KIND_OPTIONS,
  ITEM_TYPE_LABELS,
  RARITY_LABELS,
  buildItemsModel,
  holderName,
} from './itemsModel';
import styles from './ItemsSection.module.css';
import { SrdItemPicker } from './SrdItemPicker';

const RARITY_TONES: Record<
  CampaignItem['rarity'],
  'positive' | 'warning' | 'danger' | 'neutral' | 'info'
> = {
  none: 'neutral',
  common: 'neutral',
  uncommon: 'positive',
  rare: 'info',
  very_rare: 'info',
  legendary: 'warning',
  artifact: 'danger',
};

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
  const { get } = useSectionQuery();

  const rarity = get('rarity');
  const holder = get('holder');
  const discovery = get('discovery');
  const q = get('q');

  const model = useMemo(
    () => buildItemsModel(bundle, { q, rarity, holder, discovery }),
    [bundle, q, rarity, holder, discovery],
  );
  const selected = itemId
    ? (bundle.items ?? []).find((item) => item.id === itemId)
    : undefined;

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
          <span className={styles.row}>
            <span className={styles.rowTitle}>
              {item.name}
              {item.quantity > 1 ? ` x${item.quantity}` : ''}
            </span>
            <span className={styles.badges}>
              {item.rarity !== 'none' ? (
                <StatusBadge tone={RARITY_TONES[item.rarity]}>
                  {RARITY_LABELS[item.rarity]}
                </StatusBadge>
              ) : null}
              {!item.discovered ? (
                <StatusBadge tone="warning">Undiscovered</StatusBadge>
              ) : null}
            </span>
          </span>
        )}
        selectedId={selected?.id}
      />
    );

  return (
    <SectionLayout
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
          ]}
          title="Item Overview"
        >
          <p>
            Select an item to see who holds it, whether the party has found
            it, and the quests it belongs to.
          </p>
        </SectionSummary>
      }
      title="Items"
    />
  );
}

function ItemDetail({ item }: { item: CampaignItem }) {
  const { bundle } = useSectionBundle();
  const heldBy = holderName(bundle, item.holder);
  const partyHolder = item.holder.kind === 'party-member';

  return (
    <EditableSection
      heading={item.name}
      headerExtras={
        item.rarity !== 'none' ? (
          <StatusBadge tone={RARITY_TONES[item.rarity]}>
            {RARITY_LABELS[item.rarity]}
          </StatusBadge>
        ) : null
      }
      id={item.id}
      initialDraft={{
        name: item.name,
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
            <label>
              Name
              <input
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                type="text"
                value={String(draft.name ?? '')}
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
            <fieldset className={styles.checks}>
              <legend>Quests</legend>
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
      <div className={styles.detail}>
        <dl className={styles.facts}>
          <dt>Type</dt>
          <dd>{ITEM_TYPE_LABELS[item.itemType]}</dd>
          <dt>Rarity</dt>
          <dd>{RARITY_LABELS[item.rarity]}</dd>
          <dt>Attunement</dt>
          <dd>
            {item.requiresAttunement
              ? `Required${item.attunementNote ? ` (${item.attunementNote})` : ''}`
              : 'Not required'}
          </dd>
          {item.valueGp !== undefined ? (
            <>
              <dt>Value</dt>
              <dd>{item.valueGp} gp</dd>
            </>
          ) : null}
          {item.weightLb !== undefined ? (
            <>
              <dt>Weight</dt>
              <dd>{item.weightLb} lb</dd>
            </>
          ) : null}
          <dt>Quantity</dt>
          <dd>{item.quantity}</dd>
        </dl>
        <div className={styles.badges}>
          <StatusBadge tone={item.discovered ? 'positive' : 'warning'}>
            {item.discovered ? 'Discovered' : 'Undiscovered'}
          </StatusBadge>
          <StatusBadge tone={item.identified ? 'positive' : 'neutral'}>
            {item.identified ? 'Identified' : 'Unidentified'}
          </StatusBadge>
        </div>

        <section>
          <h3 className={styles.heading}>Held by</h3>
          {item.holder.id && heldBy ? (
            partyHolder ? (
              <span>{heldBy} (party)</span>
            ) : (
              <EntityLink id={item.holder.id} />
            )
          ) : (
            <p>Unassigned.</p>
          )}
        </section>

        {item.description ? (
          <section>
            <h3 className={styles.heading}>Description</h3>
            <p className={styles.text}>
              <MentionText text={item.description} />
            </p>
          </section>
        ) : null}
        {item.mechanics ? (
          <section>
            <h3 className={styles.heading}>Mechanics</h3>
            <p className={styles.text}>{item.mechanics}</p>
          </section>
        ) : null}

        {item.questIds.length > 0 ? (
          <section>
            <h3 className={styles.heading}>Quests</h3>
            <div className={styles.chips}>
              {item.questIds.map((questId) => {
                const ref = resolveEntity(bundle, questId);
                return ref ? <EntityChip entity={ref} key={questId} /> : null;
              })}
            </div>
          </section>
        ) : null}

        <RelatedGroups
          entityId={item.id}
          exclude={['quest', 'item']}
          forwardIds={mentionIds(
            `${item.description}\n${item.mechanics ?? ''}`,
          )}
        />
      </div>
    </EditableSection>
  );
}
