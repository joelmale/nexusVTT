/**
 * Per-generator action registry.
 *
 * Each generator in the hub (apps/generator-hub/public/*) is a separate
 * Haxe/OpenFL program with its OWN keyboard map, so the same key does
 * different things in each. Every entry below was verified against that
 * generator's key handler (the `switch (keyCode)` in Dungeon.js / Cave.js /
 * Perilous.js / mfcg.js / Dwellings.js). Do not add an action without
 * checking the handler: a wrong key silently does something else.
 *
 * Both the buttons and the keyboard-shortcut list in
 * GeneratorFloatingControls render from this table, so they cannot drift
 * apart.
 */

export type GeneratorId = 'dungeon' | 'cave' | 'world' | 'city' | 'dwelling';

/**
 * - reroll:  generates a new map
 * - toggle:  flips a layer / option on the map
 * - cycle:   steps through a fixed set of looks
 * - dialog:  opens a dialog inside the generator (no direct visual change)
 * - preset:  applies a named style preset
 * - export:  save/export from inside the generator
 */
export type GeneratorActionKind =
  | 'reroll'
  | 'toggle'
  | 'cycle'
  | 'dialog'
  | 'preset'
  | 'export';

export type GeneratorActionGroup =
  | 'generate'
  | 'style'
  | 'layers'
  | 'export';

export type GeneratorIconKey =
  | 'dice'
  | 'palette'
  | 'grid'
  | 'eye'
  | 'tag'
  | 'layers'
  | 'compass'
  | 'sun'
  | 'mountain'
  | 'door'
  | 'type';

export interface GeneratorAction {
  id: string;
  label: string;
  /** Text shown in the shortcut list and tooltip, e.g. "Shift+G". */
  keyLabel: string;
  keyCode: number;
  key: string;
  code: string;
  shiftKey?: boolean;
  kind: GeneratorActionKind;
  group: GeneratorActionGroup;
  /** What the key does, for the tooltip and shortcut list. */
  description: string;
  /** Overrides the generated tooltip (keeps stable text for tests/a11y). */
  title?: string;
  /** Rendered as a button in Quick Actions when present. */
  quick?: { icon: GeneratorIconKey; label?: string };
}

const letter = (ch: string) => ({
  keyCode: ch.toUpperCase().charCodeAt(0),
  key: ch.toLowerCase(),
  code: `Key${ch.toUpperCase()}`,
});

const digit = (n: number) => ({
  keyCode: 48 + n,
  key: String(n),
  code: `Digit${n}`,
});

const ENTER = { keyCode: 13, key: 'Enter', code: 'Enter' };
const SPACE = { keyCode: 32, key: ' ', code: 'Space' };
const TAB = { keyCode: 9, key: 'Tab', code: 'Tab' };

/** Build an action from a one-letter key. */
function k(
  ch: string,
  rest: Omit<
    GeneratorAction,
    'keyCode' | 'key' | 'code' | 'keyLabel'
  > & { keyLabel?: string },
): GeneratorAction {
  const { keyLabel, ...others } = rest;
  const base = letter(ch);
  return {
    ...base,
    ...others,
    keyLabel: keyLabel ?? (others.shiftKey ? `Shift+${ch.toUpperCase()}` : ch.toUpperCase()),
  };
}

