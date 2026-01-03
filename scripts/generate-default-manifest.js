#!/usr/bin/env node

/**
 * Generate manifest.json for default bundled assets
 * Scans public/assets/defaults/ and creates metadata
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULTS_DIR = path.join(__dirname, '../public/assets/defaults');
const OUTPUT_FILE = path.join(DEFAULTS_DIR, 'manifest.json');

// Token name patterns for classification
const TOKEN_PATTERNS = {
  pc: /^(Human|Elf|Dwarf|Halfling|Gnome|Dragonborn|Tiefling|HalfElf|HalfOrc|Orc).*?(Fighter|Wizard|Cleric|Rogue|Ranger|Paladin|Barbarian|Bard|Druid|Monk|Sorcerer|Warlock|Artificer)/i,
  monster:
    /^(Goblin|Orc|Dragon|Skeleton|Zombie|Troll|Giant|Demon|Devil|Beast)/i,
  npc: /^(Soldier|Guard|Merchant|Noble|Peasant|Priest|Cultist)/i,
};

const SIZE_PATTERNS = {
  tiny: /tiny/i,
  small: /(small|halfling|gnome|goblin)/i,
  medium:
    /(human|elf|dwarf|fighter|wizard|cleric|rogue|ranger|paladin|soldier)/i,
  large: /(large|ogre|troll)/i,
  huge: /(huge|giant)/i,
  gargantuan: /(gargantuan|dragon|colossal)/i,
};

const MAP_CATEGORY_PATTERNS = {
  // Underground, confined, dangerous locations (checked first for specificity)
  dungeon: /(dungeon|cave|cavern|grotto|crypt|tomb|catacombs|mine|mines|sewer|sewers|underground|undervault|vault|chamber|lair|den|cells|torture|prison)/i,

  // Buildings and fully enclosed structures (checked second)
  indoor: /(tavern|inn|house|manor|temple|shrine|church|cathedral|shop|store|guild|workshop|library|armory|barracks|winery|brewery|warehouse|jail|hall)/i,

  // Settlements, military installations, city features (checked third)
  urban: /(city|town|village|street|alley|avenue|boulevard|square|plaza|marketplace|market|dock|docks|wharf|port|harbor|arena|amphitheater|stadium|fort|fortress|castle|courtyard|battlements|walls|gates|tower|citadel|carnival|fair|festival|canal)/i,

  // Natural and open areas (checked last, also serves as fallback via default)
  outdoor: /(forest|woods|woodland|jungle|grove|glade|field|meadow|plains|grassland|tundra|desert|mountain|mountains|hill|hills|cliff|cliffside|valley|canyon|camp|encampment|wilderness|clearing|path|trail|road|beach|shore|coast|seaside|ocean|sea|bay|cove|reef|river|stream|creek|waterfall|lake|lakeside|pond|billabong|swamp|marsh|bog|wetland|island|astral|bridge|pass|park|observatory|ruins|ancient)/i,
};

/**
 * Extract token metadata from filename
 */
function parseTokenName(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));

  // Determine category
  let category = 'pc';
  for (const [cat, pattern] of Object.entries(TOKEN_PATTERNS)) {
    if (pattern.test(nameWithoutExt)) {
      category = cat;
      break;
    }
  }

  // Determine size
  let size = 'medium';
  for (const [sz, pattern] of Object.entries(SIZE_PATTERNS)) {
    if (pattern.test(nameWithoutExt)) {
      size = sz;
      break;
    }
  }

  // Extract tags from name
  const tags = nameWithoutExt
    .replace(/([A-Z])/g, ' $1') // Split camelCase
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((tag) => tag.length > 2);

  return {
    name: nameWithoutExt.replace(/([A-Z])/g, ' $1').trim(),
    category,
    size,
    tags: [...new Set(tags)],
  };
}

// Common noise words to filter from tags
const COMMON_NOISE_WORDS = new Set([
  'the',
  'and',
  'base',
  'map',
  'day',
  'night',
  'top',
  'bottom',
  'dpi',
  'vtt',
  'free',
  'empty',
  'open',
  'clear',
  'main',
  'spring',
  'summer',
  'fall',
  'winter',
  'blue',
  'red',
  'green',
  'star',
]);

/**
 * Extract map metadata from filename
 */
function parseMapName(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));

  // Extract dimensions if present (e.g., "44x32" or "[50x65]")
  const dimensionMatch = nameWithoutExt.match(/\[?(\d+)x(\d+)\]?/);
  const gridSize = dimensionMatch
    ? {
        width: parseInt(dimensionMatch[1]),
        height: parseInt(dimensionMatch[2]),
      }
    : null;

  // Determine category
  let category = 'outdoor'; // default
  for (const [cat, pattern] of Object.entries(MAP_CATEGORY_PATTERNS)) {
    if (pattern.test(nameWithoutExt)) {
      category = cat;
      break;
    }
  }

  // Extract tags with improved filtering
  const tags = nameWithoutExt
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((tag) => {
      // Remove grid dimensions (e.g., "44x32")
      if (/^\d+x\d+$/.test(tag)) return false;

      // Remove standalone numbers (e.g., "10", "21")
      if (/^\d+$/.test(tag)) return false;

      // Remove very short tags, but allow tags with numbers like "dos2"
      if (tag.length <= 2 && !/\d/.test(tag)) return false;

      // Remove common noise words
      if (COMMON_NOISE_WORDS.has(tag)) return false;

      // Remove single letters followed by numbers in brackets (e.g., "1" from "[25x25](1)")
      if (tag.length === 1) return false;

      return true;
    });

  return {
    name: nameWithoutExt.replace(/_/g, ' ').replace(/ - /g, ' - '),
    category,
    gridSize,
    tags: [...new Set(tags)], // Remove duplicates
  };
}

/**
 * Scan directory for image files
 */
function scanDirectory(dir, baseDir, type) {
  const items = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (file.startsWith('.')) continue;

    // Skip thumbnails directory and thumbnail files
    if (file === 'thumbnails' || file.includes('.thumb.')) continue;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      items.push(...scanDirectory(fullPath, baseDir, type));
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(file)) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const ext = path.extname(file).toLowerCase().substring(1);

      let metadata;
      if (type === 'token') {
        metadata = parseTokenName(file);
      } else if (type === 'map') {
        metadata = parseMapName(file);
      }

      // Check for thumbnail
      const thumbnailFilename = file.replace(/\.(png|jpg|jpeg|webp)$/i, '.thumb.jpg');
      const thumbnailPath = path.join(path.dirname(fullPath), 'thumbnails', thumbnailFilename);
      const hasThumbnail = fs.existsSync(thumbnailPath);
      const thumbnailRelativePath = hasThumbnail
        ? path.relative(baseDir, thumbnailPath).replace(/\\/g, '/')
        : null;

      items.push({
        id: `default-${type}-${items.length + 1}`,
        type,
        ...metadata,
        path: `/assets/defaults/${relativePath}`,
        thumbnail: thumbnailRelativePath ? `/assets/defaults/${thumbnailRelativePath}` : undefined,
        format: ext,
        isDefault: true,
      });
    }
  }

  return items;
}

/**
 * Generate manifest
 */
function generateManifest() {
  console.log('Generating default asset manifest...');

  const tokensDir = path.join(DEFAULTS_DIR, 'tokens');
  const mapsDir = path.join(DEFAULTS_DIR, 'base_maps');

  const tokens = fs.existsSync(tokensDir)
    ? scanDirectory(tokensDir, DEFAULTS_DIR, 'token')
    : [];

  const maps = fs.existsSync(mapsDir)
    ? scanDirectory(mapsDir, DEFAULTS_DIR, 'map')
    : [];

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalAssets: tokens.length + maps.length,
    tokens: {
      count: tokens.length,
      items: tokens,
    },
    maps: {
      count: maps.length,
      items: maps,
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

  console.log(`✅ Manifest generated successfully!`);
  console.log(`   Tokens: ${tokens.length}`);
  console.log(`   Maps: ${maps.length}`);
  console.log(`   Output: ${OUTPUT_FILE}`);
}

// Run
try {
  generateManifest();
} catch (error) {
  console.error('❌ Error generating manifest:', error);
  process.exit(1);
}
