import { QuickStartPresets } from '../types/equipment';

export const quickStartEquipmentPresets: QuickStartPresets = {
  classes: {
    barbarian: {
      label: "Barbarian Standard Loadout",
      items: [
        { equipmentSlug: "greataxe", quantity: 1, equipped: true, slot: "two_handed" },
        { equipmentSlug: "handaxe", quantity: 2, equipped: true, slot: "belt" },
        { equipmentSlug: "explorers-pack", quantity: 1 },
        { equipmentSlug: "javelin", quantity: 4 }
      ]
    },
    bard: {
      label: "Bard Standard Loadout",
      items: [
        { equipmentSlug: "rapier", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "diplomats-pack", quantity: 1 },
        { equipmentSlug: "lute", quantity: 1 },
        { equipmentSlug: "leather-armor", quantity: 1, equipped: true, slot: "armor" },
        { equipmentSlug: "dagger", quantity: 1 }
      ]
    },
    cleric: {
      label: "Cleric Standard Loadout",
      items: [
        { equipmentSlug: "mace", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "scale-mail", quantity: 1, equipped: true, slot: "armor" },
        { equipmentSlug: "shield", quantity: 1, equipped: true, slot: "off_hand" },
        { equipmentSlug: "light-crossbow", quantity: 1 },
        { equipmentSlug: "crossbow-bolt", quantity: 20 },
        { equipmentSlug: "priests-pack", quantity: 1 },
        { equipmentSlug: "holy-symbol", quantity: 1 }
      ]
    },
    druid: {
      label: "Druid Standard Loadout",
      items: [
        { equipmentSlug: "leather-armor", quantity: 1, equipped: true, slot: "armor" },
        { equipmentSlug: "quarterstaff", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "druids-focus", quantity: 1 },
        { equipmentSlug: "explorers-pack", quantity: 1 },
        { equipmentSlug: "herbalism-kit", quantity: 1 }
      ]
    },
    fighter: {
      label: "Fighter Standard Loadout (Strength Tank)",
      items: [
        { equipmentSlug: "chain-mail", quantity: 1, equipped: true, slot: "armor" },
        { equipmentSlug: "longsword", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "shield", quantity: 1, equipped: true, slot: "off_hand" },
        { equipmentSlug: "light-crossbow", quantity: 1 },
        { equipmentSlug: "crossbow-bolt", quantity: 20 },
        { equipmentSlug: "dungeoneers-pack", quantity: 1 }
      ]
    },
    monk: {
      label: "Monk Standard Loadout",
      items: [
        { equipmentSlug: "shortsword", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "dungeoneers-pack", quantity: 1 },
        { equipmentSlug: "dart", quantity: 10 }
      ]
    },
    paladin: {
      label: "Paladin Standard Loadout",
      items: [
        { equipmentSlug: "longsword", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "shield", quantity: 1, equipped: true, slot: "off_hand" },
        { equipmentSlug: "javelin", quantity: 5 },
        { equipmentSlug: "priests-pack", quantity: 1 },
        { equipmentSlug: "chain-mail", quantity: 1, equipped: true, slot: "armor" },
        { equipmentSlug: "holy-symbol", quantity: 1 }
      ]
    },
    ranger: {
      label: "Ranger Standard Loadout",
      items: [
        { equipmentSlug: "longbow", quantity: 1, equipped: true, slot: "two_handed" },
        { equipmentSlug: "arrow", quantity: 20 },
        { equipmentSlug: "shortsword", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "leather-armor", quantity: 1, equipped: true, slot: "armor" },
        { equipmentSlug: "dungeoneers-pack", quantity: 1 },
        { equipmentSlug: "explorers-pack", quantity: 1 }
      ]
    },
    rogue: {
      label: "Rogue Standard Loadout",
      items: [
        { equipmentSlug: "rapier", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "shortbow", quantity: 1 },
        { equipmentSlug: "arrow", quantity: 20 },
        { equipmentSlug: "leather-armor", quantity: 1, equipped: true, slot: "armor" },
        { equipmentSlug: "dagger", quantity: 2, equipped: true, slot: "belt" },
        { equipmentSlug: "thieves-tools", quantity: 1 },
        { equipmentSlug: "burglars-pack", quantity: 1 }
      ]
    },
    sorcerer: {
      label: "Sorcerer Standard Loadout",
      items: [
        { equipmentSlug: "dagger", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "arcane-focus", quantity: 1 },
        { equipmentSlug: "dungeoneers-pack", quantity: 1 },
        { equipmentSlug: "dart", quantity: 10 }
      ]
    },
    warlock: {
      label: "Warlock Standard Loadout",
      items: [
        { equipmentSlug: "dagger", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "arcane-focus", quantity: 1 },
        { equipmentSlug: "scholars-pack", quantity: 1 },
        { equipmentSlug: "dagger", quantity: 1 },
        { equipmentSlug: "leather-armor", quantity: 1, equipped: true, slot: "armor" }
      ]
    },
    wizard: {
      label: "Wizard Standard Loadout",
      items: [
        { equipmentSlug: "quarterstaff", quantity: 1, equipped: true, slot: "main_hand" },
        { equipmentSlug: "spellbook", quantity: 1 },
        { equipmentSlug: "scholars-pack", quantity: 1 },
        { equipmentSlug: "arcane-focus", quantity: 1 }
      ]
    }
  },
  backgrounds: {
    acolyte: {
      label: "Acolyte Kit",
      items: [
        { equipmentSlug: "holy-symbol", quantity: 1 },
        { equipmentSlug: "prayer-book", quantity: 1 },
        { equipmentSlug: "stick-of-incense", quantity: 5 },
        { equipmentSlug: "vestments", quantity: 1 },
        { equipmentSlug: "common-clothes", quantity: 1 }
      ],
      currency: { gp: 15, sp: 0, cp: 0 }
    },
    criminal: {
      label: "Criminal Kit",
      items: [
        { equipmentSlug: "crowbar", quantity: 1 },
        { equipmentSlug: "dark-common-clothes", quantity: 1 }
      ],
      currency: { gp: 15, sp: 0, cp: 0 }
    },
    entertainer: {
      label: "Entertainer Kit",
      items: [
        { equipmentSlug: "musical-instrument", quantity: 1 },
        { equipmentSlug: "favor-of-an-admirer", quantity: 1 },
        { equipmentSlug: "costume", quantity: 1 },
        { equipmentSlug: "travelers-clothes", quantity: 1 }
      ],
      currency: { gp: 15, sp: 0, cp: 0 }
    },
    folk_hero: {
      label: "Folk Hero Kit",
      items: [
        { equipmentSlug: "artisans-tools", quantity: 1 },
        { equipmentSlug: "shovel", quantity: 1 },
        { equipmentSlug: "iron-pot", quantity: 1 },
        { equipmentSlug: "common-clothes", quantity: 1 },
        { equipmentSlug: "pouch", quantity: 1 }
      ],
      currency: { gp: 10, sp: 0, cp: 0 }
    },
    guild_artisan: {
      label: "Guild Artisan Kit",
      items: [
        { equipmentSlug: "artisans-tools", quantity: 1 },
        { equipmentSlug: "letter-of-introduction", quantity: 1 },
        { equipmentSlug: "travelers-clothes", quantity: 1 }
      ],
      currency: { gp: 15, sp: 0, cp: 0 }
    },
    hermit: {
      label: "Hermit Kit",
      items: [
        { equipmentSlug: "scroll-case-of-notes", quantity: 1 },
        { equipmentSlug: "winter-blanket", quantity: 1 },
        { equipmentSlug: "common-clothes", quantity: 1 },
        { equipmentSlug: "herbalism-kit", quantity: 1 }
      ],
      currency: { gp: 5, sp: 0, cp: 0 }
    },
    noble: {
      label: "Noble Kit",
      items: [
        { equipmentSlug: "fine-clothes", quantity: 1 },
        { equipmentSlug: "signet-ring", quantity: 1 },
        { equipmentSlug: "scroll-of-pedigree", quantity: 1 }
      ],
      currency: { gp: 25, sp: 0, cp: 0 }
    },
    outlander: {
      label: "Outlander Kit",
      items: [
        { equipmentSlug: "staff", quantity: 1 },
        { equipmentSlug: "hunting-trap", quantity: 1 },
        { equipmentSlug: "trophy-from-animal", quantity: 1 },
        { equipmentSlug: "travelers-clothes", quantity: 1 },
        { equipmentSlug: "pouch", quantity: 1 }
      ],
      currency: { gp: 10, sp: 0, cp: 0 }
    },
    sage: {
      label: "Sage Kit",
      items: [
        { equipmentSlug: "bottle-of-ink", quantity: 1 },
        { equipmentSlug: "quill", quantity: 1 },
        { equipmentSlug: "small-knife", quantity: 1 },
        { equipmentSlug: "letter-from-colleague", quantity: 1 },
        { equipmentSlug: "common-clothes", quantity: 1 }
      ],
      currency: { gp: 10, sp: 0, cp: 0 }
    },
    sailor: {
      label: "Sailor Kit",
      items: [
        { equipmentSlug: "belaying-pin", quantity: 1 },
        { equipmentSlug: "silk-rope", quantity: 1 },
        { equipmentSlug: "lucky-charm", quantity: 1 },
        { equipmentSlug: "common-clothes", quantity: 1 },
        { equipmentSlug: "pouch", quantity: 1 }
      ],
      currency: { gp: 10, sp: 0, cp: 0 }
    },
    soldier: {
      label: "Soldier Kit",
      items: [
        { equipmentSlug: "insignia-of-rank", quantity: 1 },
        { equipmentSlug: "trophy-from-fallen-enemy", quantity: 1 },
        { equipmentSlug: "bone-dice", quantity: 1 },
        { equipmentSlug: "common-clothes", quantity: 1 },
        { equipmentSlug: "pouch", quantity: 1 }
      ],
      currency: { gp: 10, sp: 0, cp: 0 }
    },
    urchin: {
      label: "Urchin Kit",
      items: [
        { equipmentSlug: "small-knife", quantity: 1 },
        { equipmentSlug: "map-of-home-city", quantity: 1 },
        { equipmentSlug: "pet-mouse", quantity: 1 },
        { equipmentSlug: "token-to-remember-parents", quantity: 1 },
        { equipmentSlug: "common-clothes", quantity: 1 },
        { equipmentSlug: "pouch", quantity: 1 }
      ],
      currency: { gp: 10, sp: 0, cp: 0 }
    }
  }
};