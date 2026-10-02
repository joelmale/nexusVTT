import fs from 'fs';
import path from 'path';

const SOURCE_DIR = process.argv[2] || 'G:\\My Drive\\06_Gaming & Creative\\D&D & Tabletop\\Assets';
const DEST_DIR = path.resolve('public/assets/defaults/base_maps');

const EXCLUDE_DIR_REGEX = /Tokens|Furniture|Symbols|Wonderdraft|Assets - 300|Assets - 70|Assets - 72|Assets - 150|Map Assets|Roll20|Carts Carriages|Highres/i;

function cleanMapName(filePath) {
  const dirName = path.basename(path.dirname(filePath));
  let baseName = path.basename(filePath, path.extname(filePath));

  // If the file is just something generic like "Map", use the parent folder name
  if (/^map$/i.test(baseName)) {
    baseName = dirName;
  }

  // Handle floor numbering: "GeneralGoodsStoreFloor1" -> "General Goods Store - Floor 1"
  baseName = baseName.replace(/Floor\s*(\d+)/i, ' - Floor $1');

  // Insert space before capital letters if CamelCase and not all caps
  baseName = baseName.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Normalize dashes and spaces
  baseName = baseName
    .replace(/[_\s]+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .trim();

  // If the name doesn't include the folder context and the folder is meaningful, prefix it
  // e.g. folder "Haunted Mansion", file "Cellar" -> "Haunted Mansion - Cellar"
  const folderClean = dirName.replace(/[_\s]+/g, ' ').trim();
  if (
    !baseName.toLowerCase().includes(folderClean.toLowerCase()) &&
    !['map (by 2-minute table top)', 'maps', 'highres', 'roll20', '300 dpi', 'cave'].includes(dirName.toLowerCase())
  ) {
    // If baseName is generic or short, prefix with folder name
    if (baseName.length < 25 && !baseName.toLowerCase().startsWith(folderClean.toLowerCase().slice(0, 5))) {
      baseName = `${folderClean} - ${baseName}`;
    }
  }

  return `${baseName}.webp`;
}

function findBattleMaps(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIR_REGEX.test(entry.name)) {
        results.push(...findBattleMaps(fullPath));
      }
    } else if (entry.isFile()) {
      if (path.extname(entry.name).toLowerCase() === '.webp') {
        const stat = fs.statSync(fullPath);
        // Battle maps are generally > 120KB in WebP
        if (stat.size > 120 * 1024) {
          results.push({ fullPath, size: stat.size });
        }
      }
    }
  }

  return results;
}

async function main() {
  console.log('Scanning for battle maps in:', SOURCE_DIR);
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('Source directory does not exist!');
    process.exit(1);
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });

  const maps = findBattleMaps(SOURCE_DIR);
  console.log(`Discovered ${maps.length} candidate battle maps.`);

  let imported = 0;
  let skipped = 0;

  for (const map of maps) {
    const cleanName = cleanMapName(map.fullPath);
    const destPath = path.join(DEST_DIR, cleanName);

    if (fs.existsSync(destPath)) {
      skipped++;
      continue;
    }

    fs.copyFileSync(map.fullPath, destPath);
    imported++;
  }

  console.log(`\nImport Summary:`);
  console.log(`  Newly imported: ${imported}`);
  console.log(`  Already existed / skipped: ${skipped}`);
  console.log(`  Total in ${DEST_DIR}: ${fs.readdirSync(DEST_DIR).filter(f => f.endsWith('.webp')).length}`);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
