/**
 * Utility functions for monster-related operations
 */

/**
 * Generates a URL-friendly slug from a monster name
 * Converts to lowercase, replaces spaces with hyphens, removes special characters
 */
export function generateMonsterSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Determines if a monster ID is for a custom monster
 */
export function isCustomMonsterId(monsterId: string): boolean {
  return monsterId.startsWith('custom-');
}

/**
 * Extracts the database ID from a custom monster ID
 */
export function getCustomMonsterDbId(monsterId: string): string {
  if (isCustomMonsterId(monsterId)) {
    return monsterId.replace('custom-', '');
  }
  return monsterId;
}