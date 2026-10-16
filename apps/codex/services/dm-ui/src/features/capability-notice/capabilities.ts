export const CAPABILITY_IDS = [
  'campaign.search',
  'campaign.search.overview',
  'campaign.object.create',
  'campaign.object.history',
  'campaign.object.actions',
  'campaign.section.open',
  'campaign.example.seed',
  'campaign.settings.open',
  'campaign.theme.change',
  'session-plan.publish',
  'session-plan.preview',
  'session-plan.activate',
  'session-plan.chat-prep',
  'map.pin.create',
  'map.object.link',
  'map.scene.create',
  'map.asset.replace',
  'encounter.deploy',
  'encounter.deploy.demo',
  'map.options.open',
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];
export type PrototypeCapabilityStatus =
  'local-demo' | 'planned' | 'disabled' | 'implemented';

export interface PrototypeCapability {
  id: CapabilityId;
  label: string;
  status: PrototypeCapabilityStatus;
  targetPhase: string;
  description: string;
}

export const CAPABILITY_REGISTRY: Record<CapabilityId, PrototypeCapability> = {
  'campaign.search': {
    id: 'campaign.search',
    label: 'Campaign search',
    status: 'implemented',
    targetPhase: 'Unified prep search',
    description:
      'Search the open campaign by title and text. Press Ctrl+K or Cmd+K on any section page.',
  },
  'campaign.search.overview': {
    id: 'campaign.search.overview',
    label: 'Campaign search',
    status: 'planned',
    targetPhase: 'Overview search',
    description:
      'Search runs inside the campaign sections. Open NPCs, Quests, World or Notes, then use the search button or press Ctrl+K.',
  },
  'campaign.object.create': {
    id: 'campaign.object.create',
    label: 'Create campaign object',
    status: 'planned',
    targetPhase: 'Campaign prep API',
    description: 'Create an object or add a dependency to campaign prep.',
  },
  'campaign.object.history': {
    id: 'campaign.object.history',
    label: 'Campaign object history',
    status: 'planned',
    targetPhase: 'Versioned campaign objects',
    description: 'View prior versions and revision details for this object.',
  },
  'campaign.object.actions': {
    id: 'campaign.object.actions',
    label: 'Campaign object actions',
    status: 'planned',
    targetPhase: 'Campaign object commands',
    description: 'Open the command menu for this campaign object.',
  },
  'campaign.section.open': {
    id: 'campaign.section.open',
    label: 'Open campaign directory',
    status: 'implemented',
    targetPhase: 'Campaign object directories',
    description:
      'Open a complete filtered directory for this campaign section.',
  },
  'campaign.example.seed': {
    id: 'campaign.example.seed',
    label: 'Start from this example',
    status: 'planned',
    targetPhase: 'Full example clone',
    description:
      'Create a new editable campaign seeded from this example. Needs a server-backed build; this one is not connected to a campaign server.',
  },
  'campaign.settings.open': {
    id: 'campaign.settings.open',
    label: 'Campaign settings',
    status: 'planned',
    targetPhase: 'Campaign configuration',
    description:
      'Configure campaign metadata, rules, members, and permissions.',
  },
  'campaign.theme.change': {
    id: 'campaign.theme.change',
    label: 'Change studio theme',
    status: 'planned',
    targetPhase: 'Studio preferences',
    description: 'Choose the visual theme used by Campaign Studio.',
  },
  'session-plan.publish': {
    id: 'session-plan.publish',
    label: 'Publish session plan',
    status: 'implemented',
    targetPhase: 'Session plan repository',
    description: 'Publish this plan and create a durable session revision.',
  },
  'session-plan.preview': {
    id: 'session-plan.preview',
    label: 'Preview session plan',
    status: 'planned',
    targetPhase: 'Session-plan validator',
    description: 'Validate and preview the prepared session plan.',
  },
  'session-plan.activate': {
    id: 'session-plan.activate',
    label: 'Play in VTT',
    status: 'implemented',
    targetPhase: 'VTT domain command',
    description: 'Open this session in the VTT using a domain command.',
  },
  'session-plan.chat-prep': {
    id: 'session-plan.chat-prep',
    label: 'Chat Prep',
    status: 'planned',
    targetPhase: 'Grounded assistant, later decision',
    description: 'Prepare session materials with a grounded assistant.',
  },
  'map.pin.create': {
    id: 'map.pin.create',
    label: 'Add map pin',
    status: 'implemented',
    targetPhase: 'Campaign map repository',
    description: 'Create a location pin and save its map position.',
  },
  'map.object.link': {
    id: 'map.object.link',
    label: 'Link map object',
    status: 'implemented',
    targetPhase: 'Campaign object links',
    description: 'Link an existing campaign object to this map location.',
  },
  'map.scene.create': {
    id: 'map.scene.create',
    label: 'Create scene',
    status: 'implemented',
    targetPhase: 'Scene template command',
    description: 'Create a VTT scene from the selected map location.',
  },
  'map.asset.replace': {
    id: 'map.asset.replace',
    label: 'Replace map asset',
    status: 'implemented',
    targetPhase: 'Asset service',
    description:
      'Replace this map image with one of your assets or a new upload (Replace image on the map).',
  },
  'encounter.deploy': {
    id: 'encounter.deploy',
    label: 'Deploy encounter',
    status: 'implemented',
    targetPhase: 'VTT run sheet',
    description:
      'Launch the campaign run sheet in the VTT (Play in VTT on the session plan), then deploy the encounter from its step. Each step deploys once, even after a reconnect.',
  },
  'encounter.deploy.demo': {
    id: 'encounter.deploy.demo',
    label: 'Deploy encounter',
    status: 'local-demo',
    targetPhase: 'Example campaign',
    description:
      'Example campaigns are read-only and are not connected to a VTT. Open a server-backed campaign to deploy encounters.',
  },
  'map.options.open': {
    id: 'map.options.open',
    label: 'Map options',
    status: 'planned',
    targetPhase: 'Campaign map repository',
    description: 'Rename, replace, duplicate, or archive this campaign map.',
  },
};

export function getCapability(id: CapabilityId): PrototypeCapability {
  return CAPABILITY_REGISTRY[id];
}
