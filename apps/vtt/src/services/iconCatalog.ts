/**
 * Central Icon Catalog for NexusVTT.
 * Defines typed IDs, metadata, default fallbacks, and ComfyUI generation prompts
 * for all swappable icons across UI panels, D&D 5e conditions, and canvas tools.
 */

export type IconCategory = 'panels' | 'conditions' | 'tools' | 'actions';

export interface IconDefinition {
  id: string;
  name: string;
  category: IconCategory;
  defaultFallback: string;
  defaultAsset?: string;
  subjectPrompt: string;
}

export interface IconThemePack {
  id: string;
  name: string;
  description: string;
  category?: IconCategory | 'all';
  icons: Record<string, string>;
  isBuiltIn: boolean;
}

export const ICON_CATALOG: Record<string, IconDefinition> = {
  // ── UI Panels ─────────────────────────────────────────────────────────────
  'panel:atlas': {
    id: 'panel:atlas',
    name: 'Atlas Studio',
    category: 'panels',
    defaultFallback: '📚',
    defaultAsset: '/assets/icons/panels/atlas.png',
    subjectPrompt: 'an open atlas book with a compass rose on its cover',
  },
  'panel:tokens': {
    id: 'panel:tokens',
    name: 'Tokens Tray',
    category: 'panels',
    defaultFallback: '👤',
    defaultAsset: '/assets/icons/panels/tokens.png',
    subjectPrompt: 'a round game token with a hooded adventurer silhouette',
  },
  'panel:scene': {
    id: 'panel:scene',
    name: 'Scene Manager',
    category: 'panels',
    defaultFallback: '🖼️',
    defaultAsset: '/assets/icons/panels/scene.png',
    subjectPrompt: 'a framed landscape picture with mountains and a sun',
  },
  'panel:props': {
    id: 'panel:props',
    name: 'Props Library',
    category: 'panels',
    defaultFallback: '📦',
    defaultAsset: '/assets/icons/panels/props.png',
    subjectPrompt: 'a wooden treasure crate with a lid',
  },
  'panel:session-plan': {
    id: 'panel:session-plan',
    name: 'Session Run Sheet',
    category: 'panels',
    defaultFallback: '📋',
    defaultAsset: '/assets/icons/panels/session-plan.png',
    subjectPrompt: 'a clipboard with a checklist',
  },
  'panel:generator': {
    id: 'panel:generator',
    name: 'Dungeon Generator',
    category: 'panels',
    defaultFallback: '🗺️',
    defaultAsset: '/assets/icons/panels/generator.png',
    subjectPrompt: 'a folded treasure map with a dotted path and an X mark',
  },
  'panel:initiative': {
    id: 'panel:initiative',
    name: 'Turn Tracker',
    category: 'panels',
    defaultFallback: '⏱️',
    defaultAsset: '/assets/icons/panels/initiative.png',
    subjectPrompt: 'an hourglass',
  },
  'panel:characters': {
    id: 'panel:characters',
    name: 'Characters',
    category: 'panels',
    defaultFallback: '👥',
    defaultAsset: '/assets/icons/panels/characters.png',
    subjectPrompt: 'two adventurer silhouettes standing side by side',
  },
  'panel:dice': {
    id: 'panel:dice',
    name: 'Dice Roller',
    category: 'panels',
    defaultFallback: '🎲',
    defaultAsset: '/assets/icons/panels/dice.png',
    subjectPrompt: 'a single twenty-sided die (d20) with a 20 showing',
  },
  'panel:documents': {
    id: 'panel:documents',
    name: 'Campaign Docs',
    category: 'panels',
    defaultFallback: '📜',
    defaultAsset: '/assets/icons/panels/documents.png',
    subjectPrompt: 'a stack of parchment scrolls',
  },
  'panel:chat': {
    id: 'panel:chat',
    name: 'Game Chat',
    category: 'panels',
    defaultFallback: '💬',
    defaultAsset: '/assets/icons/panels/chat.png',
    subjectPrompt: 'a speech bubble',
  },
  'panel:sounds': {
    id: 'panel:sounds',
    name: 'Soundboard',
    category: 'panels',
    defaultFallback: '🔊',
    defaultAsset: '/assets/icons/panels/sounds.png',
    subjectPrompt: 'a speaker with sound waves',
  },
  'panel:lobby': {
    id: 'panel:lobby',
    name: 'Game Lobby',
    category: 'panels',
    defaultFallback: '🏠',
    defaultAsset: '/assets/icons/panels/lobby.png',
    subjectPrompt: 'a castle gatehouse with a door',
  },
  'panel:settings': {
    id: 'panel:settings',
    name: 'Settings',
    category: 'panels',
    defaultFallback: '⚙️',
    defaultAsset: '/assets/icons/panels/settings.png',
    subjectPrompt: 'a gear cog',
  },

  // ── D&D 5e Status Conditions ──────────────────────────────────────────────
  'condition:blinded': {
    id: 'condition:blinded',
    name: 'Blinded',
    category: 'conditions',
    defaultFallback: '👁️‍🗨️',
    defaultAsset: '/assets/icons/conditions/blinded.png',
    subjectPrompt: 'an open eye with a diagonal slash through it',
  },
  'condition:charmed': {
    id: 'condition:charmed',
    name: 'Charmed',
    category: 'conditions',
    defaultFallback: '💖',
    defaultAsset: '/assets/icons/conditions/charmed.png',
    subjectPrompt: 'a glowing heart radiating spiral charm waves',
  },
  'condition:deafened': {
    id: 'condition:deafened',
    name: 'Deafened',
    category: 'conditions',
    defaultFallback: '🔇',
    defaultAsset: '/assets/icons/conditions/deafened.png',
    subjectPrompt: 'an ear icon with a cross through it',
  },
  'condition:frightened': {
    id: 'condition:frightened',
    name: 'Frightened',
    category: 'conditions',
    defaultFallback: '😨',
    defaultAsset: '/assets/icons/conditions/frightened.png',
    subjectPrompt: 'a screaming mask or terrified skull face',
  },
  'condition:grappled': {
    id: 'condition:grappled',
    name: 'Grappled',
    category: 'conditions',
    defaultFallback: '🤝',
    defaultAsset: '/assets/icons/conditions/grappled.png',
    subjectPrompt: 'two gripping skeletal hands clasping tightly',
  },
  'condition:incapacitated': {
    id: 'condition:incapacitated',
    name: 'Incapacitated',
    category: 'conditions',
    defaultFallback: '😵',
    defaultAsset: '/assets/icons/conditions/incapacitated.png',
    subjectPrompt: 'a cracked shattered shield with a drooping head',
  },
  'condition:invisible': {
    id: 'condition:invisible',
    name: 'Invisible',
    category: 'conditions',
    defaultFallback: '🫥',
    defaultAsset: '/assets/icons/conditions/invisible.png',
    subjectPrompt: 'a dotted outline of a hooded figure disappearing into thin air',
  },
  'condition:paralyzed': {
    id: 'condition:paralyzed',
    name: 'Paralyzed',
    category: 'conditions',
    defaultFallback: '⚡',
    defaultAsset: '/assets/icons/conditions/paralyzed.png',
    subjectPrompt: 'a lightning bolt striking a stiff frozen human figure',
  },
  'condition:petrified': {
    id: 'condition:petrified',
    name: 'Petrified',
    category: 'conditions',
    defaultFallback: '🗿',
    defaultAsset: '/assets/icons/conditions/petrified.png',
    subjectPrompt: 'a cracked stone statue head with rocky texture',
  },
  'condition:poisoned': {
    id: 'condition:poisoned',
    name: 'Poisoned',
    category: 'conditions',
    defaultFallback: '🧪',
    defaultAsset: '/assets/icons/conditions/poisoned.png',
    subjectPrompt: 'a bubbling toxic potion vial with a skull drop',
  },
  'condition:prone': {
    id: 'condition:prone',
    name: 'Prone',
    category: 'conditions',
    defaultFallback: '🛌',
    defaultAsset: '/assets/icons/conditions/prone.png',
    subjectPrompt: 'a silhouette of a person lying flat on the ground',
  },
  'condition:restrained': {
    id: 'condition:restrained',
    name: 'Restrained',
    category: 'conditions',
    defaultFallback: '⛓️',
    defaultAsset: '/assets/icons/conditions/restrained.png',
    subjectPrompt: 'heavy iron chains and shackles binding limbs',
  },
  'condition:stunned': {
    id: 'condition:stunned',
    name: 'Stunned',
    category: 'conditions',
    defaultFallback: '💫',
    defaultAsset: '/assets/icons/conditions/stunned.png',
    subjectPrompt: 'a head with a ring of spinning dazed stars around it',
  },
  'condition:unconscious': {
    id: 'condition:unconscious',
    name: 'Unconscious',
    category: 'conditions',
    defaultFallback: '💤',
    defaultAsset: '/assets/icons/conditions/unconscious.png',
    subjectPrompt: 'a closed drooping eye with three Z floating sleep symbols',
  },
  'condition:exhaustion': {
    id: 'condition:exhaustion',
    name: 'Exhaustion',
    category: 'conditions',
    defaultFallback: '🕯️',
    defaultAsset: '/assets/icons/conditions/exhaustion.png',
    subjectPrompt: 'a wilting candle flame nearly extinguished',
  },
  'condition:dead': {
    id: 'condition:dead',
    name: 'Dead / Defeated',
    category: 'conditions',
    defaultFallback: '💀',
    defaultAsset: '/assets/icons/conditions/dead.png',
    subjectPrompt: 'a grim skull with crossbones',
  },

  // ── Canvas & Toolbar Tools ────────────────────────────────────────────────
  'tool:select': {
    id: 'tool:select',
    name: 'Select Tool',
    category: 'tools',
    defaultFallback: '↖️',
    subjectPrompt: 'a sleek pointer arrow cursor',
  },
  'tool:pan': {
    id: 'tool:pan',
    name: 'Pan Canvas',
    category: 'tools',
    defaultFallback: '✋',
    subjectPrompt: 'an open flat hand icon',
  },
  'tool:ruler': {
    id: 'tool:ruler',
    name: 'Measure Distance',
    category: 'tools',
    defaultFallback: '📏',
    subjectPrompt: 'a wooden measuring ruler with grid marks',
  },
  'tool:pencil': {
    id: 'tool:pencil',
    name: 'Freehand Draw',
    category: 'tools',
    defaultFallback: '✏️',
    subjectPrompt: 'a feather quill pen with an ink tip',
  },
  'tool:eraser': {
    id: 'tool:eraser',
    name: 'Eraser',
    category: 'tools',
    defaultFallback: '🧹',
    subjectPrompt: 'a rubber eraser wiping away ink marks',
  },
  'tool:shape-rect': {
    id: 'tool:shape-rect',
    name: 'Rectangle Shape',
    category: 'tools',
    defaultFallback: '⏹️',
    subjectPrompt: 'a glowing geometric square boundary',
  },
  'tool:shape-circle': {
    id: 'tool:shape-circle',
    name: 'Circle / Sphere AoE',
    category: 'tools',
    defaultFallback: '⭕',
    subjectPrompt: 'a radiating concentric magical circle',
  },
  'tool:shape-cone': {
    id: 'tool:shape-cone',
    name: 'Cone AoE',
    category: 'tools',
    defaultFallback: '📐',
    subjectPrompt: 'a triangular spell cone blast',
  },
  'tool:fog-reveal': {
    id: 'tool:fog-reveal',
    name: 'Reveal Fog of War',
    category: 'tools',
    defaultFallback: '🔦',
    subjectPrompt: 'a lantern casting a beam of light through darkness',
  },
  'tool:ping': {
    id: 'tool:ping',
    name: 'Map Ping',
    category: 'tools',
    defaultFallback: '📍',
    subjectPrompt: 'a glowing crosshair target with pulsing concentric ripples',
  },
};

export const BUILT_IN_PACKS: IconThemePack[] = [
  {
    id: 'nexus-vector-gold',
    name: 'Nexus Vector (Gold & Indigo)',
    description: 'Crisp fantasy vector artwork on transparent backgrounds, stylized in deep indigo and warm gold.',
    category: 'all',
    isBuiltIn: true,
    icons: Object.entries(ICON_CATALOG).reduce<Record<string, string>>((acc, [id, def]) => {
      if (def.defaultAsset) {
        acc[id] = def.defaultAsset;
      }
      return acc;
    }, {}),
  },
  {
    id: 'default-emoji',
    name: 'Classic Unicode & Emoji',
    description: 'Lightweight, native platform emoji and typographic icons.',
    category: 'all',
    isBuiltIn: true,
    icons: {},
  },
];

export function getIconDefinition(id: string): IconDefinition | undefined {
  return ICON_CATALOG[id];
}

export function getIconsByCategory(category: IconCategory): IconDefinition[] {
  return Object.values(ICON_CATALOG).filter((def) => def.category === category);
}

export function getAllIconDefinitions(): IconDefinition[] {
  return Object.values(ICON_CATALOG);
}
