#!/usr/bin/env tsx
/**
 * SRD import comparison for the Codex rules registry.
 *
 * Converts the SRD content bundled with the VTT (packages/character-creator/
 * src/data) into @nexus/rules-contracts entities, imports it through the
 * normal draft -> validate -> publish workflow into an ISOLATED database, and
 * prints a comparison report: counts, stable identifiers, unresolved
 * references, schema failures, and whether the published catalog renders the
 * same key fields as the source.
 *
 * Never part of normal startup. Refuses to run unless the target database
 * name contains "test" or "isolated".
 *
 * Usage:
 *   DATABASE_URL is ignored; pass the target explicitly.
 *   npx prisma migrate deploy   (with DATABASE_URL=<isolated url>) first, then
 *   npm run rules:srd-compare -- --database-url <url> [--reset] [--json-out report.json]
 *   npm run rules:srd-compare -- --offline      (contract check only, no database)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  parseRulesEntityData,
  type RulesEntityType,
  type RulesValidationIssue,
  type Ruleset,
} from '@nexus/rules-contracts';
import { RulesError } from '../services/rules/rules-errors';
import { RulesRegistryService } from '../services/rules/rules-registry.service';
import { RulesCatalogService } from '../services/rules/rules-catalog.service';
import {
  convertItem2024,
  convertMonster2014,
  convertSpell2014,
  convertSpell2024,
  type ConvertedEntity,
} from '../services/rules/srd-converters';

const ACTOR = 'srd-import-comparison';
const SOURCE_LICENSE = 'CC-BY-4.0';
const EXAMPLES = 5;

interface Options {
  databaseUrl?: string;
  dataDir: string;
  reset: boolean;
  offline: boolean;
  jsonOut?: string;
}

interface SourceSpec {
  key: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  file: string;
  convert: (raw: Record<string, unknown>) => ConvertedEntity;
  /** Key fields the published catalog must reproduce from the source. */
  expect: (raw: Record<string, any>) => Record<string, unknown>;
}

const SOURCES: SourceSpec[] = [
  {
    key: 'spell/2014',
    entityType: 'spell',
    ruleset: '2014',
    file: 'srd/2014/5e-SRD-Spells.json',
    convert: convertSpell2014,
    expect: (raw) => ({ name: raw.name, level: raw.level, school: raw.school?.index }),
  },
  {
    key: 'spell/2024',
    entityType: 'spell',
    ruleset: '2024',
    file: 'srd/2024/5e-SRD-spells.json',
    convert: convertSpell2024,
    expect: (raw) => ({ name: raw.name, level: raw.level, school: String(raw.school).toLowerCase() }),
  },
  {
    key: 'item/2024',
    entityType: 'item',
    ruleset: '2024',
    file: 'equipment.json',
    convert: convertItem2024,
    expect: (raw) => ({ name: raw.name, weight: raw.weight }),
  },
  {
    key: 'monster/2014',
    entityType: 'monster',
    ruleset: '2014',
    file: 'srd/2014/5e-SRD-Monsters.json',
    convert: convertMonster2014,
    expect: (raw) => ({ name: raw.name, challengeRating: raw.challenge_rating, xp: raw.xp }),
  },
];

/** Source files that exist in the bundle but have no importer yet. */
const NOT_BUNDLED = ['item/2014', 'monster/2024'];

interface SourceReport {
  key: string;
  sourceRecords: number;
  converted: number;
  conversionWarnings: number;
  conversionWarningExamples: string[];
  duplicateSlugs: string[];
  slugsDifferingFromName: number;
  schemaFailures: number;
  schemaFailureExamples: Array<{ slug: string; issues: string[] }>;
  schemaFailuresByPath: Record<string, number>;
  imported: number;
  published: number;
  validationFailuresByCode: Record<string, number>;
  validationFailureExamples: Array<{ slug: string; issues: string[] }>;
  catalogCount?: number;
  renderMismatches: number;
  renderMismatchExamples: string[];
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dataDir: path.resolve(__dirname, '../../../../../../packages/character-creator/src/data'),
    reset: false,
    offline: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--database-url') options.databaseUrl = argv[++i];
    else if (arg === '--data-dir') options.dataDir = path.resolve(argv[++i]);
    else if (arg === '--json-out') options.jsonOut = argv[++i];
    else if (arg === '--reset') options.reset = true;
    else if (arg === '--offline') options.offline = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: rules-srd-compare --database-url <isolated url> [--reset] [--data-dir dir] [--json-out file] | --offline');
      process.exit(0);
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  return options;
}

/** Exported for tests: only databases named *test* or *isolated* are allowed. */
export function assertIsolatedDatabase(url: string): string {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('--database-url is not a valid URL');
  }
  if (!/test|isolated/i.test(name)) {
    throw new Error(`refusing to import into database "${name}": its name must contain "test" or "isolated"`);
  }
  return name;
}

