/* eslint-disable react-refresh/only-export-components -- route table, not a component module */
import type { ReactElement } from 'react';

import { LegacyTabRedirect } from './LegacyTabRedirect';
import { MapPreparationRoute } from './MapPreparationRoute';
import { SessionPlanRoute } from './SessionPlanRoute';
import { EncountersSectionRoute } from './sections/EncountersSectionRoute';
import { FactionsSectionRoute } from './sections/FactionsSectionRoute';
import { LoreSectionRoute } from './sections/LoreSectionRoute';
import { MapsSectionRoute } from './sections/MapsSectionRoute';
import { NpcsSectionRoute } from './sections/NpcsSectionRoute';
import { QuestsSectionRoute } from './sections/QuestsSectionRoute';
import { SessionsSectionRoute } from './sections/SessionsSectionRoute';
import { WorldSectionRoute } from './sections/WorldSectionRoute';

export interface SectionRouteDefinition {
  /** Path relative to `demo/:fixtureSlug` or `campaigns/:campaignId`. */
  path: string;
  element: ReactElement;
}

/**
 * Every section route. App.tsx registers each one under both
 * `demo/:fixtureSlug/` and `campaigns/:campaignId/`.
 */
export const SECTION_ROUTES: SectionRouteDefinition[] = [
  { path: 'sessions/:sessionId?', element: <SessionsSectionRoute /> },
  { path: 'sessions/:sessionId/plan', element: <SessionPlanRoute /> },
  { path: 'world/:locationId?', element: <WorldSectionRoute /> },
  { path: 'npcs/:npcId?', element: <NpcsSectionRoute /> },
  { path: 'factions/:factionId?', element: <FactionsSectionRoute /> },
  { path: 'quests/:questId?', element: <QuestsSectionRoute /> },
  { path: 'encounters/:encounterId?', element: <EncountersSectionRoute /> },
  { path: 'maps', element: <MapsSectionRoute /> },
  { path: 'maps/:mapId', element: <MapPreparationRoute /> },
  { path: 'lore/:tab?/:itemId?', element: <LoreSectionRoute /> },
  { path: 'notes/:noteId?', element: <LegacyTabRedirect tab="notes" /> },
  {
    path: 'handouts/:handoutId?',
    element: <LegacyTabRedirect tab="handouts" />,
  },
];

export const SECTION_ROUTE_PREFIXES = [
  'demo/:fixtureSlug',
  'campaigns/:campaignId',
] as const;

/** Old Ashes-only URLs mapped to their parameterized equivalents. */
export const LEGACY_REDIRECTS: ReadonlyArray<{ from: string; to: string }> = [
  {
    from: 'demo/ashes-of-veyra/maps/glass-harbor',
    to: '/demo/ashes-of-veyra/maps/map-glass-harbor',
  },
  {
    from: 'campaigns/ashes-of-veyra/overview',
    to: '/demo/ashes-of-veyra/overview',
  },
  {
    from: 'campaigns/ashes-of-veyra/sessions/session-12',
    to: '/demo/ashes-of-veyra/sessions/session-12/plan',
  },
  {
    from: 'campaigns/ashes-of-veyra/maps/glass-harbor',
    to: '/demo/ashes-of-veyra/maps/map-glass-harbor',
  },
];
