import { panelRegistry } from '@/services/panelRegistry';
import { CharacterPanel } from './CharacterPanel';
import { MonsterPanel } from './MonsterPanel';
import { EncounterPanel } from './EncounterPanel';
import { SpellbookPanel } from './SpellbookPanel';
import { InventoryPanel } from './InventoryPanel';

let registered = false;

export function registerDefaultPanels(): void {
  if (registered) return;
  registered = true;

  panelRegistry.register({
    kind: 'character',
    title: (link) => link.title || 'Character Sheet',
    component: CharacterPanel,
  });

  panelRegistry.register({
    kind: 'monster',
    title: (link) => link.title || 'Monster Stat Block',
    component: MonsterPanel,
  });

  panelRegistry.register({
    kind: 'encounter',
    title: (link) => link.title || 'Combat Encounter',
    component: EncounterPanel,
  });

  panelRegistry.register({
    kind: 'spellbook',
    title: (link) => link.title || 'Spellbook',
    component: SpellbookPanel,
  });

  panelRegistry.register({
    kind: 'item',
    title: (link) => link.title || 'Inventory',
    component: InventoryPanel,
  });
}
