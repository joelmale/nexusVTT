/**
 * Builds the scoped stylesheet consumed by host applications that do not want
 * the creator's palette at global scope (Nexus VTT).
 *
 * Every selector in `src/styles/creator-theme.source.css` is rewritten so it
 * only matches inside the creator's own root element:
 *
 *   :root                     -> .nexus-character-creator
 *   [data-theme="paper"]      -> .nexus-character-creator[data-theme="paper"]
 *   [data-theme="paper"] .foo -> .nexus-character-creator[data-theme="paper"] .foo
 *   .bg-theme-secondary       -> .nexus-character-creator .bg-theme-secondary
 *
 * The creator root also carries the class itself, so rules that target the
 * root element directly still apply.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const SOURCE = path.join(pkgRoot, 'src/styles/creator-theme.source.css');
const OUT_DIR = path.join(pkgRoot, 'dist');
const OUT = path.join(OUT_DIR, 'creator.css');
const SCOPE = '.nexus-character-creator';

/** At-rules whose child rules are ordinary selectors and must be scoped. */
const SCOPED_AT_RULES = new Set(['media', 'supports', 'layer', 'container']);

function scopeSelector(selector) {
  const sel = selector.trim();
  if (!sel) return sel;

  // Root-level custom property blocks become the creator root itself.
  if (sel === ':root' || sel === 'html' || sel === 'body') return SCOPE;

  // A selector that starts with an attribute/class the creator root carries
  // (e.g. `[data-theme="paper"] .foo`) is attached to the root rather than
  // nested below it, because the creator root is where `data-theme` lives.
  const themeMatch = sel.match(/^\[data-theme=("[^"]*"|'[^']*'|[^\]]*)\]\s*(.*)$/);
  if (themeMatch) {
    const attr = `[data-theme=${themeMatch[1]}]`;
    const rest = themeMatch[2].trim();
    return rest ? `${SCOPE}${attr} ${rest}` : `${SCOPE}${attr}`;
  }

  // Already scoped (defensive, allows incremental hand-authored rules).
  if (sel.startsWith(SCOPE)) return sel;

  return `${SCOPE} ${sel}`;
}

const scopePlugin = {
  postcssPlugin: 'nexus-scope-creator-styles',
  Once(root) {
    root.walkRules((rule) => {
      const parent = rule.parent;
      if (
        parent &&
        parent.type === 'atrule' &&
        !SCOPED_AT_RULES.has(parent.name.toLowerCase())
      ) {
        // @keyframes steps ("from", "50%") are not selectors.
        return;
      }
      rule.selectors = rule.selectors.map(scopeSelector);
    });
  },
};


const css = fs.readFileSync(SOURCE, 'utf8');
const result = await postcss([scopePlugin]).process(css, {
  from: SOURCE,
  to: OUT,
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  OUT,
  '/* GENERATED FILE — do not edit.\n' +
    ' * Source: src/styles/creator-theme.source.css\n' +
    ' * Rebuild: npm run build --workspace=@nexus/character-creator\n' +
    ' */\n' +
    result.css,
  'utf8',
);

console.log(
  `[character-creator] wrote ${path.relative(pkgRoot, OUT)} (${result.css.length} bytes)`,
);
