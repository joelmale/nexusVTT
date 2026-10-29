import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Design Tokens verification', () => {
  const stylesDir = path.resolve(__dirname);
  const srcDir = path.resolve(__dirname, '..');
  const tokensFile = path.join(stylesDir, 'design-tokens.css');

  function getAllCssFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllCssFiles(fullPath));
      } else if (entry.name.endsWith('.css')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('declares all token definitions in design-tokens.css', () => {
    expect(fs.existsSync(tokensFile)).toBe(true);
    const tokensContent = fs.readFileSync(tokensFile, 'utf8');

    // Extract all declared variable names: e.g. --studio-gap: ...
    const declaredMatches = tokensContent.matchAll(/(--studio-[a-zA-Z0-9_-]+)\s*:/g);
    const declaredTokens = new Set<string>();
    for (const match of declaredMatches) {
      declaredTokens.add(match[1]);
    }

    expect(declaredTokens.size).toBeGreaterThan(20);
    expect(declaredTokens.has('--studio-gap-xs')).toBe(true);
    expect(declaredTokens.has('--studio-text-secondary')).toBe(true);
    expect(declaredTokens.has('--studio-rarity-uncommon')).toBe(true);
    expect(declaredTokens.has('--studio-font-display')).toBe(true);
  });

  it('rejects undeclared var(--studio-*) usages across all css files', () => {
    const tokensContent = fs.readFileSync(tokensFile, 'utf8');
    const declaredMatches = tokensContent.matchAll(/(--studio-[a-zA-Z0-9_-]+)\s*:/g);
    const declaredTokens = new Set<string>();
    for (const match of declaredMatches) {
      declaredTokens.add(match[1]);
    }

    const cssFiles = getAllCssFiles(srcDir);
    const undeclaredUsages: Array<{ file: string; token: string }> = [];

    for (const file of cssFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const varMatches = content.matchAll(/var\(\s*(--studio-[a-zA-Z0-9_-]+)/g);
      for (const match of varMatches) {
        const tokenName = match[1];
        if (!declaredTokens.has(tokenName)) {
          undeclaredUsages.push({
            file: path.relative(srcDir, file),
            token: tokenName,
          });
        }
      }
    }

    expect(undeclaredUsages).toEqual([]);
  });
});
