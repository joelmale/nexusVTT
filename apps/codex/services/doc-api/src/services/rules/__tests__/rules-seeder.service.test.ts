import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { RulesSeederService } from '../rules-seeder.service';
import type { PrismaClient } from '@prisma/client';

describe('RulesSeederService', () => {
  let mockPrisma: any;
  let service: RulesSeederService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      rulesEntity: {
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      rulesEntityRevision: {
        create: vi.fn(),
      },
      rulesCatalogVersion: {
        aggregate: vi.fn(),
        create: vi.fn(),
      },
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
    };
    service = new RulesSeederService(mockPrisma as unknown as PrismaClient);
  });

  describe('resolveDataDir', () => {
    it('returns custom directory if it exists', () => {
      const customDir = path.resolve(__dirname, '../../../data');
      expect(service.resolveDataDir(customDir)).toBe(customDir);
    });

    it('falls back to default data dir if custom dir does not exist', () => {
      const dir = service.resolveDataDir('/nonexistent/path/xyz');
      expect(typeof dir).toBe('string');
      expect(dir.length).toBeGreaterThan(0);
    });
  });

  describe('buildBaselineItems', () => {
    it('builds canonical 2024 and 2014 items deferring to 2024 rules', () => {
      const { items2024, items2014 } = service.buildBaselineItems();

      expect(items2024.length).toBeGreaterThan(500);
      expect(items2014.length).toBeGreaterThan(500);

      // Verify 2024 items have ruleset '2024'
      const sample2024 = items2024[0];
      expect(sample2024.ruleset).toBe('2024');
      expect(sample2024.entityType).toBe('item');

      // Verify 2014 items have ruleset '2014'
      const sample2014 = items2014[0];
      expect(sample2014.ruleset).toBe('2014');
      expect(sample2014.entityType).toBe('item');

      // Verify 2024 weapons have masteries where defined (e.g. battleaxe or longsword)
      const longsword2024 = items2024.find((i) => i.slug === 'longsword');
      expect(longsword2024).toBeDefined();
      expect((longsword2024?.data as any).weapon?.mastery).toBe('sap');

      // Verify magic items exist across both rulesets (e.g. bag of holding, flame tongue)
      const bagOfHolding2024 = items2024.find((i) => i.slug === 'bag-of-holding');
      const bagOfHolding2014 = items2014.find((i) => i.slug === 'bag-of-holding');
      expect(bagOfHolding2024).toBeDefined();
      expect(bagOfHolding2014).toBeDefined();
      expect((bagOfHolding2024?.data as any).rarity).toBe('uncommon');
      expect((bagOfHolding2014?.data as any).rarity).toBe('uncommon');

      // Verify Potion of Healing in 2024 defers to 2024 equipment (mundane/adventuring_gear with cost 50 gp)
      const healing2024 = items2024.find((i) => i.slug === 'potion-of-healing');
      expect(healing2024).toBeDefined();
      expect((healing2024?.data as any).cost?.amount).toBe(50);
      expect((healing2024?.data as any).category).toBe('potion');
    });
  });

  describe('seedBaselineIfEmpty', () => {
    it('skips seeding if items already exist in rules_entities', async () => {
      mockPrisma.rulesEntity.count.mockResolvedValue(10);
      const result = await service.seedBaselineIfEmpty();

      expect(mockPrisma.rulesEntity.count).toHaveBeenCalledWith({
        where: { entityType: 'item' },
      });
      expect(result.skipped).toBe(true);
      expect(result.total).toBe(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('proceeds with seedBaseline if count is 0', async () => {
      mockPrisma.rulesEntity.count.mockResolvedValue(0);

      const fakeResult = {
        seeded2024: 570,
        seeded2014: 590,
        total: 1160,
        catalogVersion: 1,
        skipped: false,
      };
      vi.spyOn(service, 'seedBaseline').mockResolvedValue(fakeResult);

      const result = await service.seedBaselineIfEmpty();
      expect(service.seedBaseline).toHaveBeenCalledWith({});
      expect(result).toEqual(fakeResult);
    });

    it('forces seedBaseline if options.force is true even when count > 0', async () => {
      mockPrisma.rulesEntity.count.mockResolvedValue(100);

      const fakeResult = {
        seeded2024: 570,
        seeded2014: 590,
        total: 1160,
        catalogVersion: 2,
        skipped: false,
      };
      vi.spyOn(service, 'seedBaseline').mockResolvedValue(fakeResult);

      const result = await service.seedBaselineIfEmpty({ force: true });
      expect(service.seedBaseline).toHaveBeenCalledWith({ force: true });
      expect(result).toEqual(fakeResult);
    });
  });

  describe('seedBaseline', () => {
    it('seeds items directly as published revisions within an atomic transaction', async () => {
      // Mock buildBaselineItems with a small subset for fast transaction assertion
      vi.spyOn(service, 'buildBaselineItems').mockReturnValue({
        items2024: [
          {
            entityType: 'item',
            ruleset: '2024',
            slug: 'test-dagger-2024',
            sourceId: 'test-dagger',
            warnings: [],
            data: { ruleset: '2024', name: 'Test Dagger 2024', category: 'weapon' },
          },
        ],
        items2014: [
          {
            entityType: 'item',
            ruleset: '2014',
            slug: 'test-dagger-2014',
            sourceId: 'test-dagger-14',
            warnings: [],
            data: { ruleset: '2014', name: 'Test Dagger 2014', category: 'weapon' },
          },
        ],
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          $executeRaw: vi.fn(),
          rulesCatalogVersion: {
            aggregate: vi.fn().mockResolvedValue({ _max: { version: 0 } }),
            create: vi.fn().mockResolvedValue({ version: 1 }),
          },
          rulesEntity: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(({ data }) => ({
              id: `entity-${data.slug}`,
              ...data,
            })),
            update: vi.fn().mockResolvedValue({}),
          },
          rulesEntityRevision: {
            create: vi.fn().mockImplementation(({ data }) => ({
              id: `rev-${data.entityId}`,
              ...data,
            })),
          },
        };
        return callback(txMock);
      });

      const result = await service.seedBaseline({ actor: 'test-runner' });

      expect(result.skipped).toBe(false);
      expect(result.seeded2024).toBe(1);
      expect(result.seeded2014).toBe(1);
      expect(result.total).toBe(2);
      expect(result.catalogVersion).toBe(1);
    });

    it('skips already published entities when force is false', async () => {
      vi.spyOn(service, 'buildBaselineItems').mockReturnValue({
        items2024: [
          {
            entityType: 'item',
            ruleset: '2024',
            slug: 'existing-item',
            sourceId: 'existing-item',
            warnings: [],
            data: { ruleset: '2024', name: 'Existing Item', category: 'adventuring_gear' },
          },
        ],
        items2014: [],
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          $executeRaw: vi.fn(),
          rulesCatalogVersion: {
            aggregate: vi.fn().mockResolvedValue({ _max: { version: 5 } }),
            create: vi.fn(),
          },
          rulesEntity: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'entity-existing',
              currentPublishedRevisionId: 'rev-published-already',
            }),
            create: vi.fn(),
            update: vi.fn(),
          },
          rulesEntityRevision: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.seedBaseline({ force: false });

      expect(result.skipped).toBe(true);
      expect(result.seeded2024).toBe(0);
      expect(result.seeded2014).toBe(0);
      expect(result.total).toBe(0);
    });

    it('returns empty result if buildBaselineItems returns no items', async () => {
      vi.spyOn(service, 'buildBaselineItems').mockReturnValue({
        items2024: [],
        items2014: [],
      });

      const result = await service.seedBaseline();
      expect(result.total).toBe(0);
      expect(result.skipped).toBe(true);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