const issueText = (issue: RulesValidationIssue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`;
const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};
const pushExample = <T>(list: T[], value: T) => {
  if (list.length < EXAMPLES) list.push(value);
};

function loadSource(spec: SourceSpec, dataDir: string) {
  const raw = JSON.parse(readFileSync(path.join(dataDir, spec.file), 'utf8')) as Array<Record<string, any>>;
  const report: SourceReport = {
    key: spec.key,
    sourceRecords: raw.length,
    converted: 0,
    conversionWarnings: 0,
    conversionWarningExamples: [],
    duplicateSlugs: [],
    slugsDifferingFromName: 0,
    schemaFailures: 0,
    schemaFailureExamples: [],
    schemaFailuresByPath: {},
    imported: 0,
    published: 0,
    validationFailuresByCode: {},
    validationFailureExamples: [],
    renderMismatches: 0,
    renderMismatchExamples: [],
  };
  const seen = new Set<string>();
  const valid: Array<{ entity: ConvertedEntity; raw: Record<string, any> }> = [];
  for (const record of raw) {
    const entity = spec.convert(record);
    report.converted += 1;
    report.conversionWarnings += entity.warnings.length;
    for (const warning of entity.warnings) pushExample(report.conversionWarningExamples, `${entity.slug}: ${warning}`);
    if (seen.has(entity.slug)) {
      report.duplicateSlugs.push(entity.slug);
      continue;
    }
    seen.add(entity.slug);
    const name = typeof record.name === 'string' ? record.name : '';
    const derived = name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (derived !== entity.slug) report.slugsDifferingFromName += 1;
    const parsed = parseRulesEntityData(entity.entityType, entity.ruleset, entity.data);
    if (!parsed.success) {
      report.schemaFailures += 1;
      for (const issue of parsed.issues) {
        increment(report.schemaFailuresByPath, issue.path.map((p) => (typeof p === 'number' ? '#' : p)).join('.'));
      }
      pushExample(report.schemaFailureExamples, { slug: entity.slug, issues: parsed.issues.slice(0, 3).map(issueText) });
      continue;
    }
    valid.push({ entity, raw: record });
  }
  return { report, valid };
}

async function importSources(
  prisma: PrismaClient,
  loaded: Array<{ spec: SourceSpec; report: SourceReport; valid: Array<{ entity: ConvertedEntity; raw: Record<string, any> }> }>,
  unresolved: Map<string, Set<string>>,
) {
  const registry = new RulesRegistryService(prisma);
  // Spells first so monster/item spell references can resolve.
  const order: RulesEntityType[] = ['spell', 'item', 'monster'];
  const ids = new Map<string, string>();
  for (const type of order) {
    for (const { spec, report, valid } of loaded.filter((l) => l.spec.entityType === type)) {
      for (const { entity } of valid) {
        const created = await registry.createEntity(
          {
            entityType: entity.entityType,
            ruleset: entity.ruleset,
            slug: entity.slug,
            schemaVersion: 1,
            data: entity.data,
            sourceLicense: SOURCE_LICENSE,
            sourceDocumentId: `bundled:${spec.file}#${entity.sourceId}`,
          },
          ACTOR,
        );
        report.imported += 1;
        ids.set(`${spec.key}:${entity.slug}`, created.id);
        const validation = await registry.validate(created.id, 1, ACTOR);
        if (!validation.valid) {
          for (const issue of validation.issues) {
            increment(report.validationFailuresByCode, issue.code);
            if (issue.code === 'unresolved_reference' || issue.code === 'ruleset_incompatible_reference') {
              const target = /"([^"]+)"/.exec(issue.message)?.[1] ?? issue.message;
              const users = unresolved.get(`${spec.ruleset}:${target}`) ?? new Set<string>();
              users.add(entity.slug);
              unresolved.set(`${spec.ruleset}:${target}`, users);
            }
          }
          pushExample(report.validationFailureExamples, {
            slug: entity.slug,
            issues: validation.issues.slice(0, 3).map(issueText),
          });
          continue;
        }
        try {
          await registry.publish(created.id, 1, ACTOR);
          report.published += 1;
        } catch (error) {
          if (!(error instanceof RulesError)) throw error;
          increment(report.validationFailuresByCode, `publish:${error.code}`);
        }
      }
    }
  }
  return ids;
}

async function compareCatalog(
  prisma: PrismaClient,
  loaded: Array<{ spec: SourceSpec; report: SourceReport; valid: Array<{ entity: ConvertedEntity; raw: Record<string, any> }> }>,
) {
  const catalog = new RulesCatalogService(prisma);
  const manifest = await catalog.manifest();
  for (const { spec, report, valid } of loaded) {
    report.catalogCount = manifest.counts[spec.ruleset][spec.entityType];
    const published = await catalog.entities({ type: spec.entityType, ruleset: spec.ruleset, since: 0 });
    const bySlug = new Map(published.entities.map((entity) => [entity.slug, entity]));
    for (const { entity, raw } of valid) {
      const rendered = bySlug.get(entity.slug);
      if (!rendered) continue; // not published; already counted as a validation failure
      const expected = spec.expect(raw);
      for (const [field, value] of Object.entries(expected)) {
        const actual = (rendered.data as Record<string, unknown>)[field];
        if (actual !== value) {
          report.renderMismatches += 1;
          pushExample(report.renderMismatchExamples, `${entity.slug}.${field}: source ${JSON.stringify(value)} vs catalog ${JSON.stringify(actual)}`);
        }
      }
    }
  }
  return manifest;
}

