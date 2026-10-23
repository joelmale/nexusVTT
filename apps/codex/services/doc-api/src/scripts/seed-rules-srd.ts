#!/usr/bin/env tsx
/**
 * CLI script to seed baseline D&D 5e SRD items into PostgreSQL rules_entities.
 *
 * Usage:
 *   npm run seed:rules-srd              # Seed items if database is empty
 *   npm run seed:rules-srd -- --force   # Force overwrite / re-publish baseline
 */
import { rulesSeederService } from '../services/rules/rules-seeder.service';

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  console.log('🌟 Nexus Codex - Rules SRD Baseline Seeder');
  console.log(`Mode: ${force ? 'Force re-seed' : 'Seed if empty'}`);

  const start = Date.now();
  const result = await rulesSeederService.seedBaseline({ force });

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  if (result.skipped) {
    console.log(`ℹ️  No changes needed: items already seeded and published (took ${duration}s).`);
  } else {
    console.log(`✅ Baseline SRD seed complete in ${duration}s!`);
    console.log(`   - 2024 Items seeded: ${result.seeded2024}`);
    console.log(`   - 2014 Items seeded: ${result.seeded2014}`);
    console.log(`   - Total items: ${result.total}`);
    console.log(`   - Catalog Version allocated: ${result.catalogVersion}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Failed to seed baseline SRD:', error);
  process.exit(1);
});
