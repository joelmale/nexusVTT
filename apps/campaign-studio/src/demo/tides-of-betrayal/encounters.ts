import type { CampaignEncounter } from '../ashes-of-veyra/types';
import { TIDES_CAMPAIGN_ID, tidesSessionId } from './campaign';

export const tidesEncounters: CampaignEncounter[] = [
  // Chapter 1: Whispers in the Harbor
  {
    id: 'encounter-pickpocket-chase',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Pickpocket Chase Through the Docks',
    kind: 'combat-exploration',
    difficulty: 'low',
    composition: [
      {
        name: 'Bandit',
        count: 1,
        ruleset: '2014-srd',
        role: 'Pip, a quick-fingered urchin. Flees rather than fights; surrenders at half hit points.',
      },
      {
        name: 'Swarm of Rats',
        count: 1,
        ruleset: '2014-srd',
        role: 'A stray animal pack disturbed when the chase crashes through a fish-gutting yard.',
      },
      {
        name: 'Crowded docks',
        count: 1,
        ruleset: 'custom',
        role: 'Chase complications: cargo nets, a swinging crane load, a slick gangplank (DC 12 Acrobatics or fall prone).',
        nonCreature: true,
      },
    ],
    trigger:
      'A pickpocket attempts to steal from one of the players as they push through the crowd.',
    intendedUse:
      'Session 1 opener that shows off the Dock Ward. Pip should get away twice and be caught on the third complication, so the chase ends in a conversation rather than a fight.',
    sessionIds: [tidesSessionId(1)],
    locationIds: ['location-dock-ward'],
    factionIds: ['faction-longshoremen'],
    tactics:
      'Run as a chase: each round Pip moves 30 feet and the DM rolls a d6 complication. Pip ducks under carts and doubles back toward the shipyard, where her dog is hiding.',
    rulesetNotes:
      'Pip uses the Bandit stat block as a stand-in but never attacks to kill. Use the 2014 DMG chase rules or a simple three-success skill challenge.',
  },
  {
    id: 'encounter-dock-ward-tails',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Cornered in Net-Drying Alley',
    kind: 'combat',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Thug',
        count: 1,
        ruleset: '2014-srd',
        role: 'Red Tide enforcer who warns the party off the investigation.',
      },
      {
        name: 'Bandit',
        count: 2,
        ruleset: '2014-srd',
        role: 'Red-thread tails who have followed the party since the market.',
      },
    ],
    trigger:
      'After the party asks one question too many about the attack, the figures who have been tailing them close in.',
    intendedUse:
      'Session 1 main fight. If the party spotted the tails (Perception DC 12), they choose where it happens; otherwise the tails choose the alley.',
    sessionIds: [tidesSessionId(1)],
    locationIds: ['location-dock-ward'],
    factionIds: ['faction-red-tide'],
    tactics:
      'The thug talks first: “Leave the fleet to the fish.” If refused, bandits cut drying nets loose to entangle (DC 11 Strength save or restrained). All three flee at half strength; a captured bandit gives up the red-thread sign.',
    rulesetNotes:
      'Moderate for four level 1 characters. Drop a bandit for three players.',
  },
  {
    id: 'encounter-salty-seaman-brawl',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Brawl at the Salty Seaman',
    kind: 'combat',
    difficulty: 'low',
    composition: [
      {
        name: 'Commoner',
        count: 4,
        ruleset: '2014-srd',
        role: 'Sailors from rival ships throwing fists and stools.',
      },
      {
        name: 'Thug',
        count: 1,
        ruleset: '2014-srd',
        role: 'A bosun who started it, blaming the other crew’s captain for the attack.',
      },
    ],
    trigger:
      'Random event 2: a brawl breaks out between sailors from rival ships while the party talks with Elara.',
    intendedUse:
      'Optional session 1 encounter. Nonlethal; a good chance for players to impress Elara before she hires them.',
    sessionIds: [tidesSessionId(1)],
    locationIds: ['location-salty-seaman'],
    factionIds: ['faction-longshoremen'],
    tactics:
      'Brawlers make unarmed strikes and grapple. Gus rings the ship’s bell after three rounds and the brawl ends with a round on the house.',
    rulesetNotes: 'All damage is nonlethal. Improvised weapons deal 1d4.',
  },
  {
    id: 'encounter-shipyard-search',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Night Search at Shipwright’s Reach',
    kind: 'combat-exploration',
    difficulty: 'low',
    composition: [
      {
        name: 'Mastiff',
        count: 2,
        ruleset: '2014-srd',
        role: 'Yard dogs that bark at intruders but can be calmed (DC 12 Animal Handling) or bribed with fish.',
      },
      {
        name: 'Guard',
        count: 1,
        ruleset: '2014-srd',
        role: 'A night watchman paid to keep people away from the “salvage” longboat.',
      },
    ],
    trigger:
      'The party searches the shipyard for where the plunder came ashore.',
    intendedUse:
      'Session 1 investigation scene. Investigation DC 14 finds the painted-over Red Tide mark, the Saffron Fleet seals and the map fragment.',
    sessionIds: [tidesSessionId(1)],
    locationIds: ['location-shipyard'],
    factionIds: ['faction-longshoremen', 'faction-red-tide'],
    tactics:
      'The guard would rather take a bribe (5 gp) than fight. If the dogs raise the alarm, more guards arrive in 5 rounds.',
    rulesetNotes: 'Mostly exploration. The yard ledger can be read here or saved for session 3.',
  },
  // Chapter 2: The Siren's Call
  {
    id: 'encounter-sirens-cove-harpies',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'The Sirens of the Cove',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Harpy',
        count: 2,
        ruleset: '2014-srd',
        role: 'The “sirens” of the shanty, nesting on the upper ledges. Their luring song pulls swimmers toward the rocks.',
      },
      {
        name: 'Giant Crab',
        count: 2,
        ruleset: '2014-srd',
        role: 'Scavengers in the shallows that grapple anyone the harpies lure down.',
      },
      {
        name: 'Rising tide',
        count: 1,
        ruleset: 'custom',
        role: 'The beach floods in 10 rounds. From round 6 the water is difficult terrain; from round 10 everyone must swim.',
        nonCreature: true,
      },
    ],
    trigger:
      'The party rows into the cove at the ebb, and the harpies begin to sing as the tide turns.',
    intendedUse:
      'Session 2 set piece. The tide clock matters more than killing the harpies; the party can retreat into the pirates’ dock cave above the waterline.',
    sessionIds: [tidesSessionId(2)],
    locationIds: ['location-sirens-cove'],
    factionIds: ['faction-red-tide'],
    tactics:
      'One harpy sings while the other dives at whoever is charmed. Crabs hold grappled targets underwater once the tide is high. A bard can counter the song with the fourth verse (Performance DC 13 ends the charm on all allies).',
    rulesetNotes:
      'High for four level 2 characters. Nerissa watches from the water and helps anyone who is drowning.',
  },
  {
    id: 'encounter-cove-smugglers',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Red Tide Smugglers at the Landing',
    kind: 'combat',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Bandit',
        count: 3,
        ruleset: '2014-srd',
        role: 'Smugglers loading crates of Saffron Fleet plunder into a longboat.',
      },
      {
        name: 'Scout',
        count: 1,
        ruleset: '2014-srd',
        role: 'Lookout on the cliff path with a signal horn.',
      },
      {
        name: 'Spy',
        count: 1,
        ruleset: '2014-srd',
        role: 'Wick, who slipped away from Tobin’s performance to warn the cove.',
      },
    ],
    trigger:
      'The party reaches the rough docks at the back of the cove while the smugglers are loading.',
    intendedUse:
      'Session 2 climax. Winning (or sneaking) gets the party the payment letter, Jory’s ring and a prisoner to question.',
    sessionIds: [tidesSessionId(2)],
    locationIds: ['location-sirens-cove'],
    factionIds: ['faction-red-tide'],
    tactics:
      'The scout blows the horn on round 2; if it sounds, the longboat casts off with the strongbox crate. Wick throws a lantern into the oil-soaked crates to cover his escape. Bandits surrender if Wick flees.',
    rulesetNotes:
      'If the party answers the challenge “What does the siren want?” with the fourth verse, the smugglers mistake them for Red Tide and the fight can be skipped.',
  },
  // Chapter 3: Ledgers and Lies
  {
    id: 'encounter-council-masque',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'The Midsummer Masque',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Noble',
        count: 3,
        ruleset: '2014-srd',
        role: 'Councilors Vael and Bolt and a third councilor (Lady Imogen Sallow), each with something to hide.',
      },
      {
        name: 'Guard',
        count: 4,
        ruleset: '2014-srd',
        role: 'Council Hall guards who notice anyone wandering into the towers.',
      },
    ],
    trigger:
      'The party arrives at the Council’s Midsummer Masque on Elara’s invitation.',
    intendedUse:
      'Session 3 centerpiece. The goal is to compare the councilors’ seals and learn who held their ships back, while Vael tries to recruit the party and steer them toward Bolt.',
    sessionIds: [tidesSessionId(3)],
    locationIds: ['location-council-hall'],
    factionIds: ['faction-merchant-council', 'faction-gull-and-coin'],
    tactics:
      'Run as three rounds of mingling. Each round every player picks a target and an approach (Insight, Persuasion, Deception or Sleight of Hand, DC 13). Track suspicion: three failures and Vael notices them; five and the guards escort them out.',
    rulesetNotes:
      'Display difficulty only. Combat breaks out only if the party draws steel in the hall, which ends the masque and gives Vael her excuse to arrest Bolt.',
  },
  {
    id: 'encounter-counting-house-vault',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'The Counting House Vault',
    kind: 'trap',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Guard',
        count: 2,
        ruleset: '2014-srd',
        role: 'Night guards on the ground floor; they check the top floor every 10 minutes.',
      },
      {
        name: 'Glyph of warding',
        count: 1,
        ruleset: 'custom',
        role: 'Ysra Coldwater’s ward on the vault door.',
        nonCreature: true,
      },
    ],
    trigger:
      'Anyone opens the vault door without speaking the password, “low water”.',
    intendedUse:
      'Session 3 optional heist while Vael is at the masque. The prize is the ledger page that names Captain K.',
    sessionIds: [tidesSessionId(3)],
    locationIds: ['location-vael-counting-house'],
    factionIds: ['faction-gull-and-coin'],
    tactics:
      'The guards are bored and slow. If the glyph triggers, a bell rings at Council Hall and Ysra arrives in 3 rounds.',
    rulesetNotes:
      'Complex trap: detect and disarm the glyph, beat the guard rotation and pick the vault lock in any order.',
    trapDetails: {
      complexity: 'complex',
      detectionDc: 14,
      disarmDc: 14,
      trigger: 'Opening the vault door without saying “low water” aloud.',
      initiativeOrTimer: 'Guard check every 10 minutes (roll a d10 for the minute the party arrives).',
      saveOrAttack: 'DC 13 Dexterity save',
      effect: '5d8 cold damage in a 20-foot sphere (half on a save), and an alarm bell rings at Council Hall.',
      countermeasures:
        'Arcana DC 14 to dispel; Old Maeve’s shanty contains the password; a clerk can be bribed or charmed into saying it.',
      reset: 'Ysra must recast the glyph; none until the next day.',
    },
  },
  // Chapter 4: The Drowned Market
  {
    id: 'encounter-drowned-market-merrow',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'The Dangerous Shipment Breaks Loose',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Merrow',
        count: 1,
        ruleset: '2014-srd',
        role: 'The caged “dangerous shipment”, bred to track the Pearl’s scent. Starved, furious and in water it knows.',
      },
      {
        name: 'Thug',
        count: 2,
        ruleset: '2014-srd',
        role: 'Grimm’s handlers, who try to recapture the merrow with harpoons and nets.',
      },
      {
        name: 'Raft stalls',
        count: 1,
        ruleset: 'custom',
        role: 'Lashed rafts tip when two or more creatures stand on one edge (DC 12 Dexterity save or fall in).',
        nonCreature: true,
      },
    ],
    trigger:
      'Someone opens the cage, or Grimm’s handlers prod it while moving it to a boat bound for Blackwater Reach.',
    intendedUse:
      'Session 4 climax. Kill the merrow, recapture it, or let it flee into the sea; each choice shapes Act II.',
    sessionIds: [tidesSessionId(4)],
    locationIds: ['location-drowned-market'],
    factionIds: ['faction-red-tide', 'faction-gull-and-coin'],
    tactics:
      'The merrow harpoons the nearest warm body and drags it into the water. It ignores anyone carrying salt or Nerissa’s shell. Handlers fight the merrow first and the party second.',
    rulesetNotes:
      'High for four level 3 characters. If the merrow escapes, it reappears hunting the Gilded Gull in session 5 and can replace a reef shark.',
  },
  // Chapter 5: Mutiny on the Gilded Gull
  {
    id: 'encounter-sahuagin-raid',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Sahuagin Raid on the Shoals',
    kind: 'combat',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Sahuagin',
        count: 4,
        ruleset: '2014-srd',
        role: 'Raiders drawn by the restless sea, climbing the hull with hooked spears.',
      },
      {
        name: 'Reef Shark',
        count: 2,
        ruleset: '2014-srd',
        role: 'Circling below; attack anyone knocked overboard.',
      },
    ],
    trigger:
      'The Gilded Gull passes the Gullrock shoals at dusk, near the wreck of the Saffron Wren.',
    intendedUse:
      'Session 5 opener. Shows that the sea is waking and gives Nerissa a chance to prove herself an ally.',
    sessionIds: [tidesSessionId(5)],
    locationIds: ['location-gilded-gull', 'location-gullrock-shoals'],
    factionIds: ['faction-deepcourt'],
    tactics:
      'Sahuagin board from both rails at once and try to drag sailors overboard. Their blood frenzy makes them focus the wounded. They flee if two die.',
    rulesetNotes: 'Moderate for four level 4 characters. Elara and the crew hold the far rail.',
  },
  {
    id: 'encounter-gilded-gull-mutiny',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Mutiny on the Gilded Gull',
    kind: 'combat',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Thug',
        count: 1,
        ruleset: '2014-srd',
        role: 'Cobb Varley, the bribed bosun, who wants the ship sunk and himself in the longboat.',
      },
      {
        name: 'Bandit',
        count: 4,
        ruleset: '2014-srd',
        role: 'Sailors Cobb has frightened into mutiny with tales of the cursed voyage.',
      },
      {
        name: 'Fire in the hold',
        count: 1,
        ruleset: 'custom',
        role: 'Cobb sets the powder store burning. 4 rounds to put it out (two successful DC 13 checks) before the hull is holed.',
        nonCreature: true,
      },
    ],
    trigger:
      'The night after the raid, Cobb lights the hold and calls the frightened crew to the longboat.',
    intendedUse:
      'Session 5 climax. The mutineers are scared, not evil; Persuasion DC 14 turns one bandit per success.',
    sessionIds: [tidesSessionId(5)],
    locationIds: ['location-gilded-gull'],
    factionIds: ['faction-gull-and-coin'],
    tactics:
      'Cobb holds the hatch so nobody reaches the fire. If he is captured alive he confesses that Vael bought his debts and promised more if the Gull never reached Blackwater Reach.',
    rulesetNotes:
      'Running out the fire clock holes the ship: the Gull limps into Blackwater Reach and needs repairs, which raises the price Kade asks.',
  },
  // Chapter 6: The Pirate Queen's Parley
  {
    id: 'encounter-pirate-queen-parley',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Parley with the Pirate Queen',
    kind: 'social',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Bandit Captain',
        count: 1,
        ruleset: '2014-srd',
        role: 'Captain Morwen Kade, holding court on a beached galleon.',
      },
      {
        name: 'Veteran',
        count: 1,
        ruleset: '2014-srd',
        role: 'Quartermaster Hask, who keeps the articles and the count of every coin.',
      },
      {
        name: 'Bandit',
        count: 4,
        ruleset: '2014-srd',
        role: 'Red Tide crew who will enforce whatever the captain decides.',
      },
    ],
    trigger:
      'The party invokes parley under the Red Tide articles on arrival at Blackwater Reach.',
    intendedUse:
      'Session 6 centerpiece. Kade knows she was hired by someone with a gull seal; she does not know that Vael has already sent assassins.',
    sessionIds: [tidesSessionId(6)],
    locationIds: ['location-blackwater-reach'],
    factionIds: ['faction-red-tide'],
    tactics:
      'Kade wants three things: her share of the Pearl, revenge on whoever betrays her, and amnesty from Merrowgate. The party can offer any two. She frees Jory as a gesture once a deal is struck.',
    rulesetNotes:
      'Social encounter with three asks; track agreement with a three-success challenge (Persuasion, Insight or Intimidation, DC 14).',
  },
  {
    id: 'encounter-vael-assassins',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Knives in Blackwater Reach',
    kind: 'combat',
    difficulty: 'high',
    composition: [
      {
        name: 'Cult Fanatic',
        count: 1,
        ruleset: '2014-srd',
        role: 'Ysra Coldwater, sea mage, leading the strike from a rowboat in the lagoon.',
      },
      {
        name: 'Spy',
        count: 3,
        ruleset: '2014-srd',
        role: 'Gull and Coin assassins who cross the rope bridges in the dark.',
      },
      {
        name: 'Veteran',
        count: 1,
        ruleset: '2014-srd',
        role: 'A hired sellsword assigned to kill Captain Kade.',
      },
    ],
    trigger:
      'The night of the parley, Vael’s assassins arrive to kill Kade and take the chart.',
    intendedUse:
      'Session 6 climax. Saving Kade wins her loyalty; letting her die leaves the Red Tide leaderless and hostile.',
    sessionIds: [tidesSessionId(6)],
    locationIds: ['location-blackwater-reach'],
    factionIds: ['faction-gull-and-coin', 'faction-red-tide'],
    tactics:
      'The spies cut rope bridges behind them. Ysra casts from the boat and flees with the chart half if hit hard. The veteran goes straight for Kade.',
    rulesetNotes:
      'High for four level 4 characters. Ysra uses the Cult Fanatic stat block as a stand-in caster; swap in sea-flavored spells. Captured spies carry Gull-and-Coin tokens.',
  },
  // Chapter 7: The Sunken Spire
  {
    id: 'encounter-spire-tide-locks',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'The Tide Locks',
    kind: 'trap',
    difficulty: 'moderate',
    composition: [
      {
        name: 'Flooding chambers',
        count: 1,
        ruleset: 'custom',
        role: 'Three linked chambers whose water rises and falls as the locks turn.',
        nonCreature: true,
      },
    ],
    trigger: 'The party enters the first flooded chamber of the Spire.',
    intendedUse:
      'Session 7 puzzle before the guardian. Rewards players who kept the shanty and the Spire inscription.',
    sessionIds: [tidesSessionId(7)],
    locationIds: ['location-sunken-spire'],
    factionIds: ['faction-deepcourt'],
    tactics:
      'Three bronze wheels carved with moon phases. Turning them in the order of the inscription (new, half, full) drains the way to the heart; any wrong turn floods the chamber one level.',
    rulesetNotes: 'Puzzle trap; three wrong turns fill the room completely.',
    trapDetails: {
      complexity: 'puzzle',
      detectionDc: 12,
      trigger: 'Turning a lock wheel out of order.',
      initiativeOrTimer: 'Each wrong turn raises the water 5 feet; the chamber is 15 feet deep.',
      saveOrAttack: 'DC 13 Strength (Athletics) to keep footing',
      effect: 'Characters who are not swimming fall prone and begin holding their breath.',
      countermeasures:
        'Inscription order is new moon, half moon, full moon. The fourth verse of the shanty hints at “turn as the moon turns”.',
      reset: 'The water drains back over 1 minute once the correct wheel is turned.',
    },
  },
  {
    id: 'encounter-spire-guardian',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Guardian of the Tidecaller Pearl',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Water Elemental',
        count: 1,
        ruleset: '2014-srd',
        role: 'The Pearl’s guardian, bound by Thalassa’s oath, rising from the temple pool.',
      },
      {
        name: 'Swarm of Quippers',
        count: 2,
        ruleset: '2014-srd',
        role: 'Drawn to blood in the flooded nave.',
      },
      {
        name: 'Air pockets',
        count: 1,
        ruleset: 'custom',
        role: 'Only three warded air pockets remain; the elemental’s whelm can collapse one each round on a 5-6.',
        nonCreature: true,
      },
    ],
    trigger:
      'Anyone who failed Thalassa’s questions reaches for the Pearl, or Vael’s agents arrive and take it.',
    intendedUse:
      'Session 7 climax. Avoidable entirely if the party answers Thalassa truthfully and swears not to use the Pearl for themselves.',
    sessionIds: [tidesSessionId(7)],
    locationIds: ['location-sunken-spire'],
    factionIds: ['faction-deepcourt'],
    tactics:
      'The elemental whelms anyone holding the Pearl. Quippers hunt anyone bleeding. Thalassa can call the elemental off if the Pearl is returned to its plinth.',
    rulesetNotes:
      'High for four level 5 characters. Nerissa’s water breathing removes the drowning pressure for two characters.',
  },
  // Chapter 8: Tides of Betrayal
  {
    id: 'encounter-storm-over-merrowgate',
    campaignId: TIDES_CAMPAIGN_ID,
    title: 'Storm over Merrowgate',
    kind: 'combat-hazard',
    difficulty: 'high',
    composition: [
      {
        name: 'Mage',
        count: 1,
        ruleset: '2014-srd',
        role: 'Councilor Vael atop the Widow’s Lantern, channeling the Pearl.',
      },
      {
        name: 'Veteran',
        count: 2,
        ruleset: '2014-srd',
        role: 'Gull and Coin bodyguards holding the lighthouse stair.',
      },
      {
        name: 'Storm surge',
        count: 1,
        ruleset: 'custom',
        role: 'On initiative 20 each round, a wave hits the lighthouse gallery: DC 14 Strength save or pushed 15 feet toward the rail.',
        nonCreature: true,
      },
      {
        name: 'Tidecaller Pearl',
        count: 1,
        ruleset: 'custom',
        role: 'Lair action on initiative 10: Vael calls lightning (3d10, DC 14 Dex half) or a wave that knocks a ship in the harbor onto the quay.',
        nonCreature: true,
      },
    ],
    trigger:
      'During the Harbor Festival, the Widow’s Lantern lights sea-green and a storm rises out of a clear sky.',
    intendedUse:
      'Session 8 finale. Vael means to wreck the harbor and then calm it, making herself the city’s savior. Taking the Pearl or breaking her concentration ends the storm.',
    sessionIds: [tidesSessionId(8)],
    locationIds: ['location-widows-lantern', 'location-merrowgate'],
    factionIds: ['faction-gull-and-coin'],
    tactics:
      'Vael stays at the lantern and lets the bodyguards hold the stair. Below half hit points she offers the party a seat on the Council. If the Pearl is taken from her, she throws herself from the gallery rather than face trial, unless someone catches her.',
    rulesetNotes:
      'High for four level 5 characters, harder without allies. Kade’s crew, Ada Flint’s watch or Nerissa can each remove one veteran if the party earned their help.',
  },
];
