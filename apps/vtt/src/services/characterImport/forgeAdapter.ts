/**
 * Import adapter for 5e Character Forge JSON exports.
 *
 * The transformation itself lives in `@nexus/character-creator` so that a
 * character imported from a file and a character created in-app go through
 * exactly one conversion. This class keeps the VTT-facing validation and
 * metadata surface that `importService` depends on.
 */

import type { Character } from '@nexus/character-contracts';
import type { ForgeCharacter, ImportMetadata } from '@nexus/character-contracts';
import {
  resolveProficientSaves,
  toNexusCharacter,
} from '@nexus/character-creator';

export class ForgeCharacterAdapter {
  /**
   * Validate that the data is a Forge character export
   */
  validate(data: unknown): data is ForgeCharacter {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const char = data as Record<string, unknown>;

    // Check for Forge-specific fields
    const hasForgeFields =
      'species' in char &&
      'edition' in char &&
      typeof char.abilities === 'object' &&
      char.abilities !== null &&
      'STR' in char.abilities;

    return hasForgeFields;
  }

  /**
   * Transform Forge character to NexusVTT format.
   *
   * Saving throws are not stored in the Forge model, so they are resolved from
   * the shared rules data using the character's class.
   */
  transform(forgeChar: ForgeCharacter, playerId: string = ''): Character {
    return toNexusCharacter(forgeChar, {
      playerId,
      proficientSaves: resolveProficientSaves(
        forgeChar.classSlug || forgeChar.class,
        forgeChar.edition,
      ),
    });
  }

  /**
   * Generate import metadata
   */
  generateMetadata(
    forgeChar: ForgeCharacter,
    _originalFileName?: string,
  ): ImportMetadata {
    return {
      sourceType: 'forge',
      sourceVersion: forgeChar.edition,
      importedAt: Date.now(),
      originalId: forgeChar.id,
    };
  }
}
