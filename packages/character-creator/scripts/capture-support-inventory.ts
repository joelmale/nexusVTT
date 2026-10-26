import { writeFileSync } from 'node:fs';
import {
  BACKGROUNDS,
  FEAT_DATABASE,
  getAllSpecies,
  loadClasses,
  loadEquipment,
  loadSpells,
  loadSubclasses,
} from '../src/services/dataService';
import {
  CERTIFIED_SUPPORT_MANIFEST,
  getSubclassLevel,
} from '../src/data/supportManifest';

// Reproducible inventory, not rules approval. No character/account data is read.
const inventory = {
  schemaVersion: 1,
  baseline: '248fedf9',
  scope: 'Working-tree validation candidate; independent source review pending',
  multiclass: {
    creatorAuthoring: false,
    separateRulesEngineExists: true,
    importedPreservationAcceptance: 'not run',
  },
  classes: (['2014', '2024'] as const).flatMap((edition) =>
    loadClasses(edition).map((entry) => ({
      id: `${entry.slug}-${edition}`,
      classSlug: entry.slug,
      edition,
      source: entry.source,
      hitDie: entry.hit_die,
      subclassLevel: getSubclassLevel(entry.slug, edition),
      catalogCasting: entry.spellcasting ?? null,
      certified:
        CERTIFIED_SUPPORT_MANIFEST.find(
          (support) => support.classSlug === entry.slug,
        )?.level1Certified ?? false,
      independentReview: 'not run',
    })),
  ),
  catalogs: (['2014', '2024'] as const).map((edition) => ({
    edition,
    species: getAllSpecies(edition).map((entry) => ({
      id: entry.slug,
      source: entry.source,
    })),
    backgrounds: BACKGROUNDS.filter((entry) => entry.edition === edition).map(
      (entry) => ({ id: entry.slug, source: entry.source }),
    ),
    spells: loadSpells(edition)
      .map((entry) => entry.slug)
      .sort(),
  })),
  feats: FEAT_DATABASE.map((entry) => ({
    id: entry.slug,
    source: entry.source,
    year: entry.year,
    category: entry.category,
  })),
  subclasses: loadSubclasses().map((entry) => ({
    id: entry.slug,
    classSlug: entry.class,
    source: entry.source ?? null,
    edition: entry.edition ?? null,
  })),
  equipment: loadEquipment()
    .map((entry) => entry.slug)
    .sort(),
};
writeFileSync(
  new URL('../src/tests/fixtures/supportInventory.json', import.meta.url),
  `${JSON.stringify(inventory, null, 2)}\n`,
);
