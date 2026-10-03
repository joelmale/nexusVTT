import { generateName } from '../utils/nameGenerator';

export type FactionRelationshipType =
  | 'ally'
  | 'rival'
  | 'uneasy-truce'
  | 'infiltrated'
  | 'transactional'
  | 'ambivalent'
  | 'distant'
  | 'ignorance'
  | 'willful-ignorance';

export interface FactionRelationship {
  targetTempId: string;
  targetFactionName: string;
  type: FactionRelationshipType;
  summary: string;
}

export interface GeneratedKeyFigure {
  name: string;
  title: string;
  role: 'leader' | 'lieutenant' | 'specialist';
  ancestry: string;
  personality: string;
  motivation: string;
}

export interface GeneratedFaction {
  tempId: string;
  name: string;
  archetype: string;
  theme: string;
  scope: 'city' | 'regional' | 'world';
  status: 'ally' | 'neutral' | 'opposition' | 'unknown';
  publicFace: string;
  hiddenAgenda: string;
  motto: string;
  primaryAsset: string;
  vulnerability: string;
  keyFigures: GeneratedKeyFigure[];
  relationships: FactionRelationship[];
}

export interface CentralFlashpoint {
  title: string;
  summary: string;
  contestedResource: string;
  stakes: string;
}

export interface FactionWebResult {
  flashpoint?: CentralFlashpoint;
  scope: 'city' | 'regional' | 'world';
  theme: string;
  factions: GeneratedFaction[];
}

