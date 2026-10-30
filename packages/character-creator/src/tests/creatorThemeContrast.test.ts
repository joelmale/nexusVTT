// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Every ink the creator puts on a surface must stay readable in both creator
// themes. The pairs below are the contract; add a pair here whenever a new
// token is meant to be used as text on another.
const css = readFileSync(
  new URL('../styles/creator-theme.source.css', import.meta.url),
  'utf8',
);

type Rgb = [number, number, number];

function themeBlock(theme: string): Map<string, Rgb> {
  const match = css.match(
    new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match) throw new Error(`No [data-theme='${theme}'] block`);
  const vars = new Map<string, Rgb>();
  const body = match[1].replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, name, raw] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const value = raw.trim();
    const hex = value.match(/^#([0-9a-f]{6})$/i);
    const triplet = value.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
    if (hex) {
      const n = parseInt(hex[1], 16);
      vars.set(name, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    } else if (triplet) {
      vars.set(name, [+triplet[1], +triplet[2], +triplet[3]]);
    }
  }
  return vars;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;

const SURFACES = ['--cc-surface', '--cc-raised', '--cc-sunken', '--cc-selected-bg'];
const INKS = [
  '--cc-on-surface',
  '--cc-text-2',
  '--cc-muted',
  '--cc-disabled',
  '--cc-tone-info',
  '--cc-tone-magic',
  '--cc-tone-success',
  '--cc-tone-warning',
  '--cc-tone-danger',
  '--cc-tone-gold',
];
const TONES = ['info', 'magic', 'success', 'warning', 'danger'];

const LEGACY_SURFACES = ['--color-bg-primary', '--color-bg-secondary', '--color-bg-tertiary'];
const LEGACY_INKS = [
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-text-muted',
  '--color-text-disabled',
  '--color-accent-red-light',
  '--color-accent-purple-light',
  '--color-accent-green-light',
  '--color-accent-blue-light',
  '--color-accent-yellow-light',
];
const LEGACY_FILLS = [
  '--color-accent-red',
  '--color-accent-red-dark',
  '--color-accent-purple',
  '--color-accent-purple-dark',
  '--color-accent-green',
  '--color-accent-green-dark',
  '--color-accent-blue',
  '--color-accent-blue-dark',
  // The markup fills selected cards with the -darker shades.
  '--color-accent-red-darker',
  '--color-accent-purple-darker',
  '--color-accent-green-darker',
  '--color-accent-blue-darker',
  '--color-action-green',
];

function pairs(): Array<[string, string, number]> {
  const out: Array<[string, string, number]> = [];
  for (const ink of INKS) for (const bg of SURFACES) out.push([ink, bg, TEXT]);
  for (const tone of TONES) {
    out.push([`--cc-tone-${tone}`, `--cc-tone-${tone}-soft`, TEXT]);
    out.push(['--cc-on-surface', `--cc-tone-${tone}-soft`, TEXT]);
    out.push(['--cc-on-fill', `--cc-fill-${tone}`, TEXT]);
  }
  out.push(['--cc-on-accent', '--cc-accent', TEXT]);
  out.push(['--cc-on-accent', '--cc-accent-hover', TEXT]);
  out.push(['--cc-on-surface', '--cc-hover', TEXT]);
  out.push(['--cc-sheet-ink', '--cc-sheet', TEXT]);
  out.push(['--cc-sheet-ink-2', '--cc-sheet', TEXT]);
  // The live sheet uses the rule colour for its section headings.
  out.push(['--cc-sheet-rule', '--cc-sheet', TEXT]);
  for (const bg of ['--cc-surface', '--cc-raised', '--cc-sunken']) {
    out.push(['--cc-border-strong', bg, UI]);
    out.push(['--cc-focus', bg, UI]);
  }
  out.push(['--cc-selected-border', '--cc-selected-bg', UI]);
  out.push(['--cc-selected-border', '--cc-surface', UI]);

  for (const ink of LEGACY_INKS) for (const bg of LEGACY_SURFACES) out.push([ink, bg, TEXT]);
  out.push(['--color-text-primary', '--color-bg-quaternary', TEXT]);
  out.push(['--color-text-primary', '--color-bg-hover', TEXT]);
  for (const fill of LEGACY_FILLS) out.push(['--color-on-action', fill, TEXT]);
  for (const fill of [
    '--color-accent-yellow',
    '--color-accent-yellow-dark',
    '--color-accent-yellow-light',
  ])
    out.push(['--color-on-yellow', fill, TEXT]);
  for (const bg of LEGACY_SURFACES) out.push(['--color-border-primary', bg, UI]);
  return out;
}

describe.each(['parchment', 'dark'])('creator theme "%s"', (theme) => {
  const vars = themeBlock(theme);

  it('declares every token the contract uses', () => {
    const missing = [...new Set(pairs().flatMap(([a, b]) => [a, b]))].filter(
      (name) => !vars.has(name),
    );
    expect(missing).toEqual([]);
  });

  it('meets WCAG contrast for every declared pair', () => {
    const failures = pairs()
      .map(([ink, bg, min]) => {
        const ratio = contrast(vars.get(ink)!, vars.get(bg)!);
        return { pair: `${ink} on ${bg}`, ratio: +ratio.toFixed(2), min };
      })
      .filter(({ ratio, min }) => ratio < min);
    expect(failures).toEqual([]);
  });

  it('keeps the character sheet identical across themes', () => {
    const other = themeBlock(theme === 'dark' ? 'parchment' : 'dark');
    for (const name of ['--cc-sheet', '--cc-sheet-ink', '--cc-sheet-ink-2', '--cc-sheet-rule']) {
      expect(vars.get(name)).toEqual(other.get(name));
    }
  });
});