function printReport(reports: SourceReport[], unresolved: Map<string, Set<string>>, manifestVersion?: number) {
  console.log('\nSRD import comparison');
  console.log('=====================');
  console.log(`Not bundled (no source data): ${NOT_BUNDLED.join(', ')}`);
  if (manifestVersion !== undefined) console.log(`Catalog version after import: ${manifestVersion}`);
  console.log('');
  console.log(
    ['source', 'records', 'dupSlugs', 'schemaFail', 'imported', 'published', 'catalog', 'renderMismatch', 'warnings']
      .map((h) => h.padEnd(14))
      .join(''),
  );
  for (const r of reports) {
    console.log(
      [r.key, r.sourceRecords, r.duplicateSlugs.length, r.schemaFailures, r.imported, r.published, r.catalogCount ?? '-', r.renderMismatches, r.conversionWarnings]
        .map((v) => String(v).padEnd(14))
        .join(''),
    );
  }
  for (const r of reports) {
    console.log(`\n[${r.key}]`);
    console.log(`  stable identifiers: ${r.sourceRecords - r.duplicateSlugs.length} unique slugs; ` +
      `${r.slugsDifferingFromName} differ from slugify(name); duplicates: ${r.duplicateSlugs.join(', ') || 'none'}`);
    if (Object.keys(r.schemaFailuresByPath).length > 0) {
      console.log(`  schema failures by path: ${JSON.stringify(r.schemaFailuresByPath)}`);
      for (const example of r.schemaFailureExamples) console.log(`    - ${example.slug}: ${example.issues.join(' | ')}`);
    }
    if (Object.keys(r.validationFailuresByCode).length > 0) {
      console.log(`  validation failures by code: ${JSON.stringify(r.validationFailuresByCode)}`);
      for (const example of r.validationFailureExamples) console.log(`    - ${example.slug}: ${example.issues.join(' | ')}`);
    }
    for (const example of r.conversionWarningExamples) console.log(`  warning: ${example}`);
    for (const example of r.renderMismatchExamples) console.log(`  render mismatch: ${example}`);
  }
  if (unresolved.size > 0) {
    console.log(`\nUnresolved references (${unresolved.size} distinct targets):`);
    for (const [target, users] of [...unresolved].sort()) {
      console.log(`  ${target} <- ${[...users].slice(0, 4).join(', ')}${users.size > 4 ? `, +${users.size - 4}` : ''}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const loaded = SOURCES.map((spec) => ({ spec, ...loadSource(spec, options.dataDir) }));
  const unresolved = new Map<string, Set<string>>();
  let manifestVersion: number | undefined;

  if (!options.offline) {
    if (!options.databaseUrl) throw new Error('--database-url is required (or pass --offline)');
    const databaseName = assertIsolatedDatabase(options.databaseUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: options.databaseUrl } } });
    try {
      const [{ exists }] = await prisma.$queryRaw<Array<{ exists: string | null }>>`
        SELECT to_regclass('rules_entities')::text AS exists
      `;
      if (!exists) {
        throw new Error(`rules tables missing in "${databaseName}"; run "npx prisma migrate deploy" against it first`);
      }
      const existing = await prisma.rulesEntity.count();
      if (existing > 0 && !options.reset) {
        throw new Error(`"${databaseName}" already has ${existing} rules entities; pass --reset to clear them`);
      }
      if (options.reset) {
        // TRUNCATE bypasses the row-level immutability triggers by design;
        // allowed only because the database name was checked above.
        await prisma.$executeRawUnsafe(
          'TRUNCATE "rules_catalog_versions", "rules_entity_revisions", "rules_entities" CASCADE',
        );
      }
      await importSources(prisma, loaded, unresolved);
      manifestVersion = (await compareCatalog(prisma, loaded)).catalogVersion;
    } finally {
      await prisma.$disconnect();
    }
  }

  const reports = loaded.map((l) => l.report);
  printReport(reports, unresolved, manifestVersion);
  if (options.jsonOut) {
    writeFileSync(
      options.jsonOut,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          notBundled: NOT_BUNDLED,
          catalogVersion: manifestVersion ?? null,
          sources: reports,
          unresolvedReferences: Object.fromEntries([...unresolved].map(([k, v]) => [k, [...v]])),
        },
        null,
        2,
      ),
    );
    console.log(`\nJSON report written to ${options.jsonOut}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
