export const CAPABILITY_IDS = [
  'campaign.search',
  'campaign.object.create',
  'campaign.object.history',
  'campaign.object.actions',
  'campaign.section.open',
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
  'map.options.open',
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];
export type PrototypeCapabilityStatus = 'local-demo' | 'planned' | 'disabled';

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
    status: 'planned',
    targetPhase: 'Unified prep search',
    description: 'Search campaign objects and preparation materials.',
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
    status: 'planned',
    targetPhase: 'Campaign object directories',
    description:
      'Open a complete filtered directory for this campaign section.',
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
    status: 'planned',
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
    status: 'planned',
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
    status: 'planned',
    targetPhase: 'Campaign map repository',
    description: 'Create a location pin and save its map position.',
  },
  'map.object.link': {
    id: 'map.object.link',
    label: 'Link map object',
    status: 'planned',
    targetPhase: 'Campaign object links',
    description: 'Link an existing campaign object to this map location.',
  },
  'map.scene.create': {
    id: 'map.scene.create',
    label: 'Create scene',
    status: 'planned',
    targetPhase: 'Scene template command',
    description: 'Create a VTT scene from the selected map location.',
  },
  'map.asset.replace': {
    id: 'map.asset.replace',
    label: 'Replace map asset',
    status: 'planned',
    targetPhase: 'Asset service',
    description: 'Replace this map image through the shared asset service.',
  },
  'encounter.deploy': {
    id: 'encounter.deploy',
    label: 'Deploy encounter',
    status: 'planned',
    targetPhase: 'Existing VTT command path',
    description:
      'Deploy this encounter to the VTT using its existing command path.',
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
