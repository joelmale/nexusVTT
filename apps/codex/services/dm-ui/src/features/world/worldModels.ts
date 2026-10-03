import type {
  CampaignFixtureBundle,
  CampaignLocation,
} from '@/demo/fixture-registry';

export interface LocationNode {
  location: CampaignLocation;
  children: LocationNode[];
}

export interface LocationRow {
  location: CampaignLocation;
  /** 1-based tree depth (roots are 1). */
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Position among siblings, 1-based. */
  position: number;
  siblings: number;
  parentId?: string;
}

export interface LocationFilters {
  q?: string;
  type?: string;
  tag?: string;
  hasPin?: boolean;
}

const byName = (a: CampaignLocation, b: CampaignLocation) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Builds the location forest from `parentLocationId`. Roots and siblings are
 * sorted by name. A location whose parent is missing (or that sits in a cycle)
 * is promoted to a root, so fixtures without hierarchy become a flat list.
 */
export function buildLocationTree(
  locations: readonly CampaignLocation[],
): LocationNode[] {
  const ids = new Set(locations.map((location) => location.id));
  const childrenOf = new Map<string, CampaignLocation[]>();
  const roots: CampaignLocation[] = [];
  for (const location of locations) {
    const parent = location.parentLocationId;
    if (parent && parent !== location.id && ids.has(parent)) {
      const list = childrenOf.get(parent) ?? [];
      list.push(location);
      childrenOf.set(parent, list);
    } else {
      roots.push(location);
    }
  }
  const visited = new Set<string>();
  const build = (location: CampaignLocation): LocationNode => {
    visited.add(location.id);
    const children = (childrenOf.get(location.id) ?? [])
      .filter((child) => !visited.has(child.id))
      .sort(byName)
      .map(build);
    return { location, children };
  };
  const forest = roots.sort(byName).map(build);
  // Anything unreachable is part of a parent cycle: surface it as a root.
  for (const location of [...locations].sort(byName)) {
    if (!visited.has(location.id)) forest.push(build(location));
  }
  return forest;
}

/** Ids of every ancestor of `id`, nearest first. Cycle-safe. */
export function ancestorIds(
  locations: readonly CampaignLocation[],
  id: string,
): string[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const result: string[] = [];
  const seen = new Set<string>([id]);
  let parent = byId.get(id)?.parentLocationId;
  while (parent && byId.has(parent) && !seen.has(parent)) {
    result.push(parent);
    seen.add(parent);
    parent = byId.get(parent)?.parentLocationId;
  }
  return result;
}

/** Ids of every descendant of `id` (keeps the parent select acyclic). */
export function descendantIds(
  locations: readonly CampaignLocation[],
  id: string,
): string[] {
  const result: string[] = [];
  const queue = [id];
  const seen = new Set<string>([id]);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const location of locations) {
      if (location.parentLocationId === current && !seen.has(location.id)) {
        seen.add(location.id);
        result.push(location.id);
        queue.push(location.id);
      }
    }
  }
  return result;
}

/** Parent names from the root down to (not including) the location itself. */
export function breadcrumbFor(
  locations: readonly CampaignLocation[],
  id: string,
): string[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  return ancestorIds(locations, id)
    .reverse()
    .map((ancestor) => byId.get(ancestor)?.name ?? ancestor);
}

/**
 * Which nodes are expanded. An explicit `?open=` list wins. Without one, roots
 * are open and so are the ancestors of the selected location.
 */
export function resolveOpenIds(
  locations: readonly CampaignLocation[],
  openParam: string | undefined,
  selectedId?: string,
): Set<string> {
  if (openParam) {
    return new Set(openParam.split(',').filter(Boolean));
  }
  const open = new Set(
    buildLocationTree(locations).map((node) => node.location.id),
  );
  if (selectedId) {
    for (const id of ancestorIds(locations, selectedId)) open.add(id);
  }
  return open;
}

/** Rows currently visible in the tree, depth first. */
export function flattenTree(
  forest: readonly LocationNode[],
  openIds: ReadonlySet<string>,
): LocationRow[] {
  const rows: LocationRow[] = [];
  const walk = (
    nodes: readonly LocationNode[],
    level: number,
    parentId?: string,
  ) => {
    nodes.forEach((node, index) => {
      const hasChildren = node.children.length > 0;
      const expanded = hasChildren && openIds.has(node.location.id);
      rows.push({
        location: node.location,
        level,
        hasChildren,
        expanded,
        position: index + 1,
        siblings: nodes.length,
        parentId,
      });
      if (expanded) walk(node.children, level + 1, node.location.id);
    });
  };
  walk(forest, 1);
  return rows;
}

export function hasActiveFilters(filters: LocationFilters): boolean {
  return Boolean(
    filters.q?.trim() || filters.type || filters.tag || filters.hasPin,
  );
}

