import type { Edition } from '../types/dnd';

/**
 * Player-facing text for species traits: what the trait does, and how to get
 * value from it at the table.
 *
 * Keyed by trait name without any parenthetical summary ("Darkvision (120 ft)"
 * looks up "Darkvision"). Where the 2014 and 2024 rules differ, the entry
 * holds one text per edition, because the same name can mean different things
 * (2024 Stonecunning is tremorsense, not a History bonus).
 *
 * Written in our own words from the rules; `speciesTraitText.test.ts` fails if
 * any species offered by the creator has a trait with no entry here.
 */
export interface SpeciesTraitText {
  /** What the trait does, in rules terms. */
  rules: string;
  /** How a player gets value from it. */
  tip: string;
}

type Entry = SpeciesTraitText | Partial<Record<Edition, SpeciesTraitText>>;

const isSplit = (entry: Entry): entry is Partial<Record<Edition, SpeciesTraitText>> =>
  !('rules' in entry);

/** Names the data uses for the same trait. */
const ALIASES: Record<string, string> = {
  Luck: 'Lucky',
  Nimbleness: 'Halfling Nimbleness',
};

const TRAITS: Record<string, Entry> = {
  // ── Senses and movement ────────────────────────────────────────────────
  Darkvision: {
    rules:
      'Out to {range}, you see in dim light as if it were bright light, and in darkness as if it were dim light. In darkness you see shades of gray, not color.',
    tip: 'Dungeons, caves and night travel need no torch for you, so you can scout ahead without a light giving you away. Magical darkness still blinds you, and dim light gives disadvantage on Perception checks that rely on sight.',
  },
  Speed: {
    rules: 'Your base walking speed is 35 feet, 5 feet faster than most species.',
    tip: 'The extra 5 feet lets you reach an enemy, a doorway or cover that would otherwise be one square too far, and helps you stay out of reach of slower foes.',
  },
  Flight: {
    rules:
      'You have a flying speed equal to your walking speed. You cannot use it while wearing medium or heavy armor.',
    tip: 'Fly over pits, walls and difficult terrain, reach high ledges, or stay out of reach of melee-only enemies. Stick to light armor or none, and remember a fall from height still hurts if you are knocked prone or lose your speed.',
  },
  Amphibious: {
    rules: 'You can breathe both air and water.',
    tip: 'Underwater areas are open to you without spells or held breath, so you can scout, retrieve items or escape through water routes.',
  },
  'Halfling Nimbleness': {
    rules:
      'You can move through the space of any creature that is at least one size larger than you. You cannot end your move there.',
    tip: 'Slip past a blocking enemy to reach the caster behind it, or walk through a crowded front line to get into position.',
  },
  'Naturally Stealthy': {
    '2014': {
      rules:
        'You can try to hide even when you are obscured only by a creature at least one size larger than you.',
      tip: 'Stand behind a larger ally and hide every round. Pairs well with a Rogue\'s Cunning Action.',
    },
    '2024': {
      rules:
        'You can take the Hide action even when the only thing obscuring you is a creature at least one size larger than you.',
      tip: 'Stand behind a larger ally and hide every round. Pairs well with a Rogue\'s Cunning Action.',
    },
  },
  'Feline Agility': {
    rules:
      'When you move on your turn, you can double your speed until the end of that turn. You cannot do it again until you spend a turn moving 0 feet.',
    tip: 'Save it for when distance matters: closing on a fleeing enemy, reaching a downed ally, or escaping. Then stand still for one turn (attacking or casting in place) to recharge it.',
  },
  'Rabbit Hop': {
    rules:
      'As a bonus action, you jump a number of feet equal to five times your proficiency bonus without provoking opportunity attacks. You can do this a number of times equal to your proficiency bonus per long rest, and not while heavy armor reduces your speed.',
    tip: 'A free escape: hop out of melee without spending your action on Disengage, or clear a gap or obstacle in one bound.',
  },

  // ── Defenses ───────────────────────────────────────────────────────────
  'Fey Ancestry': {
    '2014': {
      rules:
        'You have advantage on saving throws against being charmed, and magic cannot put you to sleep.',
      tip: 'Enchanters, vampires and Sleep spells have a much harder time taking you out of a fight, so you are often the one left standing to wake or protect the party.',
    },
    '2024': {
      rules: 'You have advantage on saving throws to avoid or end the Charmed condition.',
      tip: 'Charm effects are less likely to turn you against your friends, which makes you a good choice to face an enchanter or fey creature.',
    },
  },
  Brave: {
    '2014': {
      rules: 'You have advantage on saving throws against being frightened.',
      tip: 'Dragons, undead and fear spells are less likely to stop you from acting or force you to run.',
    },
    '2024': {
      rules: 'You have advantage on saving throws to avoid or end the Frightened condition.',
      tip: 'Dragons, undead and fear spells are less likely to stop you from acting, and you shake off fear faster when they do land.',
    },
  },
  Lucky: {
    '2014': {
      rules:
        'When you roll a 1 on the d20 for an attack roll, ability check or saving throw, you can reroll the die and must use the new roll.',
      tip: 'It works automatically, so just remember to reroll every natural 1. It quietly removes the worst outcomes from your game.',
    },
    '2024': {
      rules:
        'When you roll a 1 on the d20 of a D20 Test (attack roll, ability check or saving throw), you can reroll the die and must use the new roll.',
      tip: 'It works automatically, so just remember to reroll every natural 1. It quietly removes the worst outcomes from your game.',
    },
  },
  'Dwarven Resilience': {
    '2014': {
      rules:
        'You have advantage on saving throws against poison, and resistance to poison damage.',
      tip: 'Poison is one of the most common damage types from monsters and traps, so you take half from it and rarely end up poisoned. Good for the character who tastes the suspicious drink.',
    },
    '2024': {
      rules:
        'You have resistance to poison damage, and advantage on saving throws to avoid or end the Poisoned condition.',
      tip: 'Poison is one of the most common damage types from monsters and traps, so you take half from it and rarely stay poisoned for long.',
    },
  },
  'Dwarven Toughness': {
    rules: 'Your hit point maximum increases by 1, and by 1 again every time you gain a level.',
    tip: 'Nothing to activate: you simply have more hit points than other characters of your class, which adds up to 20 extra at level 20.',
  },
  'Gnome Cunning': {
    rules:
      'You have advantage on Intelligence, Wisdom and Charisma saving throws against magic.',
    tip: 'Most spells that control your mind or banish you call for these saves, so you are hard to charm, confuse or send away.',
  },
  'Gnomish Cunning': {
    rules: 'You have advantage on Intelligence, Wisdom and Charisma saving throws.',
    tip: 'These saves resist charm, fear, illusion and banishment effects, so your character keeps acting when others lose control.',
  },
  'Celestial Resistance': {
    rules: 'You have resistance to necrotic damage and radiant damage.',
    tip: 'You take half damage from undead attacks, life-draining spells and holy light, which makes you sturdy against undead and fiends.',
  },
  'Damage Resistance': {
    rules: 'You have resistance to the damage type of your draconic ancestry.',
    tip: 'Fire and poison are the damage types you will face most often, so resistance to either pays off in nearly every campaign. Cold and lightning come next.',
  },
  'Hellish Resistance': {
    rules: 'You have resistance to fire damage.',
    tip: 'Fire is one of the most common damage types, from Fireball to dragon breath, so you take half of it.',
  },
  'Fire Resistance': {
    rules: 'You have resistance to fire damage.',
    tip: 'Fire is one of the most common damage types, from Fireball to dragon breath, so you take half of it.',
  },
  'Elemental Resistance': {
    rules:
      'You have resistance to one damage type set by your element: lightning for air, acid for water, fire for fire. Earth genasi gain other benefits instead.',
    tip: 'Choose the element that fits your character, then lean into fights against creatures of that type.',
  },
  'Guardians of the Depths': {
    rules:
      'You have resistance to cold damage, and you ignore the drawbacks of a deep underwater environment.',
    tip: 'Cold is common from frost creatures and spells, and you can dive to any depth without pressure or cold penalties.',
  },
  'Poison Immunity': {
    rules: 'You are immune to poison damage and the poisoned condition.',
    tip: 'Poison simply does not affect you, so you can wade through poison clouds and laugh off venomous bites.',
  },
  'Magic Resistance': {
    rules: 'You have advantage on saving throws against spells and other magical effects.',
    tip: 'One of the strongest defenses in the game. Fireballs, charms and curses all have a harder time affecting you.',
  },
  'Loxodon Serenity': {
    rules: 'You have advantage on saving throws against being charmed or frightened.',
    tip: 'Fear and charm effects are less likely to stop you from acting or turn you against friends.',
  },
  'Natural Armor': {
    rules:
      'Without armor, your AC is 12 + your Dexterity modifier. You can use this instead of worn armor if it gives a higher AC, and a shield still adds to it.',
    tip: 'Useful for classes without armor training (Wizard, Sorcerer) since you start with better AC for free. Classes with heavy armor will rarely use it.',
  },
  'Sunlight Sensitivity': {
    rules:
      'You have disadvantage on attack rolls and on sight-based Perception checks when you, your target or what you are looking at is in direct sunlight.',
    tip: 'A drawback. Fight from shade or under cover when you can, favor spells that call for saving throws over attack rolls outdoors, and let allies take the lookout role by day.',
  },
  'Relentless Endurance': {
    rules:
      'When you drop to 0 hit points but are not killed outright, you can drop to 1 hit point instead. Once used, it returns after a long rest.',
    tip: 'A free second chance once per day. Use the extra turn to retreat, drink a potion, or land one more hit.',
  },
  'Saving Face': {
    rules:
      'When you miss with an attack roll or fail an ability check or saving throw, you can add a bonus to the roll equal to the number of allies you can see within 30 feet (maximum +5). You regain it after a short or long rest.',
    tip: 'Save it for a failed roll that really matters, such as a save against a deadly spell. It is strongest in a big party.',
  },

  // ── Combat ─────────────────────────────────────────────────────────────
  'Savage Attacks': {
    rules:
      'When you score a critical hit with a melee weapon attack, roll one of the weapon\'s damage dice one more time and add it to the critical damage.',
    tip: 'Best with big-dice weapons such as a greataxe (d12) or greatsword, and with classes that crit often, like a Champion Fighter.',
  },
  'Breath Weapon': {
    '2014': {
      rules:
        'As an action, exhale energy of your ancestry\'s damage type in the area set by your ancestry. Each creature in it makes a saving throw (DC 8 + your Constitution modifier + your proficiency bonus), taking 2d6 damage on a failure or half on a success. The damage rises to 3d6 at level 6, 4d6 at 11 and 5d6 at 16. You regain it after a short or long rest.',
      tip: 'Aim it to catch several enemies at once, ideally while they are bunched up near a doorway. It costs your action, so it pays off most against groups.',
    },
    '2024': {
      rules:
        'When you take the Attack action, you can replace one attack with a breath of your ancestry\'s damage type, in a 15-foot cone or a 30-foot line 5 feet wide. Each creature in the area makes a Dexterity save (DC 8 + your Constitution modifier + your proficiency bonus), taking 1d10 damage on a failure or half on a success. Damage rises to 2d10 at level 5, 3d10 at 11 and 4d10 at 17. You can use it a number of times equal to your proficiency bonus per long rest.',
      tip: 'Because it replaces only one attack, you can breathe and still swing a weapon if you have Extra Attack. Use the line to hit enemies standing in a corridor, and the cone when they are bunched in front of you.',
    },
  },
  'Draconic Cry': {
    rules:
      'As a bonus action, you let out a cry at enemies within 10 feet. Until the start of your next turn, you and your allies have advantage on attack rolls against any of those enemies who can hear you. You can do this a number of times equal to your proficiency bonus per long rest.',
    tip: 'Use it when several allies are about to attack the same enemies, especially a Rogue who needs advantage for Sneak Attack.',
  },
  'Pack Tactics': {
    rules:
      'You have advantage on attack rolls against a creature if at least one of your allies is within 5 feet of it and is not incapacitated.',
    tip: 'Attack whatever your melee allies are fighting. Constant advantage makes this excellent for archers and Rogues.',
  },
  'Grovel, Cower, and Beg': {
    rules:
      'As an action, you cower pathetically. Until the end of your next turn, your allies have advantage on attack rolls against enemies within 10 feet of you that can see you. You regain it after a short or long rest.',
    tip: 'It costs your own attack, so use it when several allies will attack enemies near you this round.',
  },
  'Surprise Attack': {
    rules:
      'If you surprise a creature and hit it with an attack on your first turn in combat, the attack deals an extra 2d6 damage. Once per combat.',
    tip: 'Scout ahead stealthily and open fights from hiding. Works well alongside Sneaky.',
  },
  'Fury of the Small': {
    rules:
      'When you damage a creature larger than you with an attack or a spell, you can add extra damage equal to your level. You regain it after a short or long rest.',
    tip: 'Most monsters are bigger than you, so it applies often. Save it for a hit you are sure of, or to finish a big enemy.',
  },
  'Nimble Escape': {
    rules: 'You can take the Disengage or Hide action as a bonus action on each of your turns.',
    tip: 'Attack, then slip away without provoking opportunity attacks, or attack and hide again. Lets ranged characters and casters stay safe every turn.',
  },
  'Long-Limbed': {
    rules: 'When you make a melee attack on your turn, your reach is 5 feet greater than normal.',
    tip: 'Hit enemies from 10 feet away (15 with a reach weapon), so you can strike and stay out of their reach.',
  },
  "Cat's Claws": {
    rules:
      'You have a climbing speed of 20 feet, and your claws are natural weapons that deal 1d4 + your Strength modifier slashing damage on an unarmed strike.',
    tip: 'Climb walls and trees without a check, and you always have a weapon even when disarmed. Monks get the most from the claws.',
  },
  Trunk: {
    rules:
      'Your trunk can grasp objects, works as a snorkel, has a 5-foot reach, and can lift five times your Strength score in pounds. It cannot wield weapons or shields or do fine work.',
    tip: 'Keep a hand free in practice: open doors, carry objects or grab a creature while both hands hold weapons or a spell focus.',
  },
  'Martial Training': {
    rules: 'You are proficient with two martial weapons of your choice and with light armor.',
    tip: 'Lets a Wizard or Sorcerer wear light armor and wield a longbow or rapier without spending a feat.',
  },
  'Martial Prodigy': {
    rules:
      'You are proficient with light and medium armor and with shortswords, longswords and greatswords.',
    tip: 'Gives casters real armor and swords for free, making a Githyanki Wizard far sturdier than most.',
  },
  'Dwarven Combat Training': {
    rules:
      'You are proficient with the battleaxe, handaxe, light hammer and warhammer.',
    tip: 'Lets a dwarven Cleric or Wizard use a solid weapon. Matters most for classes without martial weapon training.',
  },
  'Adrenaline Rush': {
    rules:
      'You can take the Dash action as a bonus action. When you do, you gain temporary hit points equal to your proficiency bonus. You can use it a number of times equal to your proficiency bonus per short or long rest.',
    tip: 'Close the distance to an enemy and still attack this turn, or escape a bad spot with a small cushion of hit points.',
  },
  'Healing Hands': {
    '2014': {
      rules:
        'As an action, you touch a creature and it regains hit points equal to your level. You regain it after a long rest.',
      tip: 'Bring a fallen ally back to their feet in an emergency, even if your class has no healing.',
    },
    '2024': {
      rules:
        'As a Magic action, you touch a creature, roll a number of d4s equal to your proficiency bonus, and the creature regains that many hit points. You regain it after a long rest.',
      tip: 'Bring a fallen ally back to their feet in an emergency, even if your class has no healing.',
    },
  },
  'Celestial Revelation': {
    rules:
      'From level 3, as a bonus action, you transform for 1 minute, once per long rest. Choose each time: Heavenly Wings (a flying speed equal to your speed), Inner Radiance (you shed light, and each creature within 10 feet takes radiant damage equal to your proficiency bonus at the end of each of your turns) or Necrotic Shroud (creatures within 10 feet must make a Charisma save or be frightened of you until the end of your next turn). While transformed, once per turn you can add extra damage equal to your proficiency bonus to one target.',
    tip: 'Transform at the start of a hard fight. Wings suit ranged characters, Radiance suits melee characters surrounded by enemies, and Shroud sets up your allies\' attacks.',
  },
  'Giant Ancestry': {
    rules:
      'Choose one giant ancestry. You can use its benefit a number of times equal to your proficiency bonus per long rest: Cloud\'s Jaunt (bonus action, teleport 30 feet), Fire\'s Burn (+1d10 fire damage when you hit), Frost\'s Chill (+1d6 cold damage when you hit and the target\'s speed drops by 10 feet), Hill\'s Tumble (knock a Large or smaller target you hit prone), Stone\'s Endurance (reaction, reduce damage you take by 1d12 + your Constitution modifier) or Storm\'s Thunder (reaction, deal 1d8 thunder damage to a creature within 60 feet that damaged you).',
    tip: 'Pick for your role: Hill or Fire for melee damage, Stone for a tank, Cloud to escape or reposition, Frost to stop enemies from fleeing or reaching your casters.',
  },
  'Large Form': {
    rules:
      'From level 5, as a bonus action, you become Large for 10 minutes if there is room. You have advantage on Strength checks and your speed increases by 10 feet. You regain it after a long rest.',
    tip: 'Use it at the start of a big fight. Being Large lets you grapple and shove bigger creatures, and the extra speed gets you into position.',
  },
  'Draconic Flight': {
    rules:
      'From level 5, as a bonus action, you sprout spectral wings for 10 minutes and gain a flying speed equal to your walking speed. You regain it after a long rest.',
    tip: 'Use it to cross a chasm, reach a flying enemy, or line up your Breath Weapon over a group of enemies.',
  },
  'Powerful Build': {
    '2014': {
      rules:
        'You count as one size larger when working out your carrying capacity and the weight you can push, drag or lift.',
      tip: 'Carry heavy armor, loot and gear without being slowed. Useful for the party\'s pack mule.',
    },
    '2024': {
      rules:
        'You have advantage on ability checks to end the Grappled condition, and you count as one size larger for your carrying capacity.',
      tip: 'Hard to pin down, so grappling monsters struggle to hold you. You can also carry far more gear than others.',
    },
  },
  'Hidden Step': {
    rules:
      'As a bonus action, you turn invisible until the start of your next turn, or until you attack, deal damage or force a saving throw. You regain it after a short or long rest.',
    tip: 'Turn invisible before you attack to gain advantage on that attack, or vanish to escape when surrounded.',
  },
  'Lucky Footwork': {
    rules:
      'When you fail a Dexterity saving throw, you can use your reaction to roll a d4 and add it to the result. Not usable while prone or at speed 0.',
    tip: 'Turns many failed saves against fireballs, traps and breath weapons into successes.',
  },
  'Hare-Trigger': {
    rules: 'You add your proficiency bonus to your initiative rolls.',
    tip: 'You usually act first, so you can control a fight early: cast your best spell or strike before enemies move.',
  },

  // ── Skills and proficiencies ───────────────────────────────────────────
  'Keen Senses': {
    '2014': {
      rules: 'You are proficient in the Perception skill.',
      tip: 'Perception is the most rolled skill in the game. You notice ambushes, traps and hidden doors more often.',
    },
    '2024': {
      rules: 'You are proficient in one skill of your choice: Insight, Perception or Survival.',
      tip: 'Perception is the most rolled skill in the game and the safest pick. Choose Insight for a social character or Survival for a wilderness guide.',
    },
  },
  'Skill Versatility': {
    rules: 'You gain proficiency in two skills of your choice.',
    tip: 'Fill gaps in the party, such as Perception, Stealth or Persuasion, or double down on what your class already does well.',
  },
  Skillful: {
    rules: 'You gain proficiency in one skill of your choice.',
    tip: 'Perception is a strong default. Otherwise pick a skill nobody else in the party has.',
  },
  Menacing: {
    rules: 'You are proficient in the Intimidation skill.',
    tip: 'Makes you the one who scares answers out of prisoners or convinces enemies to back down.',
  },
  Sneaky: {
    rules: 'You are proficient in the Stealth skill.',
    tip: 'Scout ahead or set up surprise attacks. Pairs well with Surprise Attack.',
  },
  'Silent Feathers': {
    rules: 'You are proficient in the Stealth skill.',
    tip: 'Scout ahead quietly, especially from above with your flight.',
  },
  "Cat's Talent": {
    rules: 'You are proficient in the Perception and Stealth skills.',
    tip: 'Two of the most used skills in the game, making you a natural scout.',
  },
  'Leporine Senses': {
    rules: 'You are proficient in the Perception skill.',
    tip: 'Perception is the most rolled skill in the game. You notice ambushes, traps and hidden doors more often.',
  },
  'Kenku Training': {
    rules:
      'You are proficient in two of these skills of your choice: Acrobatics, Deception, Stealth or Sleight of Hand.',
    tip: 'Stealth plus Sleight of Hand makes a strong thief. Deception supports a con artist.',
  },
  'Decadent Mastery': {
    rules:
      'You learn one language and one tool of your choice, and gain proficiency in one of Arcana, History, Performance or Persuasion.',
    tip: 'Pick a skill your party lacks. A tool such as thieves\' tools or an herbalism kit can open whole kinds of problem-solving.',
  },
  'Tool Proficiency': {
    rules:
      'You are proficient with one set of artisan\'s tools of your choice: smith\'s tools, brewer\'s supplies or mason\'s tools.',
    tip: 'Smith\'s tools let you repair and craft arms and armor during downtime. Mason\'s tools help you understand stonework and traps.',
  },
  Stonecunning: {
    '2014': {
      rules:
        'On Intelligence (History) checks about the origin of stonework, you count as proficient and add double your proficiency bonus.',
      tip: 'Ask the DM about stonework you find: who built it, how old it is, whether it hides a trap. You will usually get a good answer.',
    },
    '2024': {
      rules:
        'As a bonus action, you gain tremorsense out to 60 feet for 10 minutes while standing on or touching stone. You can use it a number of times equal to your proficiency bonus per long rest.',
      tip: 'Sense creatures through stone walls and floors in dungeons and caves, including invisible or hidden ones, before they reach you.',
    },
  },
  'Expert Forgery': {
    rules:
      'You can copy another creature\'s handwriting and craftwork, with advantage on checks to produce forgeries or duplicates of existing objects.',
    tip: 'Forge letters, seals and papers to get past guards or plant false orders.',
  },
  Mimicry: {
    rules:
      'You can mimic sounds you have heard, including voices. A listener can tell it is an imitation with a Wisdom (Insight) check against your Charisma (Deception).',
    tip: 'Imitate a guard\'s voice to give orders, lure enemies away with a sound, or communicate in voices you have collected.',
  },
  'Speech of Beast and Leaf': {
    rules:
      'Beasts and plants can understand the meaning of your words, though you cannot understand them in return. You have advantage on Charisma checks to influence them.',
    tip: 'Calm a guard dog, convince a horse to cooperate, or ask a tree to let you pass.',
  },
  'Emissary of the Sea': {
    rules:
      'You can communicate simple ideas to beasts that can breathe water. They understand the meaning of your words, though you have no special ability to understand them in return.',
    tip: 'Ask fish or sea creatures what they have seen, or win their help near water.',
  },

  // ── Magic ──────────────────────────────────────────────────────────────
  'Light Bearer': {
    rules: 'You know the Light cantrip. Charisma is your spellcasting ability for it.',
    tip: 'Light a dungeon without a torch, and keep a free hand. Cast it on a stone and throw it to light a distant room.',
  },
  'Otherworldly Presence': {
    rules:
      'You know the Thaumaturgy cantrip, using the same spellcasting ability as your Fiendish Legacy.',
    tip: 'Boom your voice, rattle doors and flicker flames to intimidate people or put on a show.',
  },
  'Fiendish Legacy': {
    rules:
      'Choose a legacy. Abyssal: poison resistance and Poison Spray; Ray of Sickness at level 3, Hold Person at level 5. Chthonic: necrotic resistance and Chill Touch; False Life at level 3, Ray of Enfeeblement at level 5. Infernal: fire resistance and Fire Bolt; Hellish Rebuke at level 3, Darkness at level 5. You can cast each leveled spell once per long rest without a spell slot. Your spellcasting ability is Intelligence, Wisdom or Charisma, chosen when you pick the legacy.',
    tip: 'Infernal gives the most useful attack cantrip (Fire Bolt) and resistance to the most common damage type. Abyssal\'s Hold Person is excellent control. Match the spellcasting ability to your class\'s main stat.',
  },
  'Infernal Legacy': {
    rules:
      'You know the Thaumaturgy cantrip. At level 3 you can cast Hellish Rebuke as a 2nd-level spell, and at level 5 Darkness, each once per long rest. Charisma is your spellcasting ability for them.',
    tip: 'Hellish Rebuke punishes whoever hits you. Darkness blocks enemy archers and casters, but pair it with a Warlock\'s Devil\'s Sight or allies will be blinded too.',
  },
  'Elven Lineage': {
    rules:
      'Choose a lineage. Drow: darkvision 120 feet and Dancing Lights; Faerie Fire at level 3, Darkness at level 5. High Elf: Prestidigitation (you can swap it for another Wizard cantrip after a long rest); Detect Magic at level 3, Misty Step at level 5. Wood Elf: speed 35 feet and Druidcraft; Longstrider at level 3, Pass without Trace at level 5. You can cast each leveled spell once per long rest without a spell slot. Your spellcasting ability is Intelligence, Wisdom or Charisma, chosen when you pick the lineage.',
    tip: 'High Elf gives Misty Step, one of the best escapes in the game. Wood Elf makes the whole party stealthy with Pass without Trace. Drow\'s Faerie Fire gives your allies advantage on attacks.',
  },
  'Gnomish Lineage': {
    rules:
      'Choose a lineage. Forest Gnome: the Minor Illusion cantrip, and Speak with Animals always prepared, castable without a slot a number of times equal to your proficiency bonus per long rest. Rock Gnome: the Mending and Prestidigitation cantrips, and you can spend 10 minutes to build a Tiny clockwork device (up to three at once) such as a fire starter or a music box. Your spellcasting ability is Intelligence, Wisdom or Charisma.',
    tip: 'Minor Illusion is one of the most creative cantrips: make a fake wall to hide behind or a noise to distract guards. Rock Gnome devices are great for distractions and roleplay.',
  },
  'Firbolg Magic': {
    rules:
      'You can cast Detect Magic and Disguise Self with this trait, each once per long rest, using Wisdom as your spellcasting ability.',
    tip: 'Disguise Self gets you into places as someone else. Detect Magic finds hidden magic items and traps.',
  },
  'Innate Spellcasting': {
    rules:
      'You know the Poison Spray cantrip and can cast Animal Friendship on snakes at will. From level 3 you can cast Suggestion once per long rest. Charisma is your spellcasting ability.',
    tip: 'Suggestion can end a fight or a negotiation with one sentence. Keep the request short and reasonable-sounding.',
  },
  'Fairy Magic': {
    rules:
      'You know the Druidcraft cantrip. From level 3 you can cast Faerie Fire, and from level 5 Enlarge/Reduce, each once per long rest without a spell slot. Your spellcasting ability is Intelligence, Wisdom or Charisma.',
    tip: 'Faerie Fire reveals invisible enemies and gives allies advantage. Enlarge a frontline ally or shrink a dangerous foe.',
  },
  'Githyanki Psionics': {
    rules:
      'You know the Mage Hand cantrip, and the hand is invisible. From level 3 you can cast Jump, and from level 5 Misty Step, each once per long rest without a spell slot. Your spellcasting ability is Intelligence, Wisdom or Charisma.',
    tip: 'An invisible Mage Hand can pick pockets and open things unseen. Misty Step is one of the best escapes in the game.',
  },
  'Control Air and Water': {
    rules:
      'You can cast Fog Cloud, from level 3 Gust of Wind, and from level 5 Wall of Water, each once per long rest. Charisma is your spellcasting ability.',
    tip: 'Fog Cloud blocks enemy archers and casters, or covers a retreat.',
  },
  'Reach to the Blaze': {
    rules:
      'You know the Produce Flame cantrip. From level 3 you can cast Burning Hands once per long rest. Constitution is your spellcasting ability.',
    tip: 'Produce Flame gives you light and a ranged attack, and Burning Hands clears groups of weak enemies.',
  },
  'Reach to the Element': {
    rules:
      'You know a cantrip tied to your element, and gain more spells at higher levels that you can cast once per long rest each. Air: Shocking Grasp, then Feather Fall (level 3) and Levitate (level 5). Earth: Blade Ward, then Pass without Trace (level 5). Fire: Produce Flame, then Burning Hands (level 3) and Flame Blade (level 5). Water: Acid Splash, then Create or Destroy Water (level 3) and Water Walk (level 5).',
    tip: 'Air gives mobility, Earth gives stealth for the party, Fire gives damage, Water gives utility. Pick for the role you want.',
  },

  // ── Humans ─────────────────────────────────────────────────────────────
  Resourceful: {
    rules: 'You gain Heroic Inspiration whenever you finish a long rest.',
    tip: 'Use it once a day to reroll any die. Spend it freely, since you get it back after every long rest.',
  },
  Versatile: {
    rules: 'You gain an Origin feat of your choice. Skilled is recommended.',
    tip: 'Skilled gives three extra proficiencies. Alert is a strong pick for initiative, and Tough for hit points.',
  },

  // ── Rest ───────────────────────────────────────────────────────────────
  Trance: {
    '2014': {
      rules:
        'You do not need to sleep. Instead you meditate for 4 hours a day and gain the benefit a human gets from 8 hours of sleep.',
      tip: 'Take the long watch at night, since you are fully rested in half the time.',
    },
    '2024': {
      rules:
        'You do not need to sleep, and magic cannot put you to sleep. You can finish a long rest in 4 hours of trancelike meditation, staying conscious throughout.',
      tip: 'Take the night watch, since you are fully rested in half the time and still aware of your surroundings. Sleep spells cannot take you out.',
    },
  },

  // ── Ancestry choices ───────────────────────────────────────────────────
  'Draconic Ancestry': {
    rules:
      'Choose a kind of dragon. It sets the damage type of your Breath Weapon and your Damage Resistance (for example, red for fire, blue for lightning, white for cold, green for poison).',
    tip: 'Fire (red, gold, brass) and poison (green) give the resistances that come up most often. Every choice is viable, so the look you want is a fine reason too.',
  },
};

const baseName = (trait: string) => {
  const name = trait.replace(/\s*\(.*\)\s*$/, '').trim();
  return ALIASES[name] ?? name;
};

/**
 * Text for a species trait, or `null` when we have none.
 *
 * `detailedTraits` are the species' parenthetical traits ("Darkvision
 * (120 ft)"), used to fill in a range the bare name does not carry.
 */
export function getSpeciesTraitText(
  trait: string,
  edition: Edition,
  detailedTraits: readonly string[] = [],
): SpeciesTraitText | null {
  const name = baseName(trait);
  const entry = TRAITS[name];
  if (!entry) return null;
  const text = isSplit(entry) ? (entry[edition] ?? entry['2024'] ?? entry['2014']) : entry;
  if (!text) return null;

  if (!text.rules.includes('{range}')) return text;
  const detail = [trait, ...detailedTraits].find(
    (candidate) => baseName(candidate) === name && /\d+\s*ft/.test(candidate),
  );
  const feet = detail?.match(/(\d+)\s*ft/)?.[1] ?? '60';
  return { ...text, rules: text.rules.replace('{range}', `${feet} feet`) };
}
