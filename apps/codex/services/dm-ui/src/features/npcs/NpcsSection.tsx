import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Dices from 'lucide-react/dist/esm/icons/dices';

import type { CampaignNpc } from '@/demo/ashes-of-veyra/types';
import { MentionTextarea } from '@/features/mentions/MentionTextarea';
import { MentionText } from '@/features/mentions/MentionText';
import { EmptyState } from '@/features/section-shell/EmptyState';
import {
  AddRow,
  EditableSection,
} from '@/features/section-shell/EditableSection';
import { EntityChip, EntityLink } from '@/features/section-shell/EntityLink';
import { EntityList } from '@/features/section-shell/EntityList';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';
import { resolveEntity } from '@/demo/fixture-registry';
import { QuickNpcModal } from './QuickNpcModal';

import styles from './NpcsSection.module.css';
import {
  buildNpcsModel,
  npcAppearances,
  npcFactions,
  npcQuestsGiven,
  type NpcRow,
} from './npcsModels';

const NO_FACTION = '';

function toDraft(npc: CampaignNpc): Record<string, unknown> {
  return {
    name: npc.name,
    role: npc.role,
    ancestry: npc.ancestry,
    motivation: npc.motivation,
    relationship: npc.relationship,
    tags: npc.tags.join(', '),
    factionId: npc.factionIds[0] ?? NO_FACTION,
    hp: npc.combatSummary?.hp ?? '',
    ac: npc.combatSummary?.ac ?? '',
    cr: npc.combatSummary?.cr ?? '',
    statBlockSlug: npc.statBlockRef?.slug ?? '',
  };
}

