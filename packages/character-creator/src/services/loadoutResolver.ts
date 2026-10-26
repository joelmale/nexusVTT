import { CharacterCreationData } from '../types/dnd';
import {
  CreationDraft,
  ResolvedCurrency,
  ResolvedEquipmentItem,
  ResolvedLoadout,
} from '../types/draft';
import { loadEquipment, BACKGROUNDS } from './dataService';
import { parseCoinString } from './equipmentService';

/**
 * Packs mapping for container expansion
 */
const PACK_EXPANSIONS: Record<
  string,
  Array<{ name: string; quantity: number }>
> = {
  "dungeoneer's pack": [
    { name: 'Backpack', quantity: 1 },
    { name: 'Crowbar', quantity: 1 },
    { name: 'Hammer', quantity: 1 },
    { name: 'Piton', quantity: 10 },
    { name: 'Torch', quantity: 10 },
    { name: 'Tinderbox', quantity: 1 },
    { name: 'Rations (1 day)', quantity: 10 },
    { name: 'Waterskin', quantity: 1 },
    { name: 'Hempen Rope (50 feet)', quantity: 1 },
  ],
  "explorer's pack": [
    { name: 'Backpack', quantity: 1 },
    { name: 'Bedroll', quantity: 1 },
    { name: 'Mess Kit', quantity: 1 },
    { name: 'Tinderbox', quantity: 1 },
    { name: 'Torch', quantity: 10 },
    { name: 'Rations (1 day)', quantity: 10 },
    { name: 'Waterskin', quantity: 1 },
    { name: 'Hempen Rope (50 feet)', quantity: 1 },
  ],
  "burglar's pack": [
    { name: 'Backpack', quantity: 1 },
    { name: 'Ball Bearings (bag of 1,000)', quantity: 1 },
    { name: 'String (10 feet)', quantity: 1 },
    { name: 'Bell', quantity: 1 },
    { name: 'Candle', quantity: 5 },
    { name: 'Crowbar', quantity: 1 },
    { name: 'Hammer', quantity: 1 },
    { name: 'Piton', quantity: 10 },
    { name: 'Hooded Lantern', quantity: 1 },
    { name: 'Oil (flask)', quantity: 2 },
    { name: 'Rations (1 day)', quantity: 5 },
    { name: 'Tinderbox', quantity: 1 },
    { name: 'Waterskin', quantity: 1 },
    { name: 'Hempen Rope (50 feet)', quantity: 1 },
  ],
  "priest's pack": [
    { name: 'Backpack', quantity: 1 },
    { name: 'Blanket', quantity: 1 },
    { name: 'Candle', quantity: 10 },
    { name: 'Tinderbox', quantity: 1 },
    { name: 'Alms Box', quantity: 1 },
    { name: 'Block of Incense', quantity: 2 },
    { name: 'Censer', quantity: 1 },
    { name: 'Vestments', quantity: 1 },
    { name: 'Rations (1 day)', quantity: 2 },
    { name: 'Waterskin', quantity: 1 },
  ],
  "scholar's pack": [
    { name: 'Backpack', quantity: 1 },
    { name: 'Book of Lore', quantity: 1 },
    { name: 'Ink (1 ounce bottle)', quantity: 1 },
    { name: 'Ink Pen', quantity: 1 },
    { name: 'Parchment (10 sheets)', quantity: 1 },
    { name: 'Little Bag of Sand', quantity: 1 },
    { name: 'Small Knife', quantity: 1 },
  ],
};

/**
 * Calculates total currency value in gold pieces
 */
export function calculateTotalCurrencyGp(c: ResolvedCurrency): number {
  return Number(
    (c.gp + c.pp * 10 + c.ep * 0.5 + c.sp * 0.1 + c.cp * 0.01).toFixed(2),
  );
}

/**
 * Canonical loadout resolver (CC-203)
 * Unifies class equipment choices, background grants, custom inventory, and currency.
 */
