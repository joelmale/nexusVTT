#!/usr/bin/env node

/**
 * Generate thumbnail images for default assets
 * Creates smaller preview versions for faster loading
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULTS_DIR = path.join(__dirname, '../public/assets/defaults');
const THUMBNAIL_WIDTH = 400; // Max width for thumbnails
const THUMBNAIL_QUALITY = 80; // JPEG quality (1-100)

/**
 * Generate thumbnail for an image
 */
async function generateThumbnail(imagePath, outputPath) {
  try {
    await sharp(imagePath)
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toFile(outputPath);

    const inputStats = fs.statSync(imagePath);
    const outputStats = fs.statSync(outputPath);
    const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);

    console.log(`  ✓ ${path.basename(imagePath)} (${savings}% smaller)`);
  } catch (error) {
    console.error(`  ✗ Failed to generate thumbnail for ${path.basename(imagePath)}:`, error.message);
  }
}

/**
 * Process all images in a directory
 */
async function processDirectory(dir, thumbnailsDir) {
  const files = fs.readdirSync(dir);
  let count = 0;

  for (const file of files) {
    if (file.startsWith('.')) continue;

    // Skip thumbnail files and thumbnails directory
    if (file.includes('.thumb.') || file === 'thumbnails') continue;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subThumbnailsDir = path.join(thumbnailsDir, file);
      if (!fs.existsSync(subThumbnailsDir)) {
        fs.mkdirSync(subThumbnailsDir, { recursive: true });
      }
      count += await processDirectory(fullPath, subThumbnailsDir);
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(file)) {
      const outputFilename = file.replace(/\.(png|jpg|jpeg|webp)$/i, '.thumb.jpg');
      const outputPath = path.join(thumbnailsDir, outputFilename);

      await generateThumbnail(fullPath, outputPath);
      count++;
    }
  }

  return count;
}

/**
 * Main function
 */
async function main() {
  console.log('Generating thumbnails for default assets...\n');

  // Create thumbnails directories
  const tokensThumbnailsDir = path.join(DEFAULTS_DIR, 'tokens', 'thumbnails');
  const mapsThumbnailsDir = path.join(DEFAULTS_DIR, 'base_maps', 'thumbnails');

  if (!fs.existsSync(tokensThumbnailsDir)) {
    fs.mkdirSync(tokensThumbnailsDir, { recursive: true });
  }
  if (!fs.existsSync(mapsThumbnailsDir)) {
    fs.mkdirSync(mapsThumbnailsDir, { recursive: true });
  }

  // Process tokens
  const tokensDir = path.join(DEFAULTS_DIR, 'tokens');
  if (fs.existsSync(tokensDir)) {
    console.log('Processing tokens...');
    const tokenCount = await processDirectory(tokensDir, tokensThumbnailsDir);
    console.log(`✅ Generated ${tokenCount} token thumbnails\n`);
  }

  // Process maps
  const mapsDir = path.join(DEFAULTS_DIR, 'base_maps');
  if (fs.existsSync(mapsDir)) {
    console.log('Processing base maps...');
    const mapCount = await processDirectory(mapsDir, mapsThumbnailsDir);
    console.log(`✅ Generated ${mapCount} map thumbnails\n`);
  }

  console.log('🎉 Thumbnail generation complete!');
  console.log(`   Thumbnail size: ${THUMBNAIL_WIDTH}px max width`);
  console.log(`   Quality: ${THUMBNAIL_QUALITY}%`);
}

// Run
main().catch((error) => {
  console.error('❌ Error generating thumbnails:', error);
  process.exit(1);
});
