/**
 * Optional local content pack.
 *
 * The repository is public, so it ships only SRD text and mechanics-only data
 * for non-SRD material. A table that owns the books can drop its own text into
 * `packages/character-creator/local-content/*.json` (gitignored) and it is
 * merged over the bundled spell data at load time. Nothing in that folder is
 * ever committed, and images built in CI do not contain it.
 *
 * Shape of a pack file:
 *
 *   { "spells": { "Spell Name": "full text" } }
 *   { "spells": { "Spell Name": { "description": "...", "higherLevels": "..." } } }
 */

export interface LocalSpellText {
  description: string;
  higherLevels?: string;
}

export type LocalSpellPack = Record<string, LocalSpellText>;

export const normaliseLocalKey = (name: string): string =>
  name.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Normalises one pack file, ignoring entries that are not usable text. */
export function parseLocalSpellPack(raw: unknown): LocalSpellPack {
  const spells = (raw as { spells?: unknown } | null | undefined)?.spells;
  const pack: LocalSpellPack = {};
  if (!spells || typeof spells !== 'object') return pack;
  for (const [name, value] of Object.entries(spells)) {
    if (typeof value === 'string' && value.trim()) {
      pack[normaliseLocalKey(name)] = { description: value.trim() };
    } else if (value && typeof value === 'object') {
      const { description, higherLevels } = value as Record<string, unknown>;
      if (typeof description === 'string' && description.trim()) {
        pack[normaliseLocalKey(name)] = {
          description: description.trim(),
          ...(typeof higherLevels === 'string' && higherLevels.trim()
            ? { higherLevels: higherLevels.trim() }
            : {}),
        };
      }
    }
  }
  return pack;
}

function discoverPackFiles(): Record<string, unknown> {
  try {
    // Resolved by Vite at build time; an absent folder yields an empty object.
    return import.meta.glob('../../local-content/*.json', {
      eager: true,
      import: 'default',
    }) as Record<string, unknown>;
  } catch {
    // Not running under Vite (plain Node scripts): no local pack.
    return {};
  }
}

let cachedPack: LocalSpellPack | undefined;

/** Merged spell text from every local pack file, keyed by normalised name. */
export function localSpellPack(): LocalSpellPack {
  if (!cachedPack) {
    cachedPack = {};
    for (const raw of Object.values(discoverPackFiles())) {
      Object.assign(cachedPack, parseLocalSpellPack(raw));
    }
  }
  return cachedPack;
}

/**
 * Returns the spell with local text applied, or the same object when the pack
 * has nothing for it. Text supplied locally replaces the "not bundled"
 * placeholder, so the spell stops being flagged as text-less.
 */
export function withLocalSpellText<
  T extends {
    name: string;
    description: string;
    atHigherLevels?: string;
    textNotBundled?: boolean;
  },
>(spell: T, pack: LocalSpellPack = localSpellPack()): T {
  const text = pack[normaliseLocalKey(spell.name)];
  if (!text) return spell;
  return {
    ...spell,
    description: text.description,
    ...(text.higherLevels ? { atHigherLevels: text.higherLevels } : {}),
    textNotBundled: false,
  };
}