const dungeon: GeneratorAction[] = [
  {
    id: 'reroll',
    ...ENTER,
    keyLabel: 'Enter',
    title: 'Reroll new map (Enter)',
    kind: 'reroll',
    group: 'generate',
    label: 'Reroll Map',
    description: 'Reroll new dungeon',
    quick: { icon: 'dice' },
  },
  {
    id: 'rearrange-notes',
    ...SPACE,
    keyLabel: 'Space',
    kind: 'reroll',
    group: 'generate',
    label: 'Rearrange notes',
    description: 'Rearrange notes',
  },
  {
    id: 'reroll-notes',
    ...SPACE,
    shiftKey: true,
    keyLabel: 'Shift+Space',
    kind: 'reroll',
    group: 'generate',
    label: 'Reroll notes',
    description: 'Reroll notes',
  },
  k('R', { id: 'rotate', kind: 'toggle', group: 'generate', label: 'Rotate', description: 'Rotate dungeon' }),
  {
    id: 'tags',
    ...TAB,
    keyLabel: 'Tab',
    kind: 'dialog',
    group: 'generate',
    label: 'Tags',
    description: 'Open tags dialog',
  },
  k('S', { id: 'style', kind: 'cycle', group: 'style', label: 'Cycle Style', description: 'Cycle color style', quick: { icon: 'palette' } }),
  k('G', { id: 'grid', kind: 'toggle', group: 'layers', label: 'Toggle Grid', description: 'Toggle grid', quick: { icon: 'grid' } }),
  k('G', { id: 'grid-mode', kind: 'cycle', group: 'layers', label: 'Grid mode', description: 'Toggle grid mode', shiftKey: true }),
  k('M', { id: 'mono', kind: 'toggle', group: 'style', label: 'Monochrome', description: 'Monochrome toggle' }),
  {
    id: 'cells-normal',
    ...digit(1),
    keyLabel: '1',
    kind: 'toggle',
    group: 'style',
    label: 'Normal cells',
    description: 'Normal cells',
  },
  {
    id: 'cells-small',
    ...digit(2),
    keyLabel: '2',
    kind: 'toggle',
    group: 'style',
    label: 'Small cells',
    description: 'Small cells',
  },
  k('C', { id: 'round', kind: 'toggle', group: 'style', label: 'Round corners', description: 'Round corners' }),
  k('N', { id: 'notes', kind: 'toggle', group: 'layers', label: 'Notes', description: 'Toggle room notes' }),
  k('L', { id: 'legend', kind: 'toggle', group: 'layers', label: 'Legend', description: 'Toggle legend' }),
  k('H', { id: 'secrets', kind: 'toggle', group: 'layers', label: 'Secrets', description: 'Toggle secret rooms', quick: { icon: 'eye' } }),
  k('P', { id: 'props', kind: 'toggle', group: 'layers', label: 'Props', description: 'Toggle room props' }),
  k('W', { id: 'water', kind: 'toggle', group: 'layers', label: 'Water', description: 'Toggle water' }),
  k('W', { id: 'water-height', kind: 'dialog', group: 'layers', label: 'Water height', description: 'Adjust water height', shiftKey: true }),
  k('E', { id: 'export-png', kind: 'export', group: 'export', label: 'Export PNG', description: 'Export high-res PNG' }),
  k('J', { id: 'export-json', kind: 'export', group: 'export', label: 'Export JSON', description: 'Export dungeon JSON' }),
];

const cave: GeneratorAction[] = [
  { id: 'reroll', ...ENTER, keyLabel: 'Enter', title: 'Reroll new map (Enter)', kind: 'reroll', group: 'generate', label: 'Reroll Map', description: 'Generate new cave', quick: { icon: 'dice' } },
  { id: 'tags', ...TAB, keyLabel: 'Tab', kind: 'dialog', group: 'generate', label: 'Tags', description: 'Cave tags' },
  k('R', { id: 'rotate', kind: 'dialog', group: 'generate', label: 'Rotate', description: 'Rotation dialog' }),
  k('S', { id: 'style', kind: 'dialog', group: 'style', label: 'Style…', description: 'Open the style dialog', quick: { icon: 'palette' } }),
  k('M', { id: 'smooth', kind: 'toggle', group: 'style', label: 'Smooth', description: 'Toggle smooth walls', quick: { icon: 'layers' } }),
  k('E', { id: 'even', kind: 'toggle', group: 'style', label: 'Even', description: 'Toggle even walls' }),
  k('F', { id: 'glade', kind: 'toggle', group: 'layers', label: 'Glade', description: 'Toggle glade' }),
  k('G', { id: 'grid', kind: 'toggle', group: 'layers', label: 'Toggle Grid', description: 'Toggle grid', quick: { icon: 'grid' } }),
  k('G', { id: 'grid-custom', kind: 'dialog', group: 'layers', label: 'Custom grid', description: 'Custom grid', shiftKey: true }),
  k('H', { id: 'shading', kind: 'toggle', group: 'layers', label: 'Shading', description: 'Toggle shading', quick: { icon: 'sun' } }),
  k('N', { id: 'tunnels', kind: 'toggle', group: 'layers', label: 'Tunnels', description: 'Toggle tunnels', quick: { icon: 'mountain' } }),
  k('T', { id: 'title', kind: 'toggle', group: 'layers', label: 'Title', description: 'Toggle title' }),
  k('W', { id: 'water', kind: 'dialog', group: 'layers', label: 'Water', description: 'Water / geology dialog' }),
];

