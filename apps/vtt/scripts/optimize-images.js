#!/usr/bin/env node
/**
 * Image Optimization Pipeline
 * Converts and optimizes images to WebP format and generates responsive sizes
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(__dirname, '../static-assets/assets');
const OUTPUT_DIR = path.join(__dirname, '../static-assets/assets-optimized');

// Responsive breakpoints for scene backgrounds
const SIZES = [800, 1600, 2400];

// Image quality settings
const WEBP_QUALITY = 80;
const PNG_QUALITY = 85;
const JPEG_QUALITY = 85;

/**
 * Process a single image file
 */
async function processImage(inputPath, relativePath) {
  const ext = path.extname(inputPath).toLowerCase();
  const basename = path.basename(inputPath, ext);
  const dirname = path.dirname(relativePath);

  // Skip if not an image
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return;
  }

  console.log(`📸 Processing: ${relativePath}`);

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Create output directory
    const outputDir = path.join(OUTPUT_DIR, dirname);
    await fs.mkdir(outputDir, { recursive: true });

    // Original format optimization
    const originalOutput = path.join(outputDir, `${basename}${ext}`);
    if (ext === '.png') {
      await image
        .png({ quality: PNG_QUALITY, compressionLevel: 9 })
        .toFile(originalOutput);
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      await image
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toFile(originalOutput);
    } else {
      // Copy WebP as-is (already optimized)
      await fs.copyFile(inputPath, originalOutput);
    }

    // Generate WebP version
    const webpOutput = path.join(outputDir, `${basename}.webp`);
    await image
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpOutput);

    // Generate responsive sizes for large images (> 1000px wide)
    if (metadata.width && metadata.width > 1000) {
      for (const size of SIZES) {
        if (size < metadata.width) {
          const resizedOutput = path.join(outputDir, `${basename}-${size}w.webp`);
          await sharp(inputPath)
            .resize(size, null, { withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toFile(resizedOutput);

          console.log(`  ✓ Generated ${size}w variant`);
        }
      }
    }

    // Get file sizes for logging
    const originalStats = await fs.stat(inputPath);
    const webpStats = await fs.stat(webpOutput);
    const savings = ((1 - webpStats.size / originalStats.size) * 100).toFixed(1);

    console.log(`  ✓ WebP: ${(webpStats.size / 1024).toFixed(1)}KB (${savings}% smaller)`);
  } catch (error) {
    console.error(`  ✗ Error processing ${relativePath}:`, error.message);
  }
}

/**
 * Recursively process all images in a directory
 */
async function processDirectory(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      await processDirectory(fullPath, baseDir);
    } else if (entry.isFile()) {
      await processImage(fullPath, relativePath);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🎨 Image Optimization Pipeline');
  console.log('================================\n');

  // Check if input directory exists
  try {
    await fs.access(INPUT_DIR);
  } catch {
    console.error(`❌ Input directory not found: ${INPUT_DIR}`);
    process.exit(1);
  }

  // Clean output directory
  try {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist, that's fine
  }

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Process all images
  const startTime = Date.now();
  await processDirectory(INPUT_DIR);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✅ Optimization complete in ${duration}s`);
  console.log(`📁 Optimized images saved to: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