export interface FactionGeneratorOptions {
  count?: number;
  scope?: 'city' | 'regional' | 'world';
  theme?:
    | 'all'
    | 'comedic'
    | 'churches'
    | 'intrigue'
    | 'underworld'
    | 'arcane'
    | 'military';
  includeRelationships?: boolean;
  keyFiguresMode?: 'none' | 'leaders' | 'full';
  customFlashpoint?: string;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomCount<T>(items: readonly T[], count: number): T[] {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// ============================================================================
// Catalogs & Archetype Data
// ============================================================================

interface FactionArchetypeTemplate {
  name: string;
  theme: 'comedic' | 'churches' | 'intrigue' | 'underworld' | 'arcane' | 'military';
  archetype: string;
  publicFace: string;
  hiddenAgenda: string;
  motto: string;
  primaryAsset: string;
  vulnerability: string;
  leaderTitle: string;
  lieutenantTitle: string;
}

const FACTION_TEMPLATES: readonly FactionArchetypeTemplate[] = [
  // --- Comedic & Satirical (Terry Pratchett / Discworld inspired) ---
  {
    name: 'The Department of Minor Nuisances',
    theme: 'comedic',
    archetype: 'Bureaucracy & Audit Clerisy',
    publicFace:
      'A militant clerical registry dedicated to auditing citizens who fail to register domestic mimics or neglect to file three-copy permits for minor fireball property damage.',
    hiddenAgenda:
      'Collecting enough arbitrary administrative fines and back-taxes to purchase the town hall and mandate that all vowels in official speeches be pronounced backwards.',
    motto: 'Form 7-B must be submitted in quadruplicate, on parchment of acceptable thickness.',
    primaryAsset: 'Legally binding writs of inspection and a bottomless supply of self-inking red stamps.',
    vulnerability: 'Completely paralyzed if presented with a contradictory notarized counter-permit.',
    leaderTitle: 'Chief High Auditor of the Stamped Seal',
    lieutenantTitle: 'Deputy Sub-Inspector of Unsanctioned Geometry',
  },
  {
    name: 'The Radical Purists of the Crust',
    theme: 'comedic',
    archetype: 'Militant Bakers & Guild Zealots',
    publicFace:
      'A prestigious bakers’ guild that inspects community taverns to ensure all loaves are baked to canonical golden crust and sliced at precise geometric angles.',
    hiddenAgenda:
      'Waging a covert holy war against the local tavern keepers who secretly slice day-old rye horizontally, planning to blockade the yeast supply until surrender.',
    motto: 'Flour, flame, and orthogonal slicing: all else is blasphemy.',
    primaryAsset: 'Monopoly on high-grade yeast cultures and formidable rolling pins lined with lead.',
    vulnerability: 'Crippling fear of sourdough contamination and damp basements.',
    leaderTitle: 'Grand Master of the Leavened Loaf',
    lieutenantTitle: 'First Inquisitor of the Slicing Angle',
  },
  {
    name: 'The Order of the Lukewarm Stew',
    theme: 'comedic',
    archetype: 'Ascetic Monastic Sect',
    publicFace:
      'A serene brotherhood taking strict vows never to consume or prepare any meal above room temperature, professing that culinary passion is the primary gateway to moral chaos.',
    hiddenAgenda:
      'Secretly operating the most lucrative underground pepper-smuggling ring in the province to satisfy the Abbot’s clandestine addiction to extra-spicy chili.',
    motto: 'Tepid is the path of tranquility.',
    primaryAsset: 'Vast monastery gardens full of rare root vegetables and extreme emotional detachment.',
    vulnerability: 'Can be bribed or thrown into utter moral distress with a bowl of hot onion soup.',
    leaderTitle: 'Abbot of the Steady Ladle',
    lieutenantTitle: 'Prior of the Room-Temperature Kettle',
  },
  {
    name: 'The Society of Sommelier Saboteurs',
    theme: 'comedic',
    archetype: 'High-Society Wine Infiltrators',
    publicFace:
      'An elite society of aristocratic gourmands and tasters who attend noble galas to evaluate and critique rare vintages.',
    hiddenAgenda:
      'Infiltrating banquets solely to swirl glasses with dramatic condescension and announce that the Duke’s prized vintage has "notes of existential dread and wet cellar rat."',
    motto: 'A palate without pity.',
    primaryAsset: 'Unrestricted social access to noble banquets and velvet cloaks with hidden decanters.',
    vulnerability: 'Physically unable to resist correcting anyone who mispronounces an imported vintage.',
    leaderTitle: 'Lord Grand Sniffer of the Barrel',
    lieutenantTitle: 'Senior Swirler of the Crimson Goblet',
  },
  {
    name: 'The Guild of Professional Nail-Stubbers',
    theme: 'comedic',
    archetype: 'Petty Saboteurs & Covert Annoyers',
    publicFace:
      'A nocturnal guild masquerading as quiet interior decorators and cabinetmakers offering discounted nighttime repair.',
    hiddenAgenda:
      'Taking high-paying contracts from bitter heirs to rearrange mansion footstools and wardrobes by precisely two inches under cover of darkness to guarantee bruised toes.',
    motto: 'Two inches to the left makes all the difference.',
    primaryAsset: 'Felt-lined slippers, silent leveling gauges, and encyclopedic blueprints of noble bedroom floors.',
    vulnerability: 'Floorboards that squeak loudly and overly observant guard hounds.',
    leaderTitle: 'Master of the Two-Inch Shift',
    lieutenantTitle: 'Shadow Operative of the Low Ottoman',
  },
  {
    name: 'The High Council of Sarcastic Applause',
    theme: 'comedic',
    archetype: 'Aristocratic Snobs & Cynics',
    publicFace:
      'An exclusive club of ultra-wealthy patricians and cultural patrons seated in the highest private box seats of the city amphitheater.',
    hiddenAgenda:
      'Financing political campaigns, private wars, and theatrical disasters exclusively for the supreme joy of delivering slow, synchronized, devastatingly patronizing balcony claps.',
    motto: 'Bravo. How utterly quaint.',
    primaryAsset: 'Outrageous inherited wealth, gold-rimmed opera spectacles, and immunity to embarrassment.',
    vulnerability: 'Despise being genuinely complimented or treated with sincere warmth.',
    leaderTitle: 'Doyen of the Single Eyebrow',
    lieutenantTitle: 'Chief Clapper of the Grand Tier',
  },
  {
    name: 'The Loyal Fellowship of the Misspelled Sigil',
    theme: 'comedic',
    archetype: 'Pedantic Scribes & Rune-Nits',
    publicFace:
      'A scholarly circle offering manuscript transcription, scroll restoration, and grammatical consulting for aspiring wizards.',
    hiddenAgenda:
      'Breaking into wizard towers at midnight not to steal grimoires, but to furiously correct misplaced apostrophes and missing commas on active demon-binding circles.',
    motto: 'The syntax of doom demands proper punctuation.',
    primaryAsset: 'Spectral erasers, enchanted red quills, and knowledge of obscure parchment watermarks.',
    vulnerability: 'Will pause in the middle of a deadly duel to argue about the Oxford comma.',
    leaderTitle: 'Arch-Grammarian of the Nether Glyphs',
    lieutenantTitle: 'Warden of the Semicolon',
  },
  {
    name: 'The Disgruntled Association of Minions & Henchmen',
    theme: 'comedic',
    archetype: 'Underworld Trade Union',
    publicFace:
      'An informal fellowship of torch-bearers, lair-sweepers, and trap-resetters meeting in back alleys.',
    hiddenAgenda:
      'Organizing strikes and workplace safety audits against evil overlords who fail to provide hazard pay for standing in front of crumbling stone idols.',
    motto: 'No death ray without ten-minute tea breaks.',
    primaryAsset: 'Master keys to secret passages in half the evil lairs and villain fortresses in the province.',
    vulnerability: 'Can be bought off with dental insurance and comfortable rubber-soled boots.',
    leaderTitle: 'Shop Steward of the Trapdoor Workers',
    lieutenantTitle: 'Organizer of Spiked Pit Maintenance',
  },

  // --- Simple Religions & Churches ---
  {
    name: 'Parish of the Hearth & Loaf',
    theme: 'churches',
    archetype: 'Community Chapel & Sanctuary',
    publicFace:
      'A modest town chapel providing warm soup, blessing harvest bins, and keeping a perpetual hearth fire lit for weary pilgrims and cold wanderers.',
    hiddenAgenda:
      'Sheltering undocumented refugees and deserters in the cellar beneath the flour silos, defying the provincial magistrate’s conscription levies.',
    motto: 'No stomach empty, no ember cold.',
    primaryAsset: 'Deep community trust, storehouses of salted grain, and the unconditional loyalty of local commoners.',
    vulnerability: 'Lacks martial power and is vulnerable to legal seizures by corrupt marshals.',
    leaderTitle: 'Elder Vicar of the Perpetual Hearth',
    lieutenantTitle: 'Curate of the Bread Bins',
  },
  {
    name: 'Sisters of the Pale Dawn',
    theme: 'churches',
    archetype: 'Hospice Sisterhood & Healers',
    publicFace:
      'White-cloaked mendicant herbalists tending to the sick, setting broken bones, and cleansing contaminated wells without asking for coin.',
    hiddenAgenda:
      'Administering gentle, painless poisons to irredeemably abusive warlords and tyrants under the guise of medicinal soothing draughts.',
    motto: 'Light enters where darkness softens.',
    primaryAsset: 'Encyclopedic botanical mastery, rare antitoxins, and immunity granted by grateful peasants.',
    vulnerability: 'Depleted supplies during sudden epidemics or military blockades.',
    leaderTitle: 'Mother Superior of the Dawn Bell',
    lieutenantTitle: 'Mistress of the Drying Herbs',
  },
  {
    name: 'Wardens of the Silent Soil',
    theme: 'churches',
    archetype: 'Cemetery Priesthood & Morticians',
    publicFace:
      'Grim, soft-spoken undertakers who conduct funeral rites, maintain burial grounds, and ensure departed souls rest undisturbed.',
    hiddenAgenda:
      'Secretly burning necrotic texts and exorcising restless spirits before nearby necromancers can harvest the catacombs.',
    motto: 'Dust to dust, and silence unbroken.',
    primaryAsset: 'Consecrated silver censers, ancient burial archives, and ward-stones buried deep in the bedrock.',
    vulnerability: 'Viewed with superstitious dread and avoided by townspeople until needed.',
    leaderTitle: 'High Sexton of the Final Gate',
    lieutenantTitle: 'Keeper of the Burial Register',
  },
  {
    name: 'The Riverside Baptists of the Silver Eel',
    theme: 'churches',
    archetype: 'Waterway Shrine & River Keepers',
    publicFace:
      'Barge-dwelling priests who bless fishing nets, forecast river tides, and perform baptisms in the rushing mountain waters.',
    hiddenAgenda:
      'Guarding a submerged sunken shrine containing a chained river abomination that feeds on negative emotions.',
    motto: 'Clear waters reflect true hearts.',
    primaryAsset: 'Fleet of agile skiffs and an intimate knowledge of hidden shoals and river currents.',
    vulnerability: 'Power is tied strictly to the watershed; weak and disoriented far inland.',
    leaderTitle: 'Riverward Patriarch',
    lieutenantTitle: 'Pilot of the Sacred Keel',
  },

  // --- Intrigue & Nobility ---
  {
    name: 'House Vane of the High Spires',
    theme: 'intrigue',
    archetype: 'Noble Dynasty & Court Patricians',
    publicFace:
      'An ancient aristocratic lineage that patrons fine arts, architectural monuments, and high court diplomacy.',
    hiddenAgenda:
      'Purchasing debt notes of surrounding barons to orchestrate a coordinated palace coup during the midsummer feast.',
    motto: 'Pride carved in white marble.',
    primaryAsset: 'Royal court favors, private retinue of rapier duelists, and ancestral silver mines.',
    vulnerability: 'Crippling familial paranoia; heirs regularly plot against each other.',
    leaderTitle: 'Patriarch of the High Spires',
    lieutenantTitle: 'Chancellor of Lineage & Ledgers',
  },
  {
    name: 'The Gilded Assembly',
    theme: 'intrigue',
    archetype: 'Merchant Cartel & Banking Oligarchy',
    publicFace:
      'A coalition of prominent merchant houses standardizing trade tariffs and currency exchange rates across the province.',
    hiddenAgenda:
      'Artificially inflating grain prices and bribing dock masters to manufacture artificial food shortages to break rival guilds.',
    motto: 'Gold speaks in every dialect.',
    primaryAsset: 'Immense liquid wealth, sovereign debt bonds, and contracts with elite foreign sellswords.',
    vulnerability: 'Entire operation collapses if ledgers detailing bribery of tax magistrates leak.',
    leaderTitle: 'Grand Overseer of the Coin Exchange',
    lieutenantTitle: 'Factotum of Private Tariffs',
  },
  {
    name: 'The Veiled Regency',
    theme: 'intrigue',
    archetype: 'Royal Bureaucrats & Shadow Diplomats',
    publicFace:
      'Chancellors and stewards managing kingdom decrees, property deeds, and royal petitions for the crown.',
    hiddenAgenda:
      'Controlling the flow of information to the ailing monarch, effectively ruling the realm from behind the tapestry.',
    motto: 'The quill governs the sword.',
    primaryAsset: 'Access to royal wax seals, imperial courier networks, and state secret archives.',
    vulnerability: 'Exposing the monarch’s true deteriorating condition would instantly spark civil war.',
    leaderTitle: 'Lord Chamberlain of the Seal',
    lieutenantTitle: 'Master of the Whispering Gallery',
  },

  // --- Underworld & Crime ---
  {
    name: 'The Obsidian Hand',
    theme: 'underworld',
    archetype: 'Thieves’ Guild & Black Market Syndicate',
    publicFace:
      'A supposedly mythical criminal rumor blamed by town guards for unresolved dockside burglaries.',
    hiddenAgenda:
      'Operating an extensive smuggling network through abandoned aqueducts, moving banned spell-components and stolen royal heirlooms.',
    motto: 'In darkness, we measure the city’s pulse.',
    primaryAsset: 'Underground labyrinth network, safehouses in every district, and corrupt watch officers.',
    vulnerability: 'Brutal internal power struggle between young blades and conservative old fences.',
    leaderTitle: 'Shadow Broker of the Aqueducts',
    lieutenantTitle: 'Captain of the Low Alley Cutpurses',
  },
  {
    name: 'The Fog-Walkers Smuggling Ring',
    theme: 'underworld',
    archetype: 'River Pirates & Harbor Smugglers',
    publicFace:
      'Licensed salvage divers and night-watch rivermen who retrieve lost cargo and rescue drifting boats.',
    hiddenAgenda:
      'Bypassing harbor customs by using trained giant river-rats to transport illicit contraband under harbor patrol hulls.',
    motto: 'Tides take all, fog keeps the rest.',
    primaryAsset: 'Caches hidden below the water line, silent rowboats, and underwater breathing magic.',
    vulnerability: 'Harbor beacon towers with true-seeing lenses completely compromise their routes.',
    leaderTitle: 'Harbormaster of the Mist',
    lieutenantTitle: 'Master Diver of the Sunken Cache',
  },
  {
    name: 'The Red Dagger Brotherhood',
    theme: 'underworld',
    archetype: 'Contract Assassins & Poison Brokers',
    publicFace:
      'A modest apothecary and funeral embalming business operating quietly on the town perimeter.',
    hiddenAgenda:
      'Conducting precision contract assassinations arranged through cryptic wanted-postings left in cemetery urns.',
    motto: 'Cold steel, quiet departure.',
    primaryAsset: 'Rare untraceable venom extracts and an anonymous courier dead-drop system.',
    vulnerability: 'Strict adherence to an ancient blood-code that forbids taking contracts against holy clerics.',
    leaderTitle: 'First Blade of the Red Ledger',
    lieutenantTitle: 'Alchemist of the Silent Phial',
  },

  // --- Arcane & Scholarly ---
  {
    name: 'The Loom of Secrets',
    theme: 'arcane',
    archetype: 'Occult Archivists & Diviners',
    publicFace:
      'A distinguished historical library and cartographic society cataloging old land surveys and historical battles.',
    hiddenAgenda:
      'Piecing together a shattered pre-cataclysm prophecy to predict the exact date the sun will darken for an hour.',
    motto: 'Threads unseen bind destiny.',
    primaryAsset: 'Pre-cataclysm astrological charts, scrying mirrors, and enchanted memory crystals.',
    vulnerability: 'Vulnerable to magical mind-wipes and sensitive to arcane dissonance.',
    leaderTitle: 'Arch-Weaver of the Star Maps',
    lieutenantTitle: 'Curator of Forbidden Tomes',
  },
  {
    name: 'The College of the Midnight Astrolabe',
    theme: 'arcane',
    archetype: 'Planar Researchers & Star-Mages',
    publicFace:
      'An observatory perched on high sea cliffs studying celestial movements, tides, and meteor showers.',
    hiddenAgenda:
      'Siphoning raw astral energy from a micro-rift in the upper observatory dome to build an artificial gate to the Astral Sea.',
    motto: 'Beyond the night, infinite gates.',
    primaryAsset: 'Massive brass telescope array and reservoirs of concentrated starlight mercury.',
    vulnerability: 'The astral rift is unstable and threatens to tear open if subjected to sonic thunder spells.',
    leaderTitle: 'Grand Astrologer of the High Spire',
    lieutenantTitle: 'Keeper of the Celestial Lens',
  },

  // --- Military & Enforcers ---
  {
    name: 'The Iron Vanguard',
    theme: 'military',
    archetype: 'Mercenary Company & Siege Specialists',
    publicFace:
      'A veteran sellsword legion offering caravan escort and fortress defense with ironclad discipline.',
    hiddenAgenda:
      'Preparing to betray their current noble contractor once their covert employer pays a triple bounty for the castle keys.',
    motto: 'Discipline forged in iron, paid in gold.',
    primaryAsset: 'Heavy war wagons, disciplined pikemen, and master dwarven crossbow engineers.',
    vulnerability: 'Mercenary morale plummets rapidly if payroll shipments are delayed or captured.',
    leaderTitle: 'Lord Commander of the Vanguard',
    lieutenantTitle: 'Marshal of the Iron Cohort',
  },
  {
    name: 'The Silver Griffin Watch',
    theme: 'military',
    archetype: 'Elite City Guard & Mounted Patrols',
    publicFace:
      'The armored elite protectors of the gates, marketplace, and public squares, upholding municipal law.',
    hiddenAgenda:
      'The high captains are quietly turning a blind eye to guild extortion in exchange for political backing to replace the civilian council.',
    motto: 'Ever vigilant, ever resolute.',
    primaryAsset: 'Full legal jurisdiction, fortified watchtowers, and trained war-griffins or mastiffs.',
    vulnerability: 'Deep resentment between underpaid rank-and-file guards and wealthy aristocratic commanders.',
    leaderTitle: 'High Captain of the Citadel Watch',
    lieutenantTitle: 'Watch Lieutenant of the Market Gate',
  },
];

// Central flashpoints / catalysts for multi-faction ecosystems
const CENTRAL_FLASHPOINTS: readonly CentralFlashpoint[] = [
  {
    title: 'The Murder of the High Magistrate',
    summary:
      'The city magistrate was found dead in his locked study with no heir named, leaving competing factions claiming lawful right to his estate, ledgers, and jurisdiction.',
    contestedResource: 'The Magistrate’s Private Safe & Council Seal',
    stakes: 'Whoever holds the seal commands the city watch and controls property taxes.',
  },
  {
    title: 'The Unearthed Aqueduct Vault',
    summary:
      'Workers repairing the south cistern broke through a false wall, exposing a buried pre-calamity vault containing sealed runic chests.',
    contestedResource: 'The Subterranean Vault & Forgotten Relics',
    stakes: 'Direct access to ancient magical artifacts and unmapped smuggler tunnels under the city.',
  },
  {
    title: 'The Great Grain Blockade',
    summary:
      'A sudden embargo and pirate blockade along the river has choked off grain shipments, causing bread prices to triple and riots to simmer in the lower districts.',
    contestedResource: 'Control of River Trade Routes & Food Warehouses',
    stakes: 'Widespread starvation or undisputed control over the local populace through food rationing.',
  },
  {
    title: 'The Stolen Imperial Tax Ledger',
    summary:
      'A ledger recording twenty years of illicit bribes, extortion, and secret royal bastards went missing during the autumn carnival.',
    contestedResource: 'The Black Tax Ledger',
    stakes: 'Absolute political blackmail over every merchant and noble in the realm.',
  },
  {
    title: 'The Absurd Bread-Crust Crisis',
    summary:
      'A decree by the city bakeries to trim triangular crusts has sparked an all-out municipal jurisdictional feud between regulators, bakers, and hungry citizens.',
    contestedResource: 'The Canonical Measurement Gauge of the Royal Crust',
    stakes: 'Municipal dignity, excessive paperwork, and the soul of afternoon tea.',
  },
  {
    title: 'The Awakening of the Catacomb Idol',
    summary:
      'An ancient stone idol began humming beneath the city cathedral, causing strange sleepwalking and dreams across the population.',
    contestedResource: 'The Chanting Idol of the Depths',
    stakes: 'Mass hypnosis or possession of the populace if the harmonic frequency is not contained.',
  },
];

const COMMON_ANCESTRIES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Gnome',
  'Tiefling',
  'Dragonborn',
  'Half-Elf',
  'Half-Orc',
];

const PERSONALITY_TRAITS = [
  'Meticulous and pedantic to a fault',
  'Charismatic with a razor-sharp smile',
  'Constantly glancing over their shoulder',
  'Blunt, unyielding, and utterly humorless',
  'Polite and courteous, masking cold ruthlessness',
  'Prone to theatrical outbursts of exasperation',
  'Patient as a stone, waiting for opponents to make a misstep',
  'Devoutly superstitious about door frames and bad omens',
];

const MOTIVATIONS = [
  'Secure total dominance over their rivals before the winter solstice.',
  'Cover up an unforgivable mistake that could ruin the faction’s reputation.',
  'Protect the common folk from being trampled by ruthless high-society games.',
  'Amass enough leverage to force a treaty on favorable terms.',
  'Expose the hypocrisy and hidden corruption of the governing authority.',
  'Preserve an ancient tradition against the encroaching tide of modern reform.',
];

// ============================================================================
// Core Generation Functions
// ============================================================================

/**
 * Generates an evocative key figure for a faction (leader, lieutenant, or specialist).
 */
export function generateKeyFigure(
  role: 'leader' | 'lieutenant' | 'specialist',
  customTitle?: string,
): GeneratedKeyFigure {
  const ancestry = pickRandom(COMMON_ANCESTRIES);
  const name = generateName({ race: ancestry.toLowerCase(), gender: 'any' }).name;

  return {
    name,
    title: customTitle || (role === 'leader' ? 'High Overseer' : 'Trusted Lieutenant'),
    role,
    ancestry,
    personality: pickRandom(PERSONALITY_TRAITS),
    motivation: pickRandom(MOTIVATIONS),
  };
}

/**
 * Generates a single faction based on the provided options or templates.
 */
export function generateSingleFaction(
  options: FactionGeneratorOptions = {},
  tempId = 'faction-temp-1',
): GeneratedFaction {
  const scope = options.scope || 'city';
  const theme = options.theme || 'all';

  let pool = FACTION_TEMPLATES;
  if (theme !== 'all') {
    const filtered = FACTION_TEMPLATES.filter((t) => t.theme === theme);
    if (filtered.length > 0) {
      pool = filtered;
    }
  }

  const template = pickRandom(pool);
  const keyFiguresMode = options.keyFiguresMode || 'leaders';

  const keyFigures: GeneratedKeyFigure[] = [];
  if (keyFiguresMode === 'leaders' || keyFiguresMode === 'full') {
    keyFigures.push(generateKeyFigure('leader', template.leaderTitle));
  }
  if (keyFiguresMode === 'full') {
    keyFigures.push(generateKeyFigure('lieutenant', template.lieutenantTitle));
  }

  // Determine initial party status
  const statusOptions: Array<'ally' | 'neutral' | 'opposition' | 'unknown'> = [
    'unknown',
    'neutral',
    'opposition',
    'ally',
  ];
  const status = pickRandom(statusOptions);

  return {
    tempId,
    name: template.name,
    archetype: template.archetype,
    theme: template.theme,
    scope,
    status,
    publicFace: template.publicFace,
    hiddenAgenda: template.hiddenAgenda,
    motto: template.motto,
    primaryAsset: template.primaryAsset,
    vulnerability: template.vulnerability,
    keyFigures,
    relationships: [],
  };
}

/**
 * Generates a pairwise relationship narrative between two factions.
 */
function createRelationshipPair(
  factionA: GeneratedFaction,
  factionB: GeneratedFaction,
  forcedType?: FactionRelationshipType,
): { aToB: FactionRelationship; bToA: FactionRelationship } {
  const types: FactionRelationshipType[] = [
    'ally',
    'rival',
    'uneasy-truce',
    'infiltrated',
    'transactional',
    'ambivalent',
    'distant',
    'ignorance',
    'willful-ignorance',
  ];

  // If comedic theme, bias toward comedic relationship dynamics
  const chosenType: FactionRelationshipType =
    forcedType ||
    (factionA.theme === 'comedic' || factionB.theme === 'comedic'
      ? pickRandom(['willful-ignorance', 'uneasy-truce', 'rival', 'transactional', 'ambivalent'])
      : pickRandom(types));

  let summaryA = '';
  let summaryB = '';

  switch (chosenType) {
    case 'ally':
      summaryA = `Allied with ${factionB.name} through mutual defense pacts and shared commercial interests.`;
      summaryB = `Allied with ${factionA.name}; coordinate security and share strategic intelligence.`;
      break;

    case 'rival':
      summaryA = `Bitter rivals with ${factionB.name} over turf, legal jurisdiction, and public influence.`;
      summaryB = `Actively undermines ${factionA.name}, seeking to ruin their reputation and claim their assets.`;
      break;

    case 'uneasy-truce':
      summaryA = `Maintains a tense cease-fire with ${factionB.name}; neither dares provoke open hostilities while hostages and trade remain tied.`;
      summaryB = `Observes an uneasy truce with ${factionA.name}, watching closely for any violation of their mutual boundary agreement.`;
      break;

    case 'infiltrated':
      summaryA = `Has covertly planted informants and agents within ${factionB.name} to monitor their hidden council.`;
      summaryB = `Unaware that ${factionA.name} is secretly manipulating their lower ranks and intercepting their courier reports.`;
      break;

    case 'transactional':
      summaryA = `Maintains strictly business transactions with ${factionB.name}; trades coin and favors when convenient, but holds zero loyalty.`;
      summaryB = `Views ${factionA.name} as a pragmatic source of resources; contracts are kept strictly at arm's length.`;
      break;

    case 'ambivalent':
      summaryA = `Indifferent to ${factionB.name}; their activities rarely intersect with our current agenda.`;
      summaryB = `Takes no active interest in ${factionA.name}, treating them as background noise in the district.`;
      break;

    case 'distant':
      summaryA = `Operates in an entirely separate sphere from ${factionB.name}; their leadership circles have never crossed paths.`;
      summaryB = `Has no communication or overlapping territory with ${factionA.name}.`;
      break;

    case 'ignorance':
      summaryA = `Completely oblivious to the quiet operations of ${factionB.name}.`;
      summaryB = `Has never heard of ${factionA.name}, dismissing any mention as unremarkable rumors.`;
      break;

    case 'willful-ignorance':
      summaryA = `Adamantly refuses to believe ${factionB.name} exists, officially dismissing all reports as drunken tavern myths or counterfeit hysteria.`;
      summaryB = `Thoroughly insulted that ${factionA.name} pretends they do not exist, frequently staging dramatic public stunts to prove their reality.`;
      break;
  }

  return {
    aToB: {
      targetTempId: factionB.tempId,
      targetFactionName: factionB.name,
      type: chosenType,
      summary: summaryA,
    },
    bToA: {
      targetTempId: factionA.tempId,
      targetFactionName: factionA.name,
      type: chosenType,
      summary: summaryB,
    },
  };
}

/**
 * Generates an interconnected web of 1 to 5+ factions with rich relationships and a shared central flashpoint.
 */
export function generateFactionWeb(
  options: FactionGeneratorOptions = {},
): FactionWebResult {
  const count = Math.max(1, Math.min(6, options.count !== undefined ? options.count : 3));
  const scope = options.scope || 'city';
  const theme = options.theme || 'all';
  const includeRelationships = options.includeRelationships !== false;

  // Filter templates by theme if specified
  let candidatePool = FACTION_TEMPLATES;
  if (theme !== 'all') {
    const filtered = FACTION_TEMPLATES.filter((t) => t.theme === theme);
    if (filtered.length >= count) {
      candidatePool = filtered;
    }
  }

  // Pick unique templates up to count (or reuse if count exceeds pool)
  const selectedTemplates = pickRandomCount(candidatePool, count);
  while (selectedTemplates.length < count) {
    selectedTemplates.push(pickRandom(candidatePool));
  }

  // Instantiate factions
  const factions: GeneratedFaction[] = selectedTemplates.map((template, index) => {
    const tempId = `faction-temp-${index + 1}`;
    const keyFiguresMode = options.keyFiguresMode || 'leaders';

    const keyFigures: GeneratedKeyFigure[] = [];
    if (keyFiguresMode === 'leaders' || keyFiguresMode === 'full') {
      keyFigures.push(generateKeyFigure('leader', template.leaderTitle));
    }
    if (keyFiguresMode === 'full') {
      keyFigures.push(generateKeyFigure('lieutenant', template.lieutenantTitle));
    }

    const statusOptions: Array<'ally' | 'neutral' | 'opposition' | 'unknown'> = [
      'unknown',
      'neutral',
      'opposition',
      'ally',
    ];
    const status = pickRandom(statusOptions);

    return {
      tempId,
      name: template.name,
      archetype: template.archetype,
      theme: template.theme,
      scope,
      status,
      publicFace: template.publicFace,
      hiddenAgenda: template.hiddenAgenda,
      motto: template.motto,
      primaryAsset: template.primaryAsset,
      vulnerability: template.vulnerability,
      keyFigures,
      relationships: [],
    };
  });

  // Central tension / flashpoint
  let flashpoint: CentralFlashpoint | undefined;
  if (count > 1) {
    if (options.customFlashpoint) {
      flashpoint = {
        title: 'Central Campaign Flashpoint',
        summary: options.customFlashpoint,
        contestedResource: 'Contested Ground / Influence',
        stakes: 'The immediate balance of power in the region.',
      };
    } else {
      // Pick flashpoint suited to theme
      let flashpointPool = CENTRAL_FLASHPOINTS;
      if (theme === 'comedic') {
        const comedicFlash = CENTRAL_FLASHPOINTS.filter((f) =>
          f.title.includes('Bread-Crust') || f.title.includes('Magistrate'),
        );
        if (comedicFlash.length > 0) flashpointPool = comedicFlash;
      }
      flashpoint = pickRandom(flashpointPool);
    }
  }

  // Interconnect factions if relationships enabled
  if (includeRelationships && factions.length > 1) {
    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        const { aToB, bToA } = createRelationshipPair(factions[i], factions[j]);
        factions[i].relationships.push(aToB);
        factions[j].relationships.push(bToA);
      }
    }
  }

  return {
    flashpoint,
    scope,
    theme,
    factions,
  };
}