/** Locations matching every active filter, sorted by name. */
export function filterLocations(
  locations: readonly CampaignLocation[],
  filters: LocationFilters,
): CampaignLocation[] {
  const needle = filters.q?.trim().toLowerCase();
  return locations
    .filter((location) => {
      if (filters.type && location.type !== filters.type) return false;
      if (filters.tag && !location.tags.includes(filters.tag)) return false;
      if (filters.hasPin && !(location.mapId && location.pinId)) return false;
      if (needle) {
        const haystack = [
          location.name,
          location.type,
          location.shortDescription,
          ...location.tags,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .sort(byName);
}

export function locationTypes(
  locations: readonly CampaignLocation[],
): string[] {
  return [...new Set(locations.map((location) => location.type))]
    .filter(Boolean)
    .sort();
}

export function locationTags(locations: readonly CampaignLocation[]): string[] {
  return [...new Set(locations.flatMap((location) => location.tags))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Location ids of the next session. Only for active campaigns (plan 2.2);
 * other lifecycles get no emphasis.
 */
export function nextSessionLocationIds(
  bundle: CampaignFixtureBundle,
): Set<string> {
  if (bundle.lifecycle !== 'active') return new Set();
  const id =
    bundle.campaign.currentSessionId || bundle.catalog.selectedSessionId;
  const session = bundle.sessions.find((candidate) => candidate.id === id);
  return new Set(session?.locationIds ?? []);
}

export function locationCounts(location: CampaignLocation) {
  return {
    npcs: location.npcIds.length,
    encounters: location.encounterIds.length,
  };
}

export interface MapChipModel {
  mapId: string;
  title: string;
  pinLabel?: string;
  /** Path relative to basePath. */
  href: string;
}

/** Map chip for a location with a map id. */
export function mapChipFor(
  bundle: CampaignFixtureBundle,
  location: CampaignLocation,
): MapChipModel | undefined {
  return mapChipsFor(bundle, location)[0];
}

/** All map chips for a location, searching legacy location.mapId and dynamic map pins. */
export function mapChipsFor(
  bundle: CampaignFixtureBundle,
  location: CampaignLocation,
): MapChipModel[] {
  const chips: MapChipModel[] = [];
  const seenMapIds = new Set<string>();

  if (location.mapId) {
    seenMapIds.add(location.mapId);
    const map = bundle.maps.find((candidate) => candidate.id === location.mapId);
    const pin = location.pinId
      ? bundle.pins.find((candidate) => candidate.id === location.pinId)
      : undefined;
    const query = location.pinId
      ? `?pin=${encodeURIComponent(location.pinId)}`
      : '';
    chips.push({
      mapId: location.mapId,
      title: map?.title ?? 'Unknown map',
      pinLabel: pin?.label,
      href: `/maps/${encodeURIComponent(location.mapId)}${query}`,
    });
  }

  for (const map of bundle.maps) {
    if (seenMapIds.has(map.id)) continue;
    for (const pin of map.pins ?? []) {
      const isLinked =
        pin.locationId === location.id ||
        pin.linkedObjectRefs?.some(
          (ref) => 'id' in ref && ref.id === location.id,
        );
      if (isLinked) {
        seenMapIds.add(map.id);
        chips.push({
          mapId: map.id,
          title: map.title,
          pinLabel: pin.label,
          href: `/maps/${encodeURIComponent(map.id)}?pin=${encodeURIComponent(pin.id)}`,
        });
        break;
      }
    }
  }

  return chips;
}

/** Form values for `EditableSection`; list fields become text. */
export function locationDraft(location: CampaignLocation) {
  return {
    name: location.name,
    type: location.type,
    shortDescription: location.shortDescription,
    overview: location.overview ?? '',
    descriptionText: location.description.join('\n\n'),
    tagsText: location.tags.join(', '),
    notes: location.notes,
    parentLocationId: location.parentLocationId ?? '',
  };
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Turns changed draft fields into a `Partial<CampaignLocation>` patch. */
export function locationPatch(
  draft: Record<string, unknown>,
  initial: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of ['name', 'type', 'shortDescription', 'overview', 'notes'] as const) {
    if (text(draft[key]) !== text(initial[key])) {
      patch[key] = text(draft[key]).trim();
    }
  }
  if (text(draft.parentLocationId) !== text(initial.parentLocationId)) {
    // An empty string clears the parent.
    patch.parentLocationId = text(draft.parentLocationId);
  }
  if (text(draft.descriptionText) !== text(initial.descriptionText)) {
    patch.description = text(draft.descriptionText)
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }
  if (text(draft.tagsText) !== text(initial.tagsText)) {
    patch.tags = text(draft.tagsText)
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return patch;
}
