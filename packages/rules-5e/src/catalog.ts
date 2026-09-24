/**
 * Catalog Key and Slug Normalization Utilities.
 * Guarantees unique, edition-aware identity across 5.1 and 5.2.1 SRD packs.
 */

/**
 * Normalizes an arbitrary display name or title into a standard URL/catalog-safe slug.
 */
export function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a deterministic, globally unique catalog key for a game object.
 * Format: system:edition:contentPackId:slug
 * Example: dnd5e:2024:srd-5.2.1:fireball
 */
export function createCatalogKey(
  slug: string,
  contentPackId: string,
  edition: '2014' | '2024' = '2024',
): string {
  const cleanSlug = normalizeSlug(slug);
  return `dnd5e:${edition}:${contentPackId.toLowerCase()}:${cleanSlug}`;
}

/**
 * Parses a catalog key back into its component parts.
 */
export function parseCatalogKey(key: string): {
  system: string;
  edition: '2014' | '2024';
  contentPackId: string;
  slug: string;
} | null {
  const parts = key.split(':');
  if (parts.length !== 4) return null;

  const [system, edition, contentPackId, slug] = parts;
  if (system !== 'dnd5e') return null;
  if (edition !== '2014' && edition !== '2024') return null;

  return {
    system,
    edition,
    contentPackId,
    slug,
  };
}
