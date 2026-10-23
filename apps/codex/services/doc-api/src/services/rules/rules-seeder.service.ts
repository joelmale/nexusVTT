import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseRulesEntityData } from '@nexus/rules-contracts';
import type { Prisma, PrismaClient, RulesEntityType as DbEntityType } from '@prisma/client';
import { prisma as defaultPrisma } from '../database.service';
import {
  convertItem2014,
  convertItem2024,
  convertMagicItem,
  type ConvertedEntity,
} from './srd-converters';

const CATALOG_VERSION_LOCK_KEY = 724_301_004;
const DEFAULT_ACTOR = 'system:srd-seeder';
const DEFAULT_LICENSE = 'CC-BY-4.0';

export interface SeedBaselineOptions {
  force?: boolean;
  actor?: string;
  dataDir?: string;
}

export interface SeedBaselineResult {
  seeded2024: number;
  seeded2014: number;
  total: number;
  catalogVersion: number;
  skipped: boolean;
}

export class RulesSeederService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Resolve directory holding the SRD baseline JSON files.
   */
  resolveDataDir(customDir?: string): string {
    if (customDir && existsSync(customDir)) return customDir;

    // Direct data directory inside doc-api src
    const localData = path.resolve(__dirname, '../../data');
    if (existsSync(localData)) return localData;

    // Dist fallback
    const distData = path.resolve(__dirname, '../data');
    if (existsSync(distData)) return distData;

    // Monorepo package fallback
    const packageData = path.resolve(__dirname, '../../../../../../packages/character-creator/src/data');
    if (existsSync(packageData)) return packageData;

    return localData;
  }

  /**
   * Build baseline item entities from 2024 equipment, 2014 equipment, and
   * classic magic items. Defers to 2024 rules where 2024 equipment exists,
   * while giving both rulesets full access to magic items.
   */
  buildBaselineItems(dataDir?: string): {
    items2024: ConvertedEntity[];
    items2014: ConvertedEntity[];
  } {
    const resolvedDir = this.resolveDataDir(dataDir);

    // 1. 2024 Equipment
    let rawEq2024: Array<Record<string, unknown>> = [];
    const eq2024Path = path.join(resolvedDir, 'equipment-2024.json');
    const eqAltPath = path.join(resolvedDir, 'equipment.json');
    if (existsSync(eq2024Path)) {
      rawEq2024 = JSON.parse(readFileSync(eq2024Path, 'utf8'));
    } else if (existsSync(eqAltPath)) {
      rawEq2024 = JSON.parse(readFileSync(eqAltPath, 'utf8'));
    }

    // 2. 2014 Equipment
    let rawEq2014: Array<Record<string, unknown>> = [];
    const eq2014Path = path.join(resolvedDir, '5e-srd-equipment-2014.json');
    const eq2014AltPath = path.join(resolvedDir, 'srd/2014/5e-SRD-Equipment.json');
    if (existsSync(eq2014Path)) {
      rawEq2014 = JSON.parse(readFileSync(eq2014Path, 'utf8'));
    } else if (existsSync(eq2014AltPath)) {
      rawEq2014 = JSON.parse(readFileSync(eq2014AltPath, 'utf8'));
    }

    // 3. Magic Items (240+ classic magic items)
    let rawMagic: Array<Record<string, unknown>> = [];
    const magicPath = path.join(resolvedDir, '5e-srd-magic-items.json');
    const magicAltPath = path.join(resolvedDir, 'srd/2014/5e-SRD-Magic-Items.json');
    if (existsSync(magicPath)) {
      rawMagic = JSON.parse(readFileSync(magicPath, 'utf8'));
    } else if (existsSync(magicAltPath)) {
      rawMagic = JSON.parse(readFileSync(magicAltPath, 'utf8'));
    }

    // Convert 2024 items: 2024 equipment first, then magic items not already in 2024 equipment
    const items2024: ConvertedEntity[] = [];
    const slugs2024 = new Set<string>();

    for (const raw of rawEq2024) {
      const converted = convertItem2024(raw);
      const parsed = parseRulesEntityData('item', '2024', converted.data);
      if (parsed.success) {
        items2024.push(converted);
        slugs2024.add(converted.slug);
      }
    }

    for (const raw of rawMagic) {
      const converted = convertMagicItem(raw, '2024');
      if (slugs2024.has(converted.slug)) continue; // Defer to 2024 equipment rules
      const parsed = parseRulesEntityData('item', '2024', converted.data);
      if (parsed.success) {
        items2024.push(converted);
        slugs2024.add(converted.slug);
      }
    }

    // Convert 2014 items: 2014 equipment first, then magic items not already in 2014 equipment
    const items2014: ConvertedEntity[] = [];
    const slugs2014 = new Set<string>();

    for (const raw of rawEq2014) {
      const converted = convertItem2014(raw);
      const parsed = parseRulesEntityData('item', '2014', converted.data);
      if (parsed.success) {
        items2014.push(converted);
        slugs2014.add(converted.slug);
      }
    }

    for (const raw of rawMagic) {
      const converted = convertMagicItem(raw, '2014');
      if (slugs2014.has(converted.slug)) continue;
      const parsed = parseRulesEntityData('item', '2014', converted.data);
      if (parsed.success) {
        items2014.push(converted);
        slugs2014.add(converted.slug);
      }
    }

    return { items2024, items2014 };
  }

  /**
   * Seed baseline rules entities directly into the published state, bypassing
   * the draft -> validate -> publish revision workflow which is meant for
   * player/DM additions.
   */
  async seedBaseline(options: SeedBaselineOptions = {}): Promise<SeedBaselineResult> {
    const actor = options.actor ?? DEFAULT_ACTOR;
    const { items2024, items2014 } = this.buildBaselineItems(options.dataDir);

    const allItems = [...items2024, ...items2014];
    if (allItems.length === 0) {
      return { seeded2024: 0, seeded2014: 0, total: 0, catalogVersion: 0, skipped: true };
    }

    // Run in chunks within a transaction to maintain atomicity and avoid locking timeouts
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Advisory lock for catalog version allocation
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATALOG_VERSION_LOCK_KEY})`;

        const latest = await tx.rulesCatalogVersion.aggregate({ _max: { version: true } });
        const catalogVersion = (latest._max.version ?? 0) + 1;

        const changedEntityIds: string[] = [];
        let seeded2024 = 0;
        let seeded2014 = 0;
        const now = new Date();

        for (const item of allItems) {
          // Check if entity already exists
          const existing = await tx.rulesEntity.findUnique({
            where: {
              entityType_ruleset_slug: {
                entityType: item.entityType as DbEntityType,
                ruleset: item.ruleset,
                slug: item.slug,
              },
            },
            include: { currentPublishedRevision: true },
          });

          if (existing?.currentPublishedRevisionId && !options.force) {
            continue; // Already seeded and published
          }

          let entityId: string;
          let revisionNumber: number;

          if (existing) {
            entityId = existing.id;
            revisionNumber = existing.headRevisionNumber + 1;
            await tx.rulesEntity.update({
              where: { id: entityId },
              data: {
                headRevisionNumber: revisionNumber,
                catalogVersion,
                archivedAt: null,
              },
            });
          } else {
            const created = await tx.rulesEntity.create({
              data: {
                entityType: item.entityType,
                ruleset: item.ruleset,
                slug: item.slug,
                schemaVersion: 1,
                headRevisionNumber: 1,
                catalogVersion,
              },
            });
            entityId = created.id;
            revisionNumber = 1;
          }

          // Create published revision directly
          const revision = await tx.rulesEntityRevision.create({
            data: {
              entityId,
              revisionNumber,
              status: 'published',
              schemaVersion: 1,
              data: item.data as Prisma.InputJsonValue,
              sourceLicense: DEFAULT_LICENSE,
              createdBy: actor,
              publishedBy: actor,
              publishedAt: now,
              catalogVersion,
            },
          });

          // Point currentPublishedRevisionId to newly published revision
          await tx.rulesEntity.update({
            where: { id: entityId },
            data: { currentPublishedRevisionId: revision.id },
          });

          changedEntityIds.push(entityId);
          if (item.ruleset === '2024') seeded2024++;
          else if (item.ruleset === '2014') seeded2014++;
        }

        if (changedEntityIds.length > 0) {
          await tx.rulesCatalogVersion.create({
            data: {
              version: catalogVersion,
              publishedBy: actor,
              action: 'seed:srd-baseline',
              changedEntityIds,
            },
          });
        }

        return {
          seeded2024,
          seeded2014,
          total: seeded2024 + seeded2014,
          catalogVersion: changedEntityIds.length > 0 ? catalogVersion : (latest._max.version ?? 0),
          skipped: changedEntityIds.length === 0,
        };
      },
      { timeout: 120_000 },
    );
  }

  /**
   * Seed baseline rules entities only if the rules_entities table has no items.
   * Safe to call on every server boot.
   */
  async seedBaselineIfEmpty(options: SeedBaselineOptions = {}): Promise<SeedBaselineResult> {
    const existingCount = await this.prisma.rulesEntity.count({
      where: { entityType: 'item' },
    });

    if (existingCount > 0 && !options.force) {
      return {
        seeded2024: 0,
        seeded2014: 0,
        total: 0,
        catalogVersion: 0,
        skipped: true,
      };
    }

    return this.seedBaseline(options);
  }
}

export const rulesSeederService = new RulesSeederService();