export function resolveLoadout(
  input: CharacterCreationData | CreationDraft,
): ResolvedLoadout {
  // If input already has a populated loadout, preserve it
  if (
    'loadout' in input &&
    input.loadout &&
    (input.loadout.items?.length > 0 || input.loadout.totalValueGp > 0)
  ) {
    return input.loadout;
  }

  const allEquipment = loadEquipment();
  const itemsMap = new Map<string, ResolvedEquipmentItem>();
  const currency: ResolvedCurrency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  // Handle explicit starting currency if present on input
  if ('currency' in input && input.currency) {
    currency.cp += input.currency.cp || 0;
    currency.sp += input.currency.sp || 0;
    currency.ep += input.currency.ep || 0;
    currency.gp += input.currency.gp || 0;
    currency.pp += input.currency.pp || 0;
  }

  const addItem = (
    nameOrSlug: string,
    quantity: number,
    source: ResolvedEquipmentItem['source'],
    equippedDefault?: boolean,
  ) => {
    // Check for coin string (e.g. "14 gp", "5 sp", "10 ep")
    const coin = parseCoinString(nameOrSlug);
    if (coin) {
      currency[coin.denomination] += coin.amount * (quantity || 1);
      return;
    }

    const lowerName = nameOrSlug.toLowerCase().trim();

    // Check for pack expansion
    const revisedPacks: typeof PACK_EXPANSIONS = {
      "priest's pack": [
        { name: 'Backpack', quantity: 1 },
        { name: 'Blanket', quantity: 1 },
        { name: 'Holy Water', quantity: 1 },
        { name: 'Lamp', quantity: 1 },
        { name: 'Rations (1 day)', quantity: 7 },
        { name: 'Robe', quantity: 1 },
        { name: 'Tinderbox', quantity: 1 },
      ],
      "scholar's pack": [
        { name: 'Backpack', quantity: 1 },
        { name: 'Book', quantity: 1 },
        { name: 'Ink (1 ounce bottle)', quantity: 1 },
        { name: 'Ink Pen', quantity: 1 },
        { name: 'Lamp', quantity: 1 },
        { name: 'Oil (flask)', quantity: 10 },
        { name: 'Parchment (10 sheets)', quantity: 1 },
        { name: 'Tinderbox', quantity: 1 },
      ],
    };
    const pack =
      input.edition === '2024'
        ? revisedPacks[lowerName] || PACK_EXPANSIONS[lowerName]
        : PACK_EXPANSIONS[lowerName];
    if (pack) {
      pack.forEach((subItem) => {
        addItem(subItem.name, subItem.quantity * quantity, source, false);
      });
      return;
    }

    // Match against catalog equipment
    const matches = allEquipment.filter(
      (e) => e.slug === lowerName || e.name.toLowerCase() === lowerName,
    );
    const equip =
      matches.find((e) => String(e.year) === input.edition) || matches[0];

    const slug = equip?.slug || lowerName.replace(/\s+/g, '-');
    const name = equip ? equip.name : nameOrSlug;

    let slot: ResolvedEquipmentItem['slot'] = undefined;
    let armorType: ResolvedEquipmentItem['armorType'] = undefined;
    let ac: number | undefined = undefined;

    if (equip) {
      if (equip.armor_category === 'Shield') {
        slot = 'shield';
        armorType = 'shield';
        ac = 2;
      } else if (equip.armor_category) {
        slot = 'armor';
        armorType =
          equip.armor_category.toLowerCase() as ResolvedEquipmentItem['armorType'];
        ac = equip.armor_class?.base;
      } else if (equip.weapon_range || equip.weapon_category) {
        slot = equip.properties?.some(
          (property) => property.index === 'two-handed',
        )
          ? 'two_handed'
          : 'main_hand';
      }
    }

    const equipped =
      equippedDefault !== undefined
        ? equippedDefault
        : !!slot &&
          !Array.from(itemsMap.values()).some(
            (item) =>
              item.equipped &&
              (item.slot === slot ||
                (['main_hand', 'two_handed', 'shield'].includes(slot || '') &&
                  ['main_hand', 'two_handed', 'shield'].includes(
                    item.slot || '',
                  ) &&
                  (item.slot === 'two_handed' ||
                    slot === 'two_handed' ||
                    (item.slot === 'main_hand' && slot === 'main_hand')))),
          );

    if (itemsMap.has(slug)) {
      const existing = itemsMap.get(slug)!;
      existing.quantity += quantity;
      if (equipped && !existing.equipped) {
        existing.equipped = true;
      }
    } else {
      itemsMap.set(slug, {
        id: `loadout-${itemsMap.size + 1}`,
        slug,
        name,
        quantity,
        equipped,
        slot,
        armorType,
        ac,
        stealthDisadvantage: equip?.stealth_disadvantage,
        source,
      });
    }
  };

  // 1. Process Class Equipment Choices (if CharacterCreationData)
  if (
    'equipmentChoices' in input &&
    !input.loadoutResolved &&
    input.equipmentChoices
  ) {
    input.equipmentChoices.forEach((choice) => {
      if (choice.selected !== null && choice.selected !== undefined) {
        const option = choice.options[choice.selected];
        if (Array.isArray(option)) {
          option.forEach((item) => {
            addItem(item.name, item.quantity || 1, 'class');
          });
        }
      }
    });
  }

  // 2. Process Background Equipment
  const bgSlug =
    'backgroundSlug' in input
      ? input.backgroundSlug
      : (input as CharacterCreationData).background;
  if (bgSlug && !('loadoutResolved' in input && input.loadoutResolved)) {
    const bg = BACKGROUNDS.find(
      (b) =>
        b.edition === input.edition &&
        (b.slug === bgSlug ||
          b.slug === `${bgSlug}-${input.edition}` ||
          b.name.toLowerCase() === bgSlug.toLowerCase()),
    );

    if ('equipmentChoice' in input && input.equipmentChoice === 'gold') {
      currency.gp += input.equipmentGold ?? 50;
    } else if (bg?.equipment) {
      const bgItems = Array.isArray(bg.equipment)
        ? bg.equipment
        : [bg.equipment];
      bgItems.forEach((itemStr) => {
        addItem(itemStr, 1, 'background', false);
      });
    }
  }

  // 3. Process Custom startingInventory if passed
  if ('startingInventory' in input && input.startingInventory) {
    input.startingInventory.forEach((item) => {
      addItem(item.equipmentSlug, item.quantity || 1, 'custom', item.equipped);
    });
  }

  // 4. If CreationDraft already has loadout items, merge them
  if ('loadout' in input && input.loadout?.items) {
    input.loadout.items.forEach((item) => {
      addItem(item.slug, item.quantity, item.source, item.equipped);
    });
  }

  const items = Array.from(itemsMap.values());
  const totalValueGp = calculateTotalCurrencyGp(currency);

  return {
    items,
    currency,
    totalValueGp,
  };
}
