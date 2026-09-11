#!/usr/bin/env tsx

/**
 * Import D&D 5e SRD data from 5e-bits/5e-database repository
 *
 * Usage:
 *   npm run import:5e-srd                    # Import all content types
 *   npm run import:5e-srd -- --dry-run       # Preview without writing to database
 *   npm run import:5e-srd -- --types spells,monsters  # Import specific types only
 *   npm run import:5e-srd -- --repo-path ./my-5e-database  # Use existing clone
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../services/database.service';
import { elasticService } from '../services/elastic.service';
import { getParser, getSupportedContentTypes } from './parsers';

// Command line argument parsing
interface ImportOptions {
  dryRun: boolean;
  repoPath?: string;
  types?: string[];
  verbose: boolean;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--repo-path':
        options.repoPath = args[++i];
        break;
      case '--types':
        options.types = args[++i].split(',').map(t => t.trim());
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
D&D 5e SRD Import Script

Usage:
  npm run import:5e-srd [options]

Options:
  --dry-run            Preview import without writing to database
  --repo-path <path>   Use existing repository clone instead of cloning
  --types <types>      Comma-separated list of content types to import
                       Example: --types spells,monsters,equipment
  --verbose, -v        Show detailed logging
  --help, -h           Show this help message

Examples:
  npm run import:5e-srd
  npm run import:5e-srd -- --dry-run
  npm run import:5e-srd -- --types spells,monsters
  npm run import:5e-srd -- --repo-path ./5e-database --verbose

Supported Content Types:
  ${getSupportedContentTypes().join(', ')}
`);
}

// Main import logic
class SRDImporter {
  private options: ImportOptions;
  private stats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  constructor(options: ImportOptions) {
    this.options = options;
  }

  async run() {
    console.log('🚀 Starting D&D 5e SRD Import\n');

    if (this.options.dryRun) {
      console.log('⚠️  DRY RUN MODE - No database changes will be made\n');
    }

    try {
      // Step 1: Get or clone repository
      const repoPath = await this.getRepository();

      // Step 2: Find all JSON data files
      const dataFiles = this.findDataFiles(repoPath);
      console.log(`\n📁 Found ${dataFiles.length} data files\n`);

      // Step 3: Import each file
      for (const file of dataFiles) {
        await this.importFile(file);
      }

      // Step 4: Print summary
      this.printSummary();

      // Cleanup temp directory if we cloned
      if (!this.options.repoPath && repoPath.includes('tmp')) {
        console.log('\n🧹 Cleaning up temporary files...');
        execSync(`rm -rf ${repoPath}`);
      }

      console.log('\n✅ Import complete!');
      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ Import failed:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  private async getRepository(): Promise<string> {
    if (this.options.repoPath) {
      console.log(`📂 Using existing repository: ${this.options.repoPath}`);
      return this.options.repoPath;
    }

    console.log('📥 Cloning 5e-database repository...');
    const tmpDir = `/tmp/5e-database-${Date.now()}`;

    try {
      execSync(
        `git clone --depth 1 https://github.com/5e-bits/5e-database.git ${tmpDir}`,
        { stdio: this.options.verbose ? 'inherit' : 'pipe' }
      );
      console.log(`✅ Repository cloned to ${tmpDir}`);
      return tmpDir;
    } catch (error) {
      throw new Error('Failed to clone repository. Make sure git is installed.');
    }
  }

  private findDataFiles(repoPath: string): Array<{ contentType: string; path: string }> {
    // The 2014 SRD data is in src/2014/ subdirectory
    const srcDir = path.join(repoPath, 'src', '2014');

    if (!fs.existsSync(srcDir)) {
      throw new Error(`Source directory not found: ${srcDir}`);
    }

    const files: Array<{ contentType: string; path: string }> = [];
    const entries = fs.readdirSync(srcDir);

    for (const entry of entries) {
      const fullPath = path.join(srcDir, entry);

      // Look for JSON files with 5e-SRD- prefix
      if (entry.startsWith('5e-SRD-') && entry.endsWith('.json')) {
        const contentType = entry
          .replace('5e-SRD-', '')
          .replace('.json', '')
          .toLowerCase();

        // Filter by requested types if specified
        if (this.options.types && !this.options.types.includes(contentType)) {
          continue;
        }

        files.push({ contentType, path: fullPath });
      }
    }

    return files;
  }

  private async importFile(file: { contentType: string; path: string }) {
    console.log(`\n📄 Importing ${file.contentType}...`);

    try {
      // Read and parse JSON
      const rawData = fs.readFileSync(file.path, 'utf-8');
      const jsonData = JSON.parse(rawData);

      // Data is usually an array, but might be an object with results
      const items = Array.isArray(jsonData) ? jsonData : (jsonData.results || []);

      if (items.length === 0) {
        console.log(`  ⚠️  No items found in ${file.contentType}`);
        return;
      }

      console.log(`  Found ${items.length} items`);

      // Get appropriate parser
      const parser = getParser(file.contentType);

      // Process each item
      for (const item of items) {
        await this.importItem(item, parser);
      }

      console.log(`  ✅ Completed ${file.contentType}`);
    } catch (error: any) {
      console.error(`  ❌ Error importing ${file.contentType}:`, error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      this.stats.errors++;
    }
  }

  private async importItem(rawData: any, parser: any) {
    this.stats.total++;

    try {
      // Parse the item
      const parsed = parser.parse(rawData);

      if (this.options.verbose) {
        console.log(`    Processing: ${parsed.title}`);
      }

      if (this.options.dryRun) {
        console.log(`    [DRY RUN] Would create: ${parsed.title}`);
        this.stats.created++;
        return;
      }

      // Check if document already exists (by title and type)
      const existing = await prisma.document.findFirst({
        where: {
          title: parsed.title,
          type: 'srd_content',
        },
        include: {
          structuredData: true,
        },
      });

      if (existing) {
        // Update existing document
        await prisma.document.update({
          where: { id: existing.id },
          data: {
            description: parsed.description,
            tags: parsed.tags,
            metadata: parsed.metadata,
            lastModified: new Date(),
          },
        });

        // Update structured data
        if (existing.structuredData.length > 0) {
          await prisma.structuredData.update({
            where: { id: existing.structuredData[0].id },
            data: {
              data: parsed.structuredData.data,
              searchText: parsed.structuredData.searchText,
              updatedAt: new Date(),
            },
          });
        }

        // Update ElasticSearch if indexed
        if (existing.searchIndex) {
          try {
            await elasticService.updateDocument(existing.searchIndex, {
              title: parsed.title,
              content: parsed.structuredData.searchText,
              tags: parsed.tags,
            });
          } catch (elasticError) {
            if (this.options.verbose) {
              console.warn(`    Warning: Failed to update ElasticSearch for ${parsed.title}`);
            }
          }
        }

        this.stats.updated++;
      } else {
        // Create new document
        const doc = await prisma.document.create({
          data: {
            title: parsed.title,
            description: parsed.description,
            type: parsed.type,
            format: parsed.format,
            storageKey: parsed.storageKey,
            fileSize: parsed.fileSize,
            pageCount: 1,
            uploadedBy: 'system',
            tags: parsed.tags,
            isPublic: parsed.isPublic,
            metadata: parsed.metadata,
            ocrStatus: 'not_required',
          },
        });

        // Create structured data
        const structured = await prisma.structuredData.create({
          data: {
            documentId: doc.id,
            type: parsed.structuredData.type,
            name: parsed.structuredData.name,
            data: parsed.structuredData.data,
            searchText: parsed.structuredData.searchText,
          },
        });

        // Index in ElasticSearch
        try {
          const esId = await elasticService.indexDocument({
            title: parsed.title,
            content: parsed.structuredData.searchText,
            type: parsed.type,
            tags: parsed.tags,
            metadata: parsed.metadata,
          });

          // Update document with search index ID
          await prisma.document.update({
            where: { id: doc.id },
            data: { searchIndex: esId },
          });
        } catch (elasticError) {
          if (this.options.verbose) {
            console.warn(`    Warning: Failed to index in ElasticSearch for ${parsed.title}`);
          }
        }

        this.stats.created++;
      }
    } catch (error: any) {
      this.stats.errors++;
      if (this.options.verbose) {
        console.error(`    ❌ Error processing item:`, error.message);
        console.error(`    Data:`, JSON.stringify(rawData, null, 2).substring(0, 200));
      }
    }
  }

  private printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary');
    console.log('='.repeat(50));
    console.log(`Total items processed:  ${this.stats.total}`);
    console.log(`Created:                ${this.stats.created}`);
    console.log(`Updated:                ${this.stats.updated}`);
    console.log(`Skipped:                ${this.stats.skipped}`);
    console.log(`Errors:                 ${this.stats.errors}`);
    console.log('='.repeat(50));
  }
}

// Run the import
const options = parseArgs();
const importer = new SRDImporter(options);

importer.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
