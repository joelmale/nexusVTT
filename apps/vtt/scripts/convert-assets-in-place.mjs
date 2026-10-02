import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const TARGET_DIR = process.argv[2] || 'G:\\My Drive\\06_Gaming & Creative\\D&D & Tabletop\\Assets';
const CONCURRENCY = 4;
const WEBP_QUALITY = 85;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function findImagesToConvert(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findImagesToConvert(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.warn(`[WARN] Could not read dir ${dir}: ${err.message}`);
  }

  return results;
}

async function convertFile(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const targetWebpPath = path.join(dir, `${baseName}.webp`);

  let originalSize = 0;
  try {
    const originalStat = fs.statSync(filePath);
    originalSize = originalStat.size;

    // Check if target webp already exists and is valid
    if (fs.existsSync(targetWebpPath)) {
      try {
        const existingBuf = fs.readFileSync(targetWebpPath);
        const existingMeta = await sharp(existingBuf).metadata();
        if (existingMeta && existingMeta.width > 0 && existingMeta.height > 0) {
          fs.unlinkSync(filePath);
          return {
            status: 'already_existed',
            path: filePath,
            originalSize,
            newSize: existingBuf.length,
            savedBytes: originalSize - existingBuf.length,
          };
        }
      } catch (_) {
        // Existing webp corrupted; continue to overwrite
      }
    }

    // Read full file into memory to avoid any Windows file locking
    const inputBuffer = fs.readFileSync(filePath);

    // Convert in memory
    const outputBuffer = await sharp(inputBuffer)
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    // Verify in memory
    const meta = await sharp(outputBuffer).metadata();
    if (!meta || meta.format !== 'webp' || !meta.width || !meta.height) {
      throw new Error('WebP verification failed: invalid metadata');
    }
    if (outputBuffer.length === 0) {
      throw new Error('WebP verification failed: 0 bytes generated');
    }

    // Write directly to destination
    fs.writeFileSync(targetWebpPath, outputBuffer);

    // Verified: safely remove original
    fs.unlinkSync(filePath);

    return {
      status: 'converted',
      path: filePath,
      originalSize,
      newSize: outputBuffer.length,
      savedBytes: originalSize - outputBuffer.length,
    };
  } catch (error) {
    return {
      status: 'failed',
      path: filePath,
      error: error.message,
      originalSize,
      newSize: originalSize,
      savedBytes: 0,
    };
  }
}

async function runPool(items, limit, fn, onProgress) {
  const results = [];
  let index = 0;
  let activeCount = 0;

  return new Promise((resolve) => {
    function next() {
      while (activeCount < limit && index < items.length) {
        const itemIndex = index++;
        activeCount++;
        fn(items[itemIndex]).then((res) => {
          results[itemIndex] = res;
          activeCount--;
          if (onProgress) onProgress(res, results.filter(Boolean).length, items.length);
          if (results.filter(Boolean).length === items.length) {
            resolve(results);
          } else {
            next();
          }
        });
      }
    }
    next();
  });
}

async function main() {
  console.log(`=======================================================`);
  console.log(`Nexus VTT Asset In-Place WebP Converter & Optimizer`);
  console.log(`Target directory: ${TARGET_DIR}`);
  console.log(`=======================================================`);

  if (!fs.existsSync(TARGET_DIR)) {
    console.error(`Error: Directory not found: ${TARGET_DIR}`);
    process.exit(1);
  }

  console.log(`Scanning for .png, .jpg, .jpeg files...`);
  const files = findImagesToConvert(TARGET_DIR);
  console.log(`Found ${files.length} images to convert.`);

  if (files.length === 0) {
    console.log(`No images needing conversion. Everything is already WebP!`);
    return;
  }

  let totalOriginal = 0;
  let totalNew = 0;
  let totalConverted = 0;
  let totalAlreadyExisted = 0;
  let totalFailed = 0;
  let lastLogTime = Date.now();

  await runPool(files, CONCURRENCY, convertFile, (res, completed, total) => {
    if (res.status === 'converted') {
      totalConverted++;
      totalOriginal += res.originalSize;
      totalNew += res.newSize;
    } else if (res.status === 'already_existed') {
      totalAlreadyExisted++;
      totalOriginal += res.originalSize;
      totalNew += res.newSize;
    } else if (res.status === 'failed') {
      totalFailed++;
      console.warn(`[WARN] Failed to convert ${path.basename(res.path)}: ${res.error}`);
    }

    const now = Date.now();
    if (completed % 50 === 0 || completed === total || now - lastLogTime > 4000) {
      lastLogTime = now;
      const pct = ((completed / total) * 100).toFixed(1);
      const saved = totalOriginal - totalNew;
      console.log(
        `[${completed}/${total}] (${pct}%) Converted: ${totalConverted}, Skipped/Cleaned: ${totalAlreadyExisted}, Failed: ${totalFailed} | Space saved: ${formatBytes(saved)}`
      );
    }
  });

  const finalSaved = totalOriginal - totalNew;
  console.log(`\n=======================================================`);
  console.log(`Conversion Complete!`);
  console.log(`Total images processed: ${files.length}`);
  console.log(`Successfully converted: ${totalConverted}`);
  console.log(`Redundant originals cleaned: ${totalAlreadyExisted}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Original size: ${formatBytes(totalOriginal)}`);
  console.log(`Optimized WebP size: ${formatBytes(totalNew)}`);
  console.log(`Total disk space reclaimed: ${formatBytes(finalSaved)} (${totalOriginal > 0 ? ((finalSaved / totalOriginal) * 100).toFixed(1) : 0}% reduction)`);
  console.log(`=======================================================`);
}

main().catch((err) => {
  console.error('Fatal error during conversion:', err);
  process.exit(1);
});
