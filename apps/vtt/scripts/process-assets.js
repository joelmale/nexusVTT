#!/usr/bin/env node

/**
 * Universal Asset Processing Script
 *
 * This script processes various asset types and creates:
 * 1. Optimized WebP images for web usage
 * 2. Thumbnails for quick browsing
 * 3. Standardized folder structure
 * 4. A manifest.json with all asset metadata
 *
 * Usage:
 * node scripts/process-assets.js /path/to/your/assets /path/to/output
 */

import fs from "fs";
import path from "path";
import sharp from "sharp"; // npm install sharp
import crypto from "crypto";

const SUPPORTED_FORMATS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const THUMBNAIL_SIZE = 300;
const MAX_FULL_SIZE = 2048; // Max width/height for full images
const WEBP_QUALITY = 85;
const THUMBNAIL_QUALITY = 80;

// Standardized asset categories and subcategories
const ASSET_CATEGORIES = {
  maps: {
    name: "Maps",
    subcategories: [
      "dungeons",
      "cities",
      "wilderness",
      "interiors",
      "battlemaps",
    ],
    keywords: [
      "dungeon",
      "cave",
      "castle",
      "tower",
      "city",
      "village",
      "forest",
      "mountain",
      "desert",
      "swamp",
      "interior",
      "battle",
      "map",
    ],
  },
  tokens: {
    name: "Tokens",
    subcategories: ["characters", "monsters", "objects", "npcs"],
    keywords: [
      "token",
      "character",
      "monster",
      "npc",
      "creature",
      "object",
      "item",
      "player",
    ],
  },
  art: {
    name: "Art",
    subcategories: ["character", "scene", "concept", "portraits"],
    keywords: [
      "art",
      "character",
      "portrait",
      "scene",
      "concept",
      "illustration",
      "artwork",
    ],
  },
  handouts: {
    name: "Handouts",
    subcategories: ["documents", "letters", "notices", "maps"],
    keywords: [
      "handout",
      "document",
      "letter",
      "notice",
      "scroll",
      "paper",
      "note",
    ],
  },
  reference: {
    name: "Reference",
    subcategories: ["rules", "charts", "tables", "guides"],
    keywords: [
      "reference",
      "rule",
      "chart",
      "table",
      "guide",
      "help",
      "manual",
    ],
  },
};
class AssetProcessor {
  constructor(inputDir, outputDir) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.manifestPath = path.join(outputDir, "manifest.json");