/** Turns the form draft back into a `Partial<CampaignNpc>` of changed fields. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper exported for unit tests
export function npcDraftToPatch(
  draft: Record<string, unknown>,
  initial: Record<string, unknown>,
  npc: Pick<CampaignNpc, 'factionIds' | 'combatSummary' | 'statBlockRef'>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of [
    'name',
    'role',
    'ancestry',
    'motivation',
    'relationship',
  ]) {
    if (draft[key] !== initial[key]) patch[key] = draft[key];
  }
  if (draft.tags !== initial.tags) {
    patch.tags = String(draft.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (draft.factionId !== initial.factionId) {
    const next = String(draft.factionId ?? '');
    const rest = npc.factionIds.slice(1).filter((id) => id !== next);
    patch.factionIds = next ? [next, ...rest] : rest;
  }
  if (draft.hp !== initial.hp || draft.ac !== initial.ac || draft.cr !== initial.cr) {
    const hp = Number(draft.hp);
    const ac = Number(draft.ac);
    const cr = String(draft.cr ?? '').trim();
    if (hp > 0 || ac > 0 || cr) {
      patch.combatSummary = {
        hp: hp || 10,
        maxHp: hp || 10,
        ac: ac || 10,
        ...(cr ? { cr } : {}),
      };
    } else {
      patch.combatSummary = undefined;
    }
  }
  if (draft.statBlockSlug !== initial.statBlockSlug) {
    const slug = String(draft.statBlockSlug ?? '').trim();
    patch.statBlockRef = slug ? { slug, ruleset: '2014' as const } : undefined;
  }
  return patch;
}

function NpcRowContent({ row }: { row: NpcRow }) {
  return (
    <>
      <span aria-hidden="true" className={styles.monogram}>
        {row.monogram}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{row.name}</span>
        <span className={styles.rowRole}>{row.role}</span>
      </span>
      {row.unused ? <StatusBadge tone="warning">Unused</StatusBadge> : null}
      {row.factionName ? (
        <span className={styles.factionChip}>{row.factionName}</span>
      ) : null}
    </>
  );
}

function NpcDetail({ npc }: { npc: CampaignNpc }) {
  const { bundle } = useSectionBundle();
  const appearances = npcAppearances(bundle, npc);
  const questsGiven = npcQuestsGiven(bundle, npc.id);
  const factions = npcFactions(bundle, npc);
  const unused =
    bundle.lifecycle === 'draft' &&
    appearances.length === 0 &&
    questsGiven.length === 0;

  const forwardIds = [
    ...npc.locationIds,
    ...questsGiven.map((quest) => quest.id),
    ...appearances.map((session) => session.id),
  ];

  const draft = useMemo(() => toDraft(npc), [npc]);

  return (
    <EditableSection
      heading={npc.name}
      headerExtras={
        unused ? <StatusBadge tone="warning">Unused</StatusBadge> : null
      }
      id={npc.id}
      initialDraft={draft}
      kind="npc"
      renderForm={(current, setDraft) => (
        <>
          <label>
            Name
            <input
              onChange={(event) =>
                setDraft({ ...current, name: event.target.value })
              }
              value={String(current.name ?? '')}
            />
          </label>
          <label>
            Role
            <input
              onChange={(event) =>
                setDraft({ ...current, role: event.target.value })
              }
              value={String(current.role ?? '')}
            />
          </label>
          <label>
            Ancestry
            <input
              onChange={(event) =>
                setDraft({ ...current, ancestry: event.target.value })
              }
              value={String(current.ancestry ?? '')}
            />
          </label>
          <label>
            Faction
            <select
              onChange={(event) =>
                setDraft({ ...current, factionId: event.target.value })
              }
              value={String(current.factionId ?? NO_FACTION)}
            >
              <option value={NO_FACTION}>Unaffiliated</option>
              {bundle.factions.map((faction) => (
                <option key={faction.id} value={faction.id}>
                  {faction.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivation
            <MentionTextarea
              onChange={(motivation) => setDraft({ ...current, motivation })}
              rows={3}
              value={String(current.motivation ?? '')}
            />
          </label>
          <label>
            Relationship to party
            <MentionTextarea
              onChange={(relationship) =>
                setDraft({ ...current, relationship })
              }
              rows={3}
              value={String(current.relationship ?? '')}
            />
          </label>
          <label>
            Tags (comma separated)
            <input
              onChange={(event) =>
                setDraft({ ...current, tags: event.target.value })
              }
              value={String(current.tags ?? '')}
            />
          </label>
          <label>
            HP
            <input
              onChange={(event) =>
                setDraft({ ...current, hp: event.target.value })
              }
              type="number"
              value={String(current.hp ?? '')}
            />
          </label>
          <label>
            AC
            <input
              onChange={(event) =>
                setDraft({ ...current, ac: event.target.value })
              }
              type="number"
              value={String(current.ac ?? '')}
            />
          </label>
          <label>
            Statblock Ref (Monster Slug)
            <input
              onChange={(event) =>
                setDraft({ ...current, statBlockSlug: event.target.value })
              }
              placeholder="e.g. commoner, guard"
              value={String(current.statBlockSlug ?? '')}
            />
          </label>
        </>
      )}
      toPatch={(current, initial) => npcDraftToPatch(current, initial, npc)}
    >
      <p className={styles.subtitle}>
        {[npc.role, npc.ancestry].filter(Boolean).join(' · ') ||
          'No role or ancestry yet'}
      </p>
      {npc.combatSummary || npc.statBlockRef ? (
        <div aria-label="Combat summary" className={styles.combatBadges}>
          {npc.combatSummary ? (
            <>
              <span className={styles.combatBadge}>HP {npc.combatSummary.hp}</span>
              <span className={styles.combatBadge}>AC {npc.combatSummary.ac}</span>
              {npc.combatSummary.cr ? (
                <span className={styles.combatBadge}>CR {npc.combatSummary.cr}</span>
              ) : null}
            </>
          ) : null}
          {npc.statBlockRef ? (
            <span className={styles.combatBadge}>Ref: {npc.statBlockRef.slug}</span>
          ) : null}
        </div>
      ) : null}
      <dl className={styles.fields}>
        <div>
          <dt>Motivation</dt>
          <dd>
            {npc.motivation ? (
              <MentionText text={npc.motivation} />
            ) : (
              'Not written yet.'
            )}
          </dd>
        </div>
        <div>
          <dt>Relationship to party</dt>
          <dd>
            {npc.relationship ? (
              <MentionText text={npc.relationship} />
            ) : (
              'Not written yet.'
            )}
          </dd>
        </div>
      </dl>
      {npc.tags.length > 0 ? (
        <ul aria-label="Tags" className={styles.tags}>
          {npc.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
      {factions.length > 0 ? (
        <section aria-label="Factions" className={styles.factions}>
          <h3>Factions</h3>
          <ul>
            {factions.map(({ id, leads }) => {
              const ref = resolveEntity(bundle, id);
              return (
                <li key={id}>
                  {ref ? (
                    <EntityChip
                      entity={ref}
                      label={leads ? `${ref.label} (Leads)` : undefined}
                    />
                  ) : (
                    <EntityLink id={id} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <RelatedGroups
        entityId={npc.id}
        exclude={['faction']}
        forwardIds={forwardIds}
        kinds={['location', 'quest', 'session', 'encounter', 'handout']}
      />
    </EditableSection>
  );
}

function NextSessionNpcs() {
  const { bundle } = useSectionBundle();
  if (bundle.lifecycle !== 'active') return null;
  const sessionId =
    bundle.campaign.currentSessionId || bundle.catalog.selectedSessionId;
  const session = bundle.sessions.find((item) => item.id === sessionId);
  const npcs = session
    ? bundle.npcs.filter((npc) => session.npcIds.includes(npc.id))
    : [];
  if (!session || npcs.length === 0) return null;
  return (
    <section aria-label="In next session" className={styles.nextSession}>
      <h3>In next session</h3>
      <ul>
        {npcs.map((npc) => (
          <li key={npc.id}>
            <EntityLink id={npc.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NpcsSection() {
  const { bundle, basePath, store } = useSectionBundle();
  const { npcId } = useParams<{ npcId?: string }>();
  const navigate = useNavigate();
  const [showQuickModal, setShowQuickModal] = useState(false);
  const { get } = useSectionQuery();

  const model = useMemo(
    () =>
      buildNpcsModel(bundle, {
        q: get('q'),
        faction: get('faction'),
        location: get('location'),
        tag: get('tag'),
        sort: get('sort'),
      }),
    [bundle, get],
  );

  const selected = npcId
    ? bundle.npcs.find((npc) => npc.id === npcId)
    : undefined;
  const readOnlyEmpty = model.total === 0 && !store.editable;

  const list =
    model.total === 0 ? (
      <p className={styles.emptyList}>No NPCs yet.</p>
    ) : model.rows.length === 0 ? (
      <p className={styles.emptyList}>No NPCs match these filters.</p>
    ) : (
      <EntityList
        ariaLabel="NPC list"
        getHref={(row) => `${basePath}/npcs/${encodeURIComponent(row.id)}`}
        getId={(row) => row.id}
        groups={model.groups}
        renderRow={(row) => <NpcRowContent row={row} />}
        selectedId={npcId}
      />
    );

  return (
    <SectionLayout
      count={model.total}
      detail={selected ? <NpcDetail npc={selected} /> : undefined}
      empty={
        readOnlyEmpty ? (
          <EmptyState
            description="NPCs you add will appear here, grouped by faction."
            title="No NPCs yet."
          />
        ) : undefined
      }
      filters={
        <FilterBar
          facets={[
            {
              key: 'faction',
              label: 'Faction',
              allLabel: 'All factions',
              options: model.factionOptions,
            },
            {
              key: 'location',
              label: 'Location',
              allLabel: 'All locations',
              options: model.locationOptions,
            },
            {
              key: 'tag',
              label: 'Tag',
              allLabel: 'All tags',
              options: model.tagOptions,
            },
          ]}
          plural="NPCs"
          resultCount={model.rows.length}
          searchLabel="Search NPCs"
          singular="NPC"
          sortOptions={model.sortOptions}
        />
      }
      list={list}
      listFooter={
        <div className={styles.footerActions}>
          <AddRow
            defaults={{
              ancestry: '',
              factionIds: [],
              locationIds: [],
              motivation: '',
              relationship: '',
              role: '',
              sessionIds: [],
              tags: [],
            }}
            kind="npc"
            label="Add NPC"
            nameField="name"
            sectionPath="npcs"
          />
          {store.editable ? (
            <button
              className={styles.quickRollButton}
              onClick={() => setShowQuickModal(true)}
              title="Procedurally roll a new NPC"
              type="button"
            >
              <Dices size={15} />
              Quick Roll NPC
            </button>
          ) : null}
          <QuickNpcModal
            onClose={() => setShowQuickModal(false)}
            onCreated={(id) => {
              navigate(`${basePath}/npcs/${encodeURIComponent(id)}`);
            }}
            open={showQuickModal}
          />
        </div>
      }
      notFound={Boolean(npcId) && !selected}
      sectionPath="npcs"
      selectedId={npcId}
      summary={
        <SectionSummary
          stats={[
            { label: 'NPCs', value: model.total },
            { label: 'Unaffiliated', value: model.unaffiliatedCount },
            ...(bundle.lifecycle === 'draft'
              ? [{ label: 'Unused', value: model.unusedCount }]
              : []),
          ]}
          title="NPC overview"
        >
          <NextSessionNpcs />
          <p className={styles.hint}>
            Select an NPC to see who they are and where the party met them.
          </p>
        </SectionSummary>
      }
      title="NPCs"
    />
  );
}
