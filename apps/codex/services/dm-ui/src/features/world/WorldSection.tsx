import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import type { CampaignLocation } from '@/demo/fixture-registry';
import { useCapabilityNotice } from '@/features/capability-notice';
import {
  AddRow,
  EditableSection,
} from '@/features/section-shell/EditableSection';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityChip } from '@/features/section-shell/EntityLink';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import {
  DmOnlyBadge,
  StatusBadge,
} from '@/features/section-shell/StatusBadge';
import { humanize } from '@/features/section-shell/statusTones';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import { LocationResults, LocationTree } from './LocationTree';
import styles from './World.module.css';
import {
  breadcrumbFor,
  buildLocationTree,
  descendantIds,
  filterLocations,
  flattenTree,
  hasActiveFilters,
  locationDraft,
  locationPatch,
  locationTags,
  locationTypes,
  mapChipsFor,
  nextSessionLocationIds,
  resolveOpenIds,
  type LocationRow,
} from './worldModels';

const SECTION = 'world';

function TextBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.fieldBlock}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function LocationDetail({
  location,
  isNextSession,
}: {
  location: CampaignLocation;
  isNextSession: boolean;
}) {
  const { bundle } = useSectionBundle();
  const { notifyCapability } = useCapabilityNotice();
  const maps = mapChipsFor(bundle, location);
  const template = location.sceneTemplateId
    ? bundle.sceneTemplates.find((item) => item.id === location.sceneTemplateId)
    : undefined;
  const excluded = new Set(descendantIds(bundle.locations, location.id));

  return (
    <EditableSection
      headerExtras={
        <>
          <StatusBadge tone="neutral">{humanize(location.type)}</StatusBadge>
          {isNextSession ? (
            <StatusBadge tone="info">Next session</StatusBadge>
          ) : null}
        </>
      }
      heading={location.name}
      id={location.id}
      initialDraft={locationDraft(location)}
      kind="location"
      renderForm={(draft, setDraft) => {
        const set = (key: string, value: string) =>
          setDraft({ ...draft, [key]: value });
        return (
          <>
            <label>
              Name
              <input
                onChange={(event) => set('name', event.target.value)}
                value={String(draft.name ?? '')}
              />
            </label>
            <label>
              Type
              <input
                onChange={(event) => set('type', event.target.value)}
                value={String(draft.type ?? '')}
              />
            </label>
            <label>
              Parent location
              <select
                onChange={(event) =>
                  set('parentLocationId', event.target.value)
                }
                value={String(draft.parentLocationId ?? '')}
              >
                <option value="">None (top level)</option>
                {bundle.locations
                  .filter(
                    (item) => item.id !== location.id && !excluded.has(item.id),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Summary
              <textarea
                onChange={(event) =>
                  set('shortDescription', event.target.value)
                }
                rows={2}
                value={String(draft.shortDescription ?? '')}
              />
            </label>
            <label>
              Description (blank line between paragraphs)
              <textarea
                onChange={(event) => set('descriptionText', event.target.value)}
                rows={6}
                value={String(draft.descriptionText ?? '')}
              />
            </label>
            <label>
              Tags (comma separated)
              <input
                onChange={(event) => set('tagsText', event.target.value)}
                value={String(draft.tagsText ?? '')}
              />
            </label>
            <label>
              DM notes
              <textarea
                onChange={(event) => set('notes', event.target.value)}
                rows={4}
                value={String(draft.notes ?? '')}
              />
            </label>
          </>
        );
      }}
      toPatch={locationPatch}
    >
      <div className={styles.detailBody}>
        {location.imagePath ? (
          <img alt="" className={styles.image} src={location.imagePath} />
        ) : null}
        {location.shortDescription ? (
          <p className={styles.lead}>{location.shortDescription}</p>
        ) : null}
        {location.description.length > 0 ? (
          <div className={styles.fieldBlock}>
            {location.description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}
        {location.tags.length > 0 ? (
          <ul aria-label="Tags" className={styles.tags}>
            {location.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
        {maps.length > 0 ? (
          <TextBlock title={maps.length > 1 ? 'Pinned on maps' : 'On map'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {maps.map((map) => (
                <div key={`${map.mapId}:${map.pinLabel ?? ''}`} className={styles.row}>
                  <EntityChip
                    entity={{
                      id: map.mapId,
                      kind: 'map',
                      label: map.title,
                      href: map.href,
                    }}
                  />
                  {map.pinLabel ? (
                    <span className={styles.mapPin}>Pin: {map.pinLabel}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </TextBlock>
        ) : null}
        {location.sceneTemplateId ? (
          <TextBlock title="Scene template">
            <div className={styles.row}>
              <span>{template?.title ?? 'Unknown scene template'}</span>
              <button
                className={styles.stub}
                onClick={() => notifyCapability('map.scene.create')}
                type="button"
              >
                Create scene
              </button>
            </div>
          </TextBlock>
        ) : null}
        {location.notes ? (
          <TextBlock title="Notes">
            <DmOnlyBadge />
            <p>{location.notes}</p>
          </TextBlock>
        ) : null}
        <RelatedGroups
          entityId={location.id}
          forwardIds={[
            ...location.npcIds,
            ...location.factionIds,
            ...location.encounterIds,
            ...location.questIds,
            ...location.handoutIds,
            location.parentLocationId,
          ]}
          kinds={[
            'npc',
            'faction',
            'encounter',
            'quest',
            'handout',
            'session',
            'location',
          ]}
        />
      </div>
    </EditableSection>
  );
}

export function WorldSection() {
  const { bundle, basePath } = useSectionBundle();
  const { locationId } = useParams();
  const { get, set } = useSectionQuery();
  const locations = bundle.locations;

  const q = get('q');
  const type = get('type');
  const tag = get('tag');
  const hasPin = get('pin') === '1';
  const filtering = hasActiveFilters({ q, type, tag, hasPin });
  const nextIds = useMemo(() => nextSessionLocationIds(bundle), [bundle]);
  const forest = useMemo(() => buildLocationTree(locations), [locations]);
  const selected = locations.find((location) => location.id === locationId);
  const openParam = get('open');
  const effectiveOpen = useMemo(
    () =>
      openParam === '-'
        ? new Set<string>()
        : resolveOpenIds(locations, openParam, locationId),
    [locations, openParam, locationId],
  );
  const rows = useMemo(
    () => flattenTree(forest, effectiveOpen),
    [forest, effectiveOpen],
  );
  const results = useMemo(
    () =>
      filtering ? filterLocations(locations, { q, type, tag, hasPin }) : [],
    [filtering, locations, q, type, tag, hasPin],
  );

  const hrefFor = (id: string) =>
    `${basePath}/${SECTION}/${encodeURIComponent(id)}`;
  const onToggle = (id: string, open: boolean) => {
    const next = new Set(effectiveOpen);
    if (open) next.add(id);
    else next.delete(id);
    // '-' is a sentinel for "everything collapsed" (an empty value means default).
    set('open', next.size > 0 ? [...next].join(',') : '-');
  };

  const addRow = (
    <AddRow
      defaults={{ type: 'location' }}
      kind="location"
      label="Add location"
      nameField="name"
      sectionPath={SECTION}
    />
  );

  if (locations.length === 0) {
    return (
      <SectionLayout
        empty={
          <EmptyState
            action={addRow}
            description="Places you add will appear here as a tree."
            title="No locations yet."
          />
        }
        list={null}
        sectionPath={SECTION}
        title="World"
      />
    );
  }

  const flatEntries = results.map((location) => ({
    row: {
      location,
      level: 1,
      hasChildren: false,
      expanded: false,
      position: 1,
      siblings: 1,
    } satisfies LocationRow,
    breadcrumb: breadcrumbFor(locations, location.id),
  }));

  const pinned = locations.filter((location) => location.mapId).length;

  return (
    <SectionLayout
      count={locations.length}
      detail={
        selected ? (
          <LocationDetail
            isNextSession={nextIds.has(selected.id)}
            location={selected}
          />
        ) : null
      }
      filters={
        <FilterBar
          facets={[
            {
              key: 'type',
              label: 'Type',
              options: locationTypes(locations).map((value) => ({
                value,
                label: humanize(value),
              })),
            },
            {
              key: 'tag',
              label: 'Tag',
              options: locationTags(locations).map((value) => ({
                value,
                label: value,
              })),
            },
            {
              key: 'pin',
              label: 'Map pin',
              allLabel: 'Any',
              options: [{ value: '1', label: 'Has map pin' }],
            },
          ]}
          plural="locations"
          resultCount={filtering ? results.length : locations.length}
          searchLabel="Search locations"
          singular="location"
        />
      }
      list={
        filtering ? (
          flatEntries.length > 0 ? (
            <LocationResults
              entries={flatEntries}
              hrefFor={hrefFor}
              nextSessionIds={nextIds}
              selectedId={locationId}
            />
          ) : (
            <p>No locations match these filters.</p>
          )
        ) : (
          <LocationTree
            hrefFor={hrefFor}
            nextSessionIds={nextIds}
            onToggle={onToggle}
            rows={rows}
            selectedId={locationId}
          />
        )
      }
      listFooter={addRow}
      notFound={Boolean(locationId) && !selected}
      sectionPath={SECTION}
      selectedId={locationId}
      summary={
        <SectionSummary
          stats={[
            { label: 'Locations', value: locations.length },
            { label: 'Top level', value: forest.length },
            { label: 'On a map', value: pinned },
            ...(nextIds.size > 0
              ? [{ label: 'In next session', value: nextIds.size }]
              : []),
          ]}
          title="World"
        >
          <p>Select a location to see who and what is there.</p>
        </SectionSummary>
      }
      title="World"
    />
  );
}
