import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ABILITY_KEYS,
  EDITIONS,
  calculateAbilityModifier,
} from '@nexus/character-contracts';
import { getAbilityModifier } from '../src/math';

const repoRoot = join(__dirname, '..', '..', '..');

/** Packages that depend on `@nexus/character-contracts` and must not re-derive. */
const SCANNED = [
  'apps/forge/src',
  'apps/vtt/src',
  'apps/vtt/server',
  'packages/character-creator/src',
  'packages/game-contracts/src',
  'packages/rules-5e/src',
];

/** Codex services have no workspace dependency on the contracts package yet. */
const KNOWN_EXCEPTIONS = [
  'apps/codex/services/admin-ui',
  'apps/campaign-studio',
  'apps/codex/services/doc-api',
  'apps/codex/services/doc-processor',
];

const FORMULA = /Math\.floor\(\(\s*[^()]+?\s*-\s*10\s*\)\s*\/\s*2\)/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe('shared primitives', () => {
  it('has one ability modifier formula', () => {
    expect([1, 8, 9, 10, 11, 20, 30].map(getAbilityModifier)).toEqual([
      -5, -1, -1, 0, 0, 5, 10,
    ]);
    expect(getAbilityModifier(15)).toBe(calculateAbilityModifier(15));
  });

  it('exports the ability keys and editions', () => {
    expect([...ABILITY_KEYS]).toEqual([
      'STR',
      'DEX',
      'CON',
      'INT',
      'WIS',
      'CHA',
    ]);
    expect([...EDITIONS]).toEqual(['2014', '2024']);
  });

  it('does not re-derive the modifier outside the canonical helper', () => {
    const offenders: string[] = [];
    for (const dir of SCANNED) {
      for (const file of sourceFiles(join(repoRoot, dir))) {
        if (FORMULA.test(readFileSync(file, 'utf8'))) {
          offenders.push(relative(repoRoot, file).split(sep).join('/'));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the codex exceptions explicit', () => {
    // When a codex service gains the contracts dependency, move it into
    // SCANNED and drop it from this list.
    expect(KNOWN_EXCEPTIONS).toHaveLength(4);
  });
});
