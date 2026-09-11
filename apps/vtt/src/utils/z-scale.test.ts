import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Z, zVar, type ZBand } from './z-scale';

const bandToVarName = (band: ZBand): string =>
  `--z-${band.toLowerCase().replace(/_/g, '-')}`;

describe('z-scale ↔ design-tokens sync (ADR-0004)', () => {
  const css = readFileSync(
    resolve(__dirname, '../styles/design-tokens.css'),
    'utf-8',
  );

  it.each(Object.entries(Z) as [ZBand, number][])(
    '%s (%i) matches its --z-* custom property',
    (band, value) => {
      const varName = bandToVarName(band);
      const match = css.match(new RegExp(`${varName}:\\s*(-?\\d+)\\s*;`));
      expect(match, `${varName} must be defined in design-tokens.css`).not.toBeNull();
      expect(Number(match![1])).toBe(value);
    },
  );

  it('bands are strictly ascending in stack order', () => {
    const ordered: ZBand[] = [
      'BACKGROUND', 'GRID', 'DRAWING', 'TOKEN', 'SELECTION', 'FOG', 'CURSORS',
      'TOOL_UI', 'PANEL', 'POPOVER', 'MODAL_BACKDROP', 'MODAL', 'TOOLTIP',
      'DICE_3D', 'DRAG_GHOST', 'TOP_MODAL',
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(Z[ordered[i]]).toBeGreaterThan(Z[ordered[i - 1]]);
    }
  });

  it('zVar produces the CSS custom-property reference', () => {
    expect(zVar('TOOL_UI')).toBe('var(--z-tool-ui)');
    expect(zVar('DICE_3D')).toBe('var(--z-dice-3d)');
  });
});
