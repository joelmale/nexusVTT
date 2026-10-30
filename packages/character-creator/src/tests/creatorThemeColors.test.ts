// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Text and backgrounds only stay readable in both creator themes if every
// colour comes from a theme token. Tailwind palette classes (`text-white`,
// `bg-blue-900`) and literal colours in CSS modules look right in one theme
// and break in the other, so they are not allowed anywhere in the package's
// UI. Use the theme utilities in `styles/creator-theme.source.css` instead:
// `*-theme-*`, `*-accent-*`, `text-tone-*`, `border-tone-*`,
// `bg-tone-*-soft`, `bg-fill-*`.
const SRC = fileURLToPath(new URL('..', import.meta.url));

const HUES =
  'red|blue|green|yellow|purple|gray|slate|zinc|neutral|stone|amber|orange|emerald|teal|cyan|sky|indigo|violet|fuchsia|pink|rose|lime|white|black';
const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|from|to|via|ring|ring-offset|divide|outline|placeholder|shadow|fill|stroke|decoration)-(?:${HUES})(?:-\\d{2,3})?(?:\\/\\d+)?(?![\\w-])` +
    `|(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border)-accent-(?:orange|stone)(?:\\/\\d+)?(?![\\w-])`,
  'g',
);
const LITERAL_CSS_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'tests' ? [] : walk(path);
    return [path];
  });
}

const files = walk(SRC).filter((f) => !/\.test\.tsx?$/.test(f));

describe('creator colour discipline', () => {
  it('uses no Tailwind palette classes in components', () => {
    const offenders = files
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => {
        const found = readFileSync(f, 'utf8').match(PALETTE_CLASS) ?? [];
        return found.map((cls) => `${relative(SRC, f)}: ${cls}`);
      });
    expect(offenders).toEqual([]);
  });

  it('uses no literal colours in CSS modules', () => {
    const offenders = files
      .filter((f) => f.endsWith('.module.css'))
      .flatMap((f) => {
        const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        return (css.match(LITERAL_CSS_COLOR) ?? []).map(
          (c) => `${relative(SRC, f)}: ${c}`,
        );
      });
    expect(offenders).toEqual([]);
  });
});
