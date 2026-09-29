import { CandidatePage } from '../../candidates';

// Layout-stage pages in the shape ocr-service /layout/s3 returns, built from
// SRD 5.1 content (CC-BY-4.0). The Gorgon stat block starts in the right
// column of page 12 and continues on page 13 below a running header, the case
// the continuation merge exists for.

export const GORGON_PAGE_12: CandidatePage = {
  pageNumber: 12,
  markdown: '',
  blocks: [
    { id: 'p12-b0', class: 'furniture', markerType: 'PageHeader', bbox: [0.05, 0.01, 0.95, 0.03] },
    { id: 'p12-b1', class: 'heading', markerType: 'SectionHeader', bbox: [0.06, 0.06, 0.45, 0.09], markdown: '## Gorgons' },
    {
      id: 'p12-b2',
      class: 'body',
      markerType: 'Text',
      bbox: [0.06, 0.1, 0.45, 0.6],
      markdown: 'Covered in plates of iron, gorgons are bull-like creatures that roam wild lands.',
    },
    { id: 'p12-b3', class: 'art', markerType: 'Picture', bbox: [0.06, 0.62, 0.45, 0.95] },
    { id: 'p12-b4', class: 'heading', markerType: 'SectionHeader', bbox: [0.52, 0.06, 0.94, 0.09], markdown: '## Gorgon' },
    {
      id: 'p12-b5',
      class: 'body',
      markerType: 'Text',
      bbox: [0.52, 0.1, 0.94, 0.5],
      markdown: [
        '*Large monstrosity, unaligned*',
        '**Armor Class** 19 (natural armor)',
        '**Hit Points** 114 (12d10 + 48)',
        '**Speed** 40 ft.',
        '| STR | DEX | CON | INT | WIS | CHA |',
        '|---|---|---|---|---|---|',
        '| 20 (+5) | 11 (+0) | 18 (+4) | 2 (−4) | 12 (+1) | 7 (−2) |',
        '**Skills** Perception +4',
        '**Condition Immunities** petrified',
        '**Senses** darkvision 60 ft., passive Perception 14',
        '**Languages** —',
        '**Challenge** 5 (1,800 XP)',
        '***Trample.*** If the gorgon moves at least 20 feet straight toward a creature and then hits it with a gore attack on the same turn, that target must succeed on a DC 16 Strength saving throw or be knocked prone.',
      ].join('\n\n'),
    },
    { id: 'p12-b6', class: 'furniture', markerType: 'PageFooter', bbox: [0.45, 0.96, 0.55, 0.98] },
  ],
};

export const GORGON_PAGE_13: CandidatePage = {
  pageNumber: 13,
  markdown: '',
  blocks: [
    { id: 'p13-b0', class: 'furniture', markerType: 'PageHeader', bbox: [0.05, 0.01, 0.95, 0.03] },
    { id: 'p13-b1', class: 'heading', markerType: 'SectionHeader', bbox: [0.06, 0.05, 0.45, 0.07], markdown: '### Actions' },
    {
      id: 'p13-b2',
      class: 'body',
      markerType: 'Text',
      bbox: [0.06, 0.08, 0.45, 0.4],
      markdown: [
        '***Gore.*** *Melee Weapon Attack:* +8 to hit, reach 5 ft., one target. *Hit:* 18 (2d12 + 5) piercing damage.',
        '***Hooves.*** *Melee Weapon Attack:* +8 to hit, reach 5 ft., one target. *Hit:* 16 (2d10 + 5) bludgeoning damage.',
        '***Petrifying Breath (Recharge 5–6).*** The gorgon exhales petrifying gas in a 30-foot cone. Each creature in that area must succeed on a DC 13 Constitution saving throw.',
      ].join('\n\n'),
    },
    {
      id: 'p13-b3',
      class: 'body',
      markerType: 'Text',
      bbox: [0.06, 0.42, 0.45, 0.6],
      markdown: 'Gorgons are often found near the statues of their victims, which travellers mistake for monuments.',
    },
    { id: 'p13-b4', class: 'heading', markerType: 'SectionHeader', bbox: [0.52, 0.05, 0.94, 0.07], markdown: '#### Fireball' },
    {
      id: 'p13-b5',
      class: 'body',
      markerType: 'Text',
      bbox: [0.52, 0.08, 0.94, 0.45],
      markdown: [
        '*3rd-level evocation*',
        '**Casting Time:** 1 action',
        '**Range:** 150 feet',
        '**Components:** V, S, M (a tiny ball of bat guano and sulfur)',
        '**Duration:** Instantaneous',
        'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.',
        '***At Higher Levels.*** When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
      ].join('\n\n'),
    },
    { id: 'p13-b6', class: 'heading', markerType: 'SectionHeader', bbox: [0.52, 0.5, 0.94, 0.52], markdown: '#### Bag of Holding' },
    {
      id: 'p13-b7',
      class: 'body',
      markerType: 'Text',
      bbox: [0.52, 0.53, 0.94, 0.8],
      markdown: [
        '*Wondrous item, uncommon*',
        'This bag has an interior space considerably larger than its outside dimensions, roughly 2 feet in diameter at the mouth and 4 feet deep. The bag can hold up to 500 pounds, not exceeding a volume of 64 cubic feet.',
      ].join('\n\n'),
    },
  ],
};

export const SRD_PAGES = [GORGON_PAGE_12, GORGON_PAGE_13];