const world: GeneratorAction[] = [
  { id: 'reroll', ...ENTER, keyLabel: 'Enter', title: 'Reroll new map (Enter)', kind: 'reroll', group: 'generate', label: 'New Region', description: 'Generate a new region', quick: { icon: 'dice' } },
  { id: 'reset-region', ...ENTER, shiftKey: true, keyLabel: 'Shift+Enter', kind: 'reroll', group: 'generate', label: 'Reset region', description: 'Reset the current region' },
  { id: 'preset-bw', ...digit(1), keyLabel: '1', kind: 'preset', group: 'style', label: 'Black & white', description: 'Black & white preset' },
  { id: 'preset-antique', ...digit(2), keyLabel: '2', kind: 'preset', group: 'style', label: 'Antique', description: 'Antique preset' },
  { id: 'preset-soft', ...digit(3), keyLabel: '3', kind: 'preset', group: 'style', label: 'Soft', description: 'Soft preset' },
  { id: 'preset-cartoon', ...digit(4), keyLabel: '4', kind: 'preset', group: 'style', label: 'Cartoon', description: 'Cartoon preset' },
  { id: 'preset-october', ...digit(5), keyLabel: '5', kind: 'preset', group: 'style', label: 'October', description: 'October preset' },
  k('S', { id: 'style', kind: 'dialog', group: 'style', label: 'Style…', description: 'Open the style dialog', quick: { icon: 'palette' } }),
  k('M', { id: 'matte', kind: 'toggle', group: 'style', label: 'Matte', description: 'Toggle matte' }),
  k('A', { id: 'rugged', kind: 'toggle', group: 'style', label: 'Rugged', description: 'Toggle rugged coastlines' }),
  k('G', { id: 'grid', kind: 'toggle', group: 'layers', label: 'Toggle Grid', description: 'Toggle grid', quick: { icon: 'grid' } }),
  k('L', { id: 'labels', kind: 'toggle', group: 'layers', label: 'Labels', description: 'Toggle labels', quick: { icon: 'tag' } }),
  k('H', { id: 'shading', kind: 'cycle', group: 'layers', label: 'Shading', description: 'Cycle terrain shading', quick: { icon: 'sun' } }),
  k('C', { id: 'compass', kind: 'toggle', group: 'layers', label: 'Compass', description: 'Toggle compass', quick: { icon: 'compass' } }),
  k('F', { id: 'forest', kind: 'toggle', group: 'layers', label: 'Forest type', description: 'Toggle forest type' }),
  k('I', { id: 'trees', kind: 'toggle', group: 'layers', label: 'Individual trees', description: 'Toggle individual trees' }),
  k('T', { id: 'towns', kind: 'reroll', group: 'generate', label: 'Random towns', description: 'Re-place towns' }),
  k('N', { id: 'names', kind: 'dialog', group: 'generate', label: 'Names…', description: 'Open the toponymy dialog' }),
  k('N', { id: 'reroll-names', kind: 'reroll', group: 'generate', label: 'Reroll names', description: 'Reroll place names', shiftKey: true }),
];

const city: GeneratorAction[] = [
  { id: 'reroll', ...ENTER, keyLabel: 'Enter', title: 'Reroll new map (Enter)', kind: 'reroll', group: 'generate', label: 'Reroll Map', description: 'Generate a new city', quick: { icon: 'dice' } },
  { id: 'preset-default', ...digit(1), keyLabel: '1', kind: 'preset', group: 'style', label: 'Default', description: 'Default preset' },
  { id: 'preset-ink', ...digit(2), keyLabel: '2', kind: 'preset', group: 'style', label: 'Ink', description: 'Ink preset' },
  { id: 'preset-bw', ...digit(3), keyLabel: '3', kind: 'preset', group: 'style', label: 'Black & white', description: 'Black & white preset' },
  { id: 'preset-vivid', ...digit(4), keyLabel: '4', kind: 'preset', group: 'style', label: 'Vivid', description: 'Vivid preset' },
  { id: 'preset-natural', ...digit(5), keyLabel: '5', kind: 'preset', group: 'style', label: 'Natural', description: 'Natural preset' },
  { id: 'preset-modern', ...digit(6), keyLabel: '6', kind: 'preset', group: 'style', label: 'Modern', description: 'Modern preset' },
  k('S', { id: 'style', kind: 'dialog', group: 'style', label: 'Style…', description: 'Open the style window', quick: { icon: 'palette' } }),
  k('C', { id: 'colors', kind: 'dialog', group: 'style', label: 'Colors…', description: 'Edit colors' }),
  k('D', { id: 'grid', kind: 'toggle', group: 'layers', label: 'Toggle Grid', description: 'Toggle grid', quick: { icon: 'grid' } }),
  k('L', { id: 'districts', kind: 'toggle', group: 'layers', label: 'Districts', description: 'Toggle districts', quick: { icon: 'layers' } }),
  k('A', { id: 'alleys', kind: 'toggle', group: 'layers', label: 'Alleys', description: 'Toggle alleys', quick: { icon: 'tag' } }),
  k('N', { id: 'thin-lines', kind: 'toggle', group: 'layers', label: 'Thin lines', description: 'Toggle thin lines', quick: { icon: 'type' } }),
  k('B', { id: 'buildings', kind: 'dialog', group: 'layers', label: 'Buildings…', description: 'Buildings dialog' }),
  k('B', { id: 'buildings-toggle', kind: 'toggle', group: 'layers', label: 'Buildings', description: 'Toggle buildings', shiftKey: true }),
  k('E', { id: 'elements', kind: 'dialog', group: 'layers', label: 'Elements…', description: 'Elements dialog' }),
];

