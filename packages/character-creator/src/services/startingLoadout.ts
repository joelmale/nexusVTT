import type {
  CharacterCreationData,
  EquipmentChoice,
  EquipmentItem,
} from '../types/dnd';
import { loadEquipment, loadQuickStartEquipment } from './dataService';

// SRD 5.2.1 Core Class Traits, pp28–77. These are selectable package A facts.
const REVISED_KITS: Record<string, Array<string | [string, number]>> = {
  barbarian: ['Greataxe', ['Handaxe', 4], "Explorer's Pack", '15 gp'],
  bard: ['Leather Armor', ['Dagger', 2], 'Lute', "Entertainer's Pack", '19 gp'],
  cleric: [
    'Chain Shirt',
    'Shield',
    'Mace',
    'Holy Symbol',
    "Priest's Pack",
    '7 gp',
  ],
  druid: [
    'Leather Armor',
    'Shield',
    'Sickle',
    'Quarterstaff',
    "Explorer's Pack",
    'Herbalism Kit',
    '9 gp',
  ],
  fighter: [
    'Chain Mail',
    'Greatsword',
    'Flail',
    ['Javelin', 8],
    "Dungeoneer's Pack",
    '4 gp',
  ],
  monk: ['Spear', ['Dagger', 5], 'Lute', "Explorer's Pack", '11 gp'],
  paladin: [
    'Chain Mail',
    'Shield',
    'Longsword',
    ['Javelin', 6],
    'Holy Symbol',
    "Priest's Pack",
    '9 gp',
  ],
  ranger: [
    'Studded Leather Armor',
    'Scimitar',
    'Shortsword',
    'Longbow',
    ['Arrow', 20],
    'Quiver',
    'Sprig of Mistletoe',
    "Explorer's Pack",
    '7 gp',
  ],
  rogue: [
    'Leather Armor',
    ['Dagger', 2],
    'Shortsword',
    'Shortbow',
    ['Arrow', 20],
    'Quiver',
    "Thieves' Tools",
    "Burglar's Pack",
    '8 gp',
  ],
  sorcerer: ['Spear', ['Dagger', 2], 'Crystal', "Dungeoneer's Pack", '28 gp'],
  warlock: [
    'Leather Armor',
    'Sickle',
    ['Dagger', 2],
    'Orb',
    'Book',
    "Scholar's Pack",
    '15 gp',
  ],
  wizard: [
    ['Dagger', 2],
    'Quarterstaff',
    'Robe',
    'Spellbook',
    "Scholar's Pack",
    '5 gp',
  ],
};

export function getStartingEquipmentChoices(
  data: Pick<CharacterCreationData, 'classSlug' | 'edition'>,
  archer = false,
): EquipmentChoice[] {
  let kit = data.edition === '2024' ? REVISED_KITS[data.classSlug] : undefined;
  if (data.edition === '2024' && data.classSlug === 'fighter' && archer) {
    kit = [
      'Studded Leather Armor',
      'Scimitar',
      'Shortsword',
      'Longbow',
      ['Arrow', 20],
      'Quiver',
      "Dungeoneer's Pack",
      '11 gp',
    ];
  }
  let items: EquipmentItem[];
  if (kit)
    items = kit.map((entry) => ({
      name: typeof entry === 'string' ? entry : entry[0],
      quantity: typeof entry === 'string' ? 1 : entry[1],
      type: 'gear',
    }));
  else {
    const equipment = loadEquipment();
    const preset = loadQuickStartEquipment().classes[data.classSlug];
    const packNames: Record<string, string> = {
      'explorers-pack': "Explorer's Pack",
      'dungeoneers-pack': "Dungeoneer's Pack",
      'burglars-pack': "Burglar's Pack",
      'scholars-pack': "Scholar's Pack",
      'priests-pack': "Priest's Pack",
    };
    items = (preset?.items || []).map((item) => ({
      name:
        equipment.find((entry) => entry.slug === item.equipmentSlug)?.name ||
        packNames[item.equipmentSlug] ||
        item.equipmentSlug,
      quantity: item.quantity,
      type: 'gear',
    }));
    if (preset?.currency?.gp)
      items.push({
        name: `${preset.currency.gp} gp`,
        quantity: 1,
        type: 'gear',
      });
  }
  return [
    {
      choiceId: `${data.edition}:${data.classSlug}:starting-package`,
      description: 'Starting class equipment',
      options: [items],
      selected: 0,
    },
  ];
}