    // Create standardized directory structure
    Object.keys(ASSET_CATEGORIES).forEach((categoryKey) => {
      const categoryName = ASSET_CATEGORIES[categoryKey].name;
      const categoryDir = path.join(outputDir, categoryName);
      const assetsDir = path.join(categoryDir, "assets");
      const thumbnailsDir = path.join(categoryDir, "thumbnails");

      [categoryDir, assetsDir, thumbnailsDir].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
    });
  }

  async processAssets() {
    console.log("🎨 Processing assets...");
    console.log(`📁 Input: ${this.inputDir}`);
    console.log(`📁 Output: ${this.outputDir}`);

    const assets = [];
    const files = this.getImageFiles(this.inputDir);

    console.log(`📊 Found ${files.length} image files`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(
        `📸 Processing ${i + 1}/${files.length}: ${path.basename(file)}`
      );

      try {
        const asset = await this.processAsset(file);
        if (asset) {
          assets.push(asset);
        }
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
      }
    }

    // Generate manifest
    const manifest = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      totalAssets: assets.length,
      categories: [...new Set(assets.map((a) => a.category))].sort(),
      subcategories: this.generateSubcategoryList(assets),
      assets: assets.sort((a, b) => a.name.localeCompare(b.name)),
    };

    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));

    console.log("✅ Asset processing complete!");
    console.log(`📊 Processed: ${assets.length} assets`);
    console.log(`📂 Categories: ${manifest.categories.join(", ")}`);
    console.log(`📄 Manifest: ${this.manifestPath}`);

    return manifest;
  }

  getImageFiles(dir) {
    const files = [];

    const scanDir = (currentDir) => {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          if (SUPPORTED_FORMATS.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    scanDir(dir);
    return files;
  }

  async processAsset(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);

    // Generate unique ID based on file path and modification time
    const id = crypto
      .createHash("md5")
      .update(filePath + stats.mtime.getTime())
      .digest("hex");

    // Determine category from folder structure and filename
    const relativePath = path.relative(this.inputDir, filePath);
    const pathParts = relativePath.split(path.sep);
    const category = this.determineCategory(pathParts, fileName);
    const subcategory = this.determineSubcategory(
      pathParts,
      fileName,
      category
    );

    try {
      // Get image metadata
      const image = sharp(filePath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        console.warn(`⚠️  Skipping ${fileName}: Invalid image metadata`);
        return null;
      }

      // Generate optimized full image
      const categoryName = ASSET_CATEGORIES[category]?.name || "Maps";
      const fullImageName = `${id}.webp`;
      const fullImagePath = path.join(
        this.outputDir,
        categoryName,
        "assets",
        fullImageName
      );

      await this.createOptimizedImage(filePath, fullImagePath, MAX_FULL_SIZE);

      // Generate thumbnail
      const thumbnailName = `${id}_thumb.webp`;
      const thumbnailPath = path.join(
        this.outputDir,
        categoryName,
        "thumbnails",
        thumbnailName
      );

      await this.createThumbnail(filePath, thumbnailPath);

      // Generate tags from filename and category
      const tags = this.generateTags(fileName, category, subcategory);

      const asset = {
        id,
        name: fileName
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        category: categoryName,
        subcategory,
        tags,
        thumbnail: `${categoryName}/thumbnails/${thumbnailName}`,
        fullImage: `${categoryName}/assets/${fullImageName}`,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
        },
        fileSize: stats.size,
        format: ext.replace(".", ""),
      };

      return asset;
    } catch (error) {
      console.error(`Error processing ${fileName}:`, error);
      return null;
    }
  }

  determineCategory(pathParts, fileName) {
    const firstFolder = pathParts[0]?.toLowerCase() || "";
    const lowerFileName = fileName.toLowerCase();

    // Check if first folder matches a known category
    for (const [categoryKey, categoryData] of Object.entries(
      ASSET_CATEGORIES
    )) {
      if (
        firstFolder.includes(categoryKey) ||
        firstFolder === categoryData.name.toLowerCase()
      ) {
        return categoryKey;
      }
    }

    // Check filename for category keywords
    for (const [categoryKey, categoryData] of Object.entries(
      ASSET_CATEGORIES
    )) {
      if (
        categoryData.keywords.some((keyword) => lowerFileName.includes(keyword))
      ) {
        return categoryKey;
      }
    }

    // Default to maps for backwards compatibility
    return "maps";
  }

  determineSubcategory(pathParts, fileName, category) {
    const categoryData = ASSET_CATEGORIES[category];
    if (!categoryData) return "general";

    const lowerFileName = fileName.toLowerCase();
    const lowerPathParts = pathParts.map((part) => part.toLowerCase());

    // Check if any path part matches a subcategory
    for (const subcategory of categoryData.subcategories) {
      if (lowerPathParts.some((part) => part.includes(subcategory))) {
        return subcategory;
      }
    }

    // Check filename for subcategory hints
    for (const subcategory of categoryData.subcategories) {
      if (lowerFileName.includes(subcategory)) {
        return subcategory;
      }
    }

    return "general";
  }

  async createOptimizedImage(inputPath, outputPath, maxSize) {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    let resizeOptions = {};

    if (metadata.width > maxSize || metadata.height > maxSize) {
      resizeOptions = {
        width: maxSize,
        height: maxSize,
        fit: "inside",
        withoutEnlargement: true,
      };
    }

    await image
      .resize(resizeOptions)
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);
  }

  async createThumbnail(inputPath, outputPath) {
    await sharp(inputPath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toFile(outputPath);
  }

  generateTags(fileName, category, subcategory) {
    const tags = [category];

    if (subcategory && subcategory !== "general") {
      tags.push(subcategory);
    }

    // Add category-specific keywords found in filename
    const categoryData = ASSET_CATEGORIES[category];
    if (categoryData) {
      const lowerFileName = fileName.toLowerCase();
      categoryData.keywords.forEach((keyword) => {
        if (lowerFileName.includes(keyword) && !tags.includes(keyword)) {
          tags.push(keyword);
        }
      });
    }

    return [...new Set(tags)];
  }

  generateSubcategoryList(assets) {
    const subcategories = {};

    assets.forEach((asset) => {
      if (!subcategories[asset.category]) {
        subcategories[asset.category] = new Set();
      }
      subcategories[asset.category].add(asset.subcategory);
    });

    // Convert Sets to Arrays
    Object.keys(subcategories).forEach((category) => {
      subcategories[category] = Array.from(subcategories[category]).sort();
    });

    return subcategories;
  }
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [, , inputDir, outputDir] = process.argv;

  if (!inputDir || !outputDir) {
    console.log(
      "Usage: node process-assets.js <input-directory> <output-directory>"
    );
    console.log("");
    console.log("Examples:");
    console.log(
      "  node process-assets.js /Volumes/PS2000w/DnD_Assets/maps ./static-assets/assets"
    );
    console.log(
      "  node process-assets.js /path/to/tokens ./static-assets/assets"
    );
    console.log(
      "  node process-assets.js /path/to/all-assets ./static-assets/assets"
    );
    console.log("");
    console.log("Supported categories: Maps, Tokens, Art, Handouts, Reference");
    console.log("Supported formats: JPG, PNG, WebP, GIF");
    process.exit(1);
  }

  if (!fs.existsSync(inputDir)) {
    console.error("❌ Input directory does not exist:", inputDir);
    process.exit(1);
  }

  const processor = new AssetProcessor(inputDir, outputDir);
  processor
    .processAssets()
    .then(() => {
      console.log("🎉 All done! Your assets are ready to use.");
    })
    .catch((error) => {
      console.error("❌ Processing failed:", error);
      process.exit(1);
    });
}

export { AssetProcessor };