const dwelling: GeneratorAction[] = [
  { id: 'reroll', ...ENTER, keyLabel: 'Enter', title: 'Reroll new map (Enter)', kind: 'reroll', group: 'generate', label: 'Reroll Map', description: 'Generate a new dwelling', quick: { icon: 'dice' } },
  { id: 'preset-simple', ...digit(6), keyLabel: '6', kind: 'preset', group: 'style', label: 'Simple', description: 'Simple architecture' },
  { id: 'preset-castle', ...digit(7), keyLabel: '7', kind: 'preset', group: 'style', label: 'Castle', description: 'Castle architecture' },
  { id: 'preset-logs', ...digit(8), keyLabel: '8', kind: 'preset', group: 'style', label: 'Logs', description: 'Log-cabin architecture' },
  { id: 'preset-modern', ...digit(9), keyLabel: '9', kind: 'preset', group: 'style', label: 'Modern', description: 'Modern architecture' },
  { id: 'preset-scifi', ...digit(0), keyLabel: '0', kind: 'preset', group: 'style', label: 'Sci-fi', description: 'Sci-fi architecture' },
  k('S', { id: 'style', kind: 'dialog', group: 'style', label: 'Style…', description: 'Open the colors dialog', quick: { icon: 'palette' } }),
  k('E', { id: 'view', kind: 'cycle', group: 'style', label: 'Switch view', description: 'Switch view' }),
  k('B', { id: 'blueprint', kind: 'toggle', group: 'style', label: 'Blueprint', description: 'Switch to blueprint' }),
  k('G', { id: 'grid', kind: 'toggle', group: 'layers', label: 'Toggle Grid', description: 'Toggle grid', quick: { icon: 'grid' } }),
  k('R', { id: 'labels', kind: 'toggle', group: 'layers', label: 'Labels', description: 'Toggle labels', quick: { icon: 'tag' } }),
  k('D', { id: 'doors', kind: 'toggle', group: 'layers', label: 'Doors', description: 'Toggle doors', quick: { icon: 'door' } }),
  k('L', { id: 'lights', kind: 'toggle', group: 'layers', label: 'Lights', description: 'Toggle lights', quick: { icon: 'sun' } }),
  k('P', { id: 'props', kind: 'toggle', group: 'layers', label: 'Props', description: 'Toggle props' }),
  k('A', { id: 'arrows', kind: 'toggle', group: 'layers', label: 'Arrows', description: 'Toggle stair arrows' }),
  k('O', { id: 'occlusion', kind: 'toggle', group: 'layers', label: 'Ambient occlusion', description: 'Toggle ambient occlusion' }),
  k('X', { id: 'advanced-export', kind: 'dialog', group: 'export', label: 'Advanced export…', description: 'Multi-export dialog' }),
];

export const GENERATOR_ACTIONS: Record<GeneratorId, GeneratorAction[]> = {
  dungeon,
  cave,
  world,
  city,
  dwelling,
};

export const GENERATOR_GROUP_LABELS: Record<GeneratorActionGroup, string> = {
  generate: 'Generation & Layout',
  style: 'Style & Presets',
  layers: 'Layers & Grid',
  export: 'Export',
};

export function getQuickActions(id: GeneratorId): GeneratorAction[] {
  return GENERATOR_ACTIONS[id].filter((a) => a.quick);
}

/** Groups for the shortcut list, in a stable order, empty groups omitted. */
export function getShortcutGroups(
  id: GeneratorId,
): { group: GeneratorActionGroup; label: string; items: GeneratorAction[] }[] {
  const order: GeneratorActionGroup[] = ['generate', 'style', 'layers', 'export'];
  return order
    .map((group) => ({
      group,
      label: GENERATOR_GROUP_LABELS[group],
      items: GENERATOR_ACTIONS[id].filter((a) => a.group === group),
    }))
    .filter((g) => g.items.length > 0);
}

/** Tooltip text: "<description> (<key>)". */
export function actionTitle(action: GeneratorAction): string {
  if (action.title) return action.title;
  return `${action.description} (${action.keyLabel})`;
}
