import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const svgSource = path.join(projectRoot, 'public', 'nexus-icon.svg');

const targets = [
  // Root icons
  { dest: path.join(projectRoot, 'public', 'nexus-icon.png'), size: 512 },
  { dest: path.join(projectRoot, 'public', 'nexus-icon-192.png'), size: 192 },
  
  // Asset icons
  { dest: path.join(projectRoot, 'public', 'assets', 'icons', 'nexus-icon.png'), size: 512 },
  { dest: path.join(projectRoot, 'public', 'assets', 'icons', 'nexus-icon-512.png'), size: 512 },
  { dest: path.join(projectRoot, 'public', 'assets', 'icons', 'nexus-icon-192.png'), size: 192 },
  { dest: path.join(projectRoot, 'public', 'assets', 'icons', 'nexus-favicon.png'), size: 32 },
];

async function generate() {
  if (!fs.existsSync(svgSource)) {
    console.error(`❌ Source SVG not found at ${svgSource}`);
    process.exit(1);
  }

  console.log(`🎨 Generating PNG icons from ${svgSource}...`);

  for (const target of targets) {
    try {
      const destDir = path.dirname(target.dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      await sharp(svgSource)
        .resize(target.size, target.size)
        .png()
        .toFile(target.dest);

      console.log(`✅ Generated ${target.size}x${target.size} → ${path.relative(projectRoot, target.dest)}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${target.dest}:`, error);
    }
  }

  console.log('🎉 Brand icon generation completed!');
}

generate();
