import type { CampaignEncounter } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID, crownSessionId } from './campaign';

export const crownEncounters: CampaignEncounter[] = [
  {
    id: 'encounter-cinder-wights-dais',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Cinder Wights at the Dais',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Shadow',
        count: 2,
        ruleset: '2014-srd',
        role: 'Ignite the banners and drive guests away from the dais.',
      },
      {
        name: 'Dust Mephit',
        count: 1,
        ruleset: '2014-srd',
        role: 'Blinds defenders with smoke while the wights advance.',
      },
    ],
    trigger:
      'The Crown speaks its accusation and the ceremonial braziers flare white.',
    intendedUse:
      'Session 1 primary encounter; the burning tapestries are a visible three-round clock and rescuing guests matters more than killing every attacker.',
    sessionIds: [crownSessionId(1)],
    locationIds: ['location-hall-of-nine-banners'],
    factionIds: ['faction-unquenched'],
    tactics:
      'Wights spread fire between banners to split the room. They retreat into the smoke once two banners are down; the mephit hunts anyone carrying the crown.',
    rulesetNotes:
      'Cinder wights use the SRD Shadow stat block (CR 1/2) as a stand-in; add fire immunity and water vulnerability as a DM note. The Dust Mephit stands in for a smoke creature.',
  },
  {
    id: 'encounter-heirs-audience',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Audience with the Heirs',
    kind: 'social',
    difficulty: 'low',
    composition: [
      {
        name: 'Noble',
        count: 3,
        ruleset: '2014-srd',
        role: 'Each heir makes a different case for the crown and offers the party a private favor.',
      },
    ],
    trigger:
      'Each character is drawn aside before the ceremony by a different heir.',
    intendedUse:
      'Session 1 opening scene; seeds the three heirs as sympathetic and gives each one contradictory gossip.',
    sessionIds: [crownSessionId(1)],
    locationIds: ['location-hall-of-nine-banners'],
    factionIds: ['faction-house-vell'],
    tactics:
      'No combat. Corvin pushes loyalty, Ysolde pushes advantage, Tamsin pushes honesty; none of them lies about the thing the party asks first.',
    rulesetNotes:
      'Display difficulty is a fixture. Social scene; stat blocks only for surprise escalation.',
  },
  {
    id: 'encounter-guttered-candle-brawl',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Brawl at the Guttered Candle',
    kind: 'combat',
    difficulty: 'low',
    composition: [
      {
        name: 'Thug',
        count: 2,
        ruleset: '2014-srd',
        role: 'Guild muscle who block the cellar door.',
      },
      {
        name: 'Bandit',
        count: 2,
        ruleset: '2014-srd',
        role: 'Grab lamps and throw oil to cover a retreat.',
      },
    ],
    trigger:
      'The party asks about the flame signal in the wrong room or pushes Nell Soot too hard.',
    intendedUse:
      'Session 2 optional combat; can be defused with a favor or a good bluff.',
    sessionIds: [crownSessionId(2)],
    locationIds: ['location-guttered-candle'],
    factionIds: ['faction-soot-hands'],
    tactics:
      'Thugs hold the door while the bandits smash lamps; the crew scatters when Nell shouts the guild call.',
    rulesetNotes:
      'Uses compatible 2014 SRD creatures. Not yet balanced for the final party composition.',
  },
  {
    id: 'encounter-vault-guardians',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Guardians of the Crown Vault',
    kind: 'combat-exploration',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Animated Armor',
        count: 2,
        ruleset: '2014-srd',
        role: 'Warden-forged sentinels that attack anyone not carrying the crown.',
      },
      {
        name: 'Magma Mephit',
        count: 1,
        ruleset: '2014-srd',
        role: 'A bound elemental that flares when the crown speaks aloud.',
      },
    ],
    trigger:
      'The party enters the vault without the crown, or the crown speaks a name from the burn list.',
    intendedUse:
      'Session 4 dungeon beat; the crown can disarm the guardians if it is asked the right question.',
    sessionIds: [crownSessionId(4)],
    locationIds: ['location-crown-vault'],
    factionIds: ['faction-ember-wardens'],
    tactics:
      'Armor blocks corridors while the mephit ignites braziers; the fight ends when the party answers the vault riddle.',
    rulesetNotes:
      'Uses compatible 2014 SRD creatures. Prepared for party level 3; retune if the party is below that.',
  },
  {
    id: 'encounter-catacomb-ashbound',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'The Ashbound in the Catacombs',
    kind: 'combat-exploration',
    difficulty: 'high',
    composition: [
      {
        name: 'Cult Fanatic',
        count: 1,
        ruleset: '2014-srd',
        role: 'Leads the Unquenched rite and hurls cinders.',
      },
      {
        name: 'Cultist',
        count: 4,
        ruleset: '2014-srd',
        role: 'Feed the rite pit and swarm intruders.',
      },
      {
        name: 'Magma Mephit',
        count: 1,
        ruleset: '2014-srd',
        role: 'Raises the temperature in the rite chamber each round.',
      },
    ],
    trigger:
      'The party follows the paymaster trail beneath the Ember Cloister.',
    intendedUse:
      'Session 5 finale; Mother Cinder appears at the end of the encounter and escapes unless stopped.',
    sessionIds: [crownSessionId(5)],
    locationIds: ['location-ashen-catacombs'],
    factionIds: ['faction-unquenched'],
    tactics:
      'Cultists guard the rite pit; the fanatic retreats to the far ledge. Extinguishing the pit ends the rite and weakens the mephit.',
    rulesetNotes:
      'Uses compatible 2014 SRD creatures. Encounter is a draft; difficulty needs a playtest pass.',
  },
  {
    id: 'encounter-ashwater-chase',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Chase Across the Ash Barges',
    kind: 'combat-exploration',
    difficulty: 'low',
    composition: [
      {
        name: 'Thug',
        count: 2,
        ruleset: '2014-srd',
        role: 'Barge crew paid to keep the quay clear and push pursuers into the grey water.',
      },
      {
        name: 'Bandit',
        count: 1,
        ruleset: '2014-srd',
        role: 'Carries the courier’s satchel across the barges and cuts the mooring lines behind him.',
      },
      {
        name: 'Shifting ash barges',
        count: 1,
        ruleset: 'custom',
        role: 'Terrain: moored barges drift apart each round. DC 12 Acrobatics to cross; a fall means a DC 10 Athletics swim in cinder-thick water.',
        nonCreature: true,
      },
    ],
    trigger:
      'The party tails the courier’s trail to the quay, or Nell Soot points them at the barge that left with the stolen satchel.',
    intendedUse:
      'Session 2 chase. A cinematic set piece that rewards mobility over damage; works as the physical payoff if the Guttered Candle brawl is defused.',
    sessionIds: [crownSessionId(2)],
    locationIds: ['location-ashwater-quay'],
    factionIds: ['faction-soot-hands'],
    tactics:
      'The bandit runs, the thugs block and shove. Nobody fights to the death: when the satchel is lost or the bandit is cornered, the crew dives for the tidal flats and scatters.',
    rulesetNotes:
      'Run as a chase with three barge-hops before the pier ends. Compatible 2014 SRD creatures; use the Thug stat block sparingly because grappling a pursuer into the water is the real threat.',
  },
  {
    id: 'encounter-border-lords-parley',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Parley at Marchwarden House',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Veteran',
        count: 1,
        ruleset: '2014-srd',
        role: 'Marchwarden Dagna Rook: blunt negotiator who respects anyone who answers a direct question directly.',
      },
      {
        name: 'Veteran',
        count: 2,
        ruleset: '2014-srd',
        role: 'Frontier honor guard. They stand silently and note who flinches.',
      },
      {
        name: 'Scout',
        count: 1,
        ruleset: '2014-srd',
        role: 'Carries Rook’s sealed copy of the war writ and will not release it without a trade.',
      },
    ],
    trigger:
      'The party accepts Rook’s invitation, or carries a message to her on behalf of one of the heirs.',
    intendedUse:
      'Session 3 negotiation. Play it as a three-successes-before-two-failures skill challenge: Persuasion for terms, Insight for her bottom line, History or Investigation for the writ.',
    sessionIds: [crownSessionId(3)],
    locationIds: ['location-marchwarden-house'],
    factionIds: ['faction-border-lords', 'faction-house-vell'],
    tactics:
      'Rook opens by asking what the party wants for itself. Honest answers earn a concession; a flattering lie costs a success. If talks collapse she does not attack; she leaves, and the Marcher Lords begin to mobilize.',
    rulesetNotes:
      'Stat blocks are for a surprise escalation only. A broken parley is a campaign consequence, not a combat.',
  },
  {
    id: 'encounter-forgers-den',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'The Forger’s Den',
    kind: 'combat',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Spy',
        count: 1,
        ruleset: '2014-srd',
        role: 'A Gilded Ledger watcher posted in the shop to learn who asks about the genealogy.',
      },
      {
        name: 'Thug',
        count: 2,
        ruleset: '2014-srd',
        role: 'Hired muscle who smash the lamp-oil racks to cover the spy’s escape.',
      },
      {
        name: 'Swarm of Ravens',
        count: 1,
        ruleset: '2014-srd',
        role: 'Ferrant’s alarm flock, loosed from the rafters at the first raised voice.',
      },
    ],
    trigger:
      'The party presses Ferrant Inkwell for a client name, or breaks into the workshop after hours.',
    intendedUse:
      'Session 3 optional fight. The goal is the ledger of commissions in the back room, not victory; the spy’s escape route is the clock.',
    sessionIds: [crownSessionId(3)],
    locationIds: ['location-inkwell-court'],
    factionIds: ['faction-gilded-ledger', 'faction-soot-hands'],
    tactics:
      'Ravens harry spellcasters and anyone reading the ledger. The spy tries to burn the commission book and flee over the rooftops rather than fight.',
    rulesetNotes:
      'Compatible 2014 SRD creatures, built for party level 2. Ink pots and oil lamps make an easy environmental hazard if the DM wants to add fire.',
  },
  {
    id: 'encounter-queens-chambers-inquest',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Inquest in the Queen’s Chambers',
    kind: 'social',
    difficulty: 'low',
    composition: [
      {
        name: 'Priest',
        count: 1,
        ruleset: '2014-srd',
        role: 'The royal physician, who signed a report he knows is wrong about the hour of death.',
      },
      {
        name: 'Commoner',
        count: 2,
        ruleset: '2014-srd',
        role: 'Chambermaids who each heard a different visitor and are afraid to say so together.',
      },
      {
        name: 'Veteran',
        count: 1,
        ruleset: '2014-srd',
        role: 'The Warden door-guard who kept the log and was told to alter it.',
      },
    ],
    trigger:
      'The party is granted access to the sealed chambers, or Tamsin smuggles them in past the Watch.',
    intendedUse:
      'Session 3 mystery scene. Each witness holds one piece of the timeline; interviewing them separately yields clean facts, together yields gossip.',
    sessionIds: [crownSessionId(3)],
    locationIds: ['location-queens-chambers'],
    factionIds: ['faction-house-vell', 'faction-ember-wardens'],
    tactics:
      'No combat. The physician folds first if confronted with the report’s two dates; the door-guard only talks to Bryn and only about duty; the maids talk to Sable if she promises not to repeat names.',
    rulesetNotes:
      'Social scene. Stat blocks exist only if someone panics and bolts. The scorched ash-cup on the nightstand is the physical clue.',
  },
  {
    id: 'encounter-mausoleum-vigil',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Vigil in the Vellgrave Mausoleum',
    kind: 'combat-hazard',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Skeleton',
        count: 4,
        ruleset: '2014-srd',
        role: 'The queen’s honor-guard of old, woken by the ash seeping through the crypt floor.',
      },
      {
        name: 'Specter',
        count: 1,
        ruleset: '2014-srd',
        role: 'A restless wet-nurse who knows what was buried in the infant’s coffin and attacks anyone who opens it.',
      },
      {
        name: 'Ash vents',
        count: 1,
        ruleset: 'custom',
        role: 'Hazard: each round a random vent erupts (DC 12 Dexterity save, 2d6 fire on a failure) and blinds the square it covers.',
        nonCreature: true,
      },
    ],
    trigger:
      'The party opens Prince Aurel’s sarcophagus or lingers in the royal crypt past the third bell.',
    intendedUse:
      'Session 4 reveal scene. Fighting is optional; the specter can be settled by answering her question honestly.',
    sessionIds: [crownSessionId(4)],
    locationIds: ['location-royal-mausoleum'],
    factionIds: ['faction-house-vell', 'faction-unquenched'],
    tactics:
      'Skeletons advance in a line down the central aisle. The specter hangs back near the infant’s coffin and drains anyone who touches it; vents push the party toward the sarcophagus.',
    rulesetNotes:
      'Compatible 2014 SRD creatures, tuned for party level 3. Consider dropping to two skeletons if the party opened the Crown Vault first and is short on resources.',
  },
  {
    id: 'encounter-witness-clause',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'The Witness Clause',
    kind: 'social',
    difficulty: 'high',
    composition: [
      {
        name: 'Noble',
        count: 3,
        ruleset: '2014-srd',
        role: 'Corvin, Ysolde and Tamsin make their last arguments, each leaning on whatever the party learned about them.',
      },
      {
        name: 'Veteran',
        count: 4,
        ruleset: '2014-srd',
        role: 'Wardens and marchers who will back whichever claimant the crown accepts, and fight if it accepts nobody.',
      },
      {
        name: 'Cult Fanatic',
        count: 1,
        ruleset: '2014-srd',
        role: 'Mother Cinder or her proxy, if she escaped session 5. She interrupts the confirmation to burn the verdict out of the hall.',
      },
    ],
    trigger:
      'The party invokes the witness clause in the Hall of Nine Banners and the crown begins its judgment.',
    intendedUse:
      'Session 6 finale. A debate with consequences: everything the party learned is spent here. Combat is the failure state, not the expectation.',
    sessionIds: [crownSessionId(6)],
    locationIds: ['location-hall-of-nine-banners'],
    factionIds: [
      'faction-house-vell',
      'faction-unquenched',
      'faction-ember-wardens',
    ],
    tactics:
      'Each heir’s argument is a round of social conflict. If the party reveals a lie with proof, that heir loses a round of support. If Mother Cinder interrupts, the veterans split by loyalty and the fight starts with the party between them.',
    rulesetNotes:
      'Social-first finale. Cult Fanatic stands in for Mother Cinder; add fire immunity and a once-per-fight Burning Hands burst centered on the crown. Retune after the session 5 outcome.',
  },
];
