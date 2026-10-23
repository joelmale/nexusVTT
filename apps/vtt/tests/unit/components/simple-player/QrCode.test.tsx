import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import qrcode from 'qrcode-generator';
import { QrCode } from '@/components/simple-player/QrCode';
import { buildQrPath } from '@/components/simple-player/qrPath';

const URL = 'https://vtt.example.test/play/ABCD';

function darkModules(path: string): Set<string> {
  return new Set(
    [...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`),
  );
}

describe('QrCode', () => {
  it('draws exactly the dark modules of the encoded value, with a quiet zone', () => {
    const reference = qrcode(0, 'M');
    reference.addData(URL);
    reference.make();
    const count = reference.getModuleCount();

    const { path, modules } = buildQrPath(URL);
    expect(modules).toBe(count + 8);

    const drawn = darkModules(path);
    let expected = 0;
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        const isDrawn = drawn.has(`${col + 4},${row + 4}`);
        expect(isDrawn).toBe(reference.isDark(row, col));
        if (isDrawn) expected += 1;
      }
    }
    expect(drawn.size).toBe(expected);
    // Top-left finder pattern corner sits just inside the quiet zone.
    expect(drawn.has('4,4')).toBe(true);
    expect(drawn.has('3,3')).toBe(false);
  });

  it('renders an accessible, crisp SVG', () => {
    render(<QrCode value={URL} size={200} label="Join link" />);
    const svg = screen.getByRole('img', { name: 'Join link' });
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges');
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(/^M\d/);
  });
});
