#!/usr/bin/env node

/**
 * Tailwind Utility Collision Guard
 *
 * Fails if a component CSS file defines a class whose name is an exact Tailwind
 * *structural* utility (display / position / flex / sizing / overflow / cursor /
 * visibility). Redefining one of these silently overrides Tailwind wherever the
 * same class is used in JSX — e.g. a `.cursor-pointer { width:0 }` triangle in
 * scenes.css collapsed every Tailwind button in the app to 0×0.
 *
 * Scope: only single-class selectors (`.foo {`), so compound selectors like
 * `.flex.gap-token-md > *` are ignored. Files that are *intentionally* utility
 * providers (Tailwind entry, accessibility helpers) are allow-listed.
 *
 * Run: node scripts/check-tailwind-collisions.js
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Files that legitimately define utility-named classes — not component CSS.
const ALLOW_FILES = new Set(['tailwind.css', 'accessibility.css']);

// Exact Tailwind structural-utility names that must never be redefined in
// component CSS. (Color/spacing *scales* are excluded: collisions there cause
// minor value drift, not the catastrophic layout breakage this guard targets,
// and semantic names like `.text-input` would false-positive.)
const STRUCTURAL_UTILITIES = new Set([
  // display
  'flex', 'grid', 'block', 'inline', 'inline-block', 'inline-flex', 'inline-grid',
  'hidden', 'contents', 'table', 'flow-root', 'isolate',
  // position
  'absolute', 'relative', 'fixed', 'sticky', 'static',
  // float / visibility
  'float-left', 'float-right', 'float-none', 'visible', 'invisible', 'collapse',
  // flex/grid layout
  'flex-row', 'flex-col', 'flex-wrap', 'flex-nowrap', 'flex-1', 'flex-auto',
  'flex-none', 'flex-initial', 'grow', 'grow-0', 'shrink', 'shrink-0',
  'flex-grow', 'flex-grow-0', 'flex-shrink', 'flex-shrink-0',
  'items-center', 'items-start', 'items-end', 'items-stretch', 'items-baseline',
  'justify-center', 'justify-between', 'justify-around', 'justify-evenly',
  'justify-start', 'justify-end',
  'self-center', 'self-start', 'self-end', 'self-stretch', 'self-auto',
  'content-center', 'content-between', 'content-around', 'content-evenly',
  // overflow
  'overflow-hidden', 'overflow-auto', 'overflow-scroll', 'overflow-visible',
  'overflow-x-auto', 'overflow-y-auto', 'overflow-x-hidden', 'overflow-y-hidden',
  'overflow-x-scroll', 'overflow-y-scroll', 'overflow-x-visible', 'overflow-y-visible',
  // cursor / pointer
  'cursor-pointer', 'cursor-default', 'cursor-not-allowed', 'cursor-wait',
  'cursor-text', 'cursor-move', 'cursor-grab', 'cursor-grabbing', 'cursor-help',
  'cursor-auto', 'pointer-events-none', 'pointer-events-auto',
  // sizing keywords
  'w-full', 'w-auto', 'w-screen', 'h-full', 'h-auto', 'h-screen', 'min-w-0',
  'min-h-0', 'max-w-full', 'box-border', 'box-content',
  // text layout
  'truncate', 'uppercase', 'lowercase', 'capitalize',
]);

// Matches a single-class selector line, capturing the class name.
// e.g. ".cursor-pointer {"  or  ".flex,"  — but NOT ".flex.gap" / ".flex >".
const SINGLE_CLASS_SELECTOR = /^\s*\.([A-Za-z_][A-Za-z0-9_-]*)\s*([,{])/;

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  content.split('\n').forEach((line, i) => {
    const m = SINGLE_CLASS_SELECTOR.exec(line);
    if (m && STRUCTURAL_UTILITIES.has(m[1])) {
      violations.push({ line: i + 1, cls: m[1] });
    }
  });
  return violations;
}

function run() {
  const files = glob
    .sync('src/styles/*.css', { cwd: process.cwd() })
    .filter((f) => !ALLOW_FILES.has(path.basename(f)));

  console.log('🔍 Checking for Tailwind utility class-name collisions...\n');

  let total = 0;
  files.forEach((file) => {
    const violations = scanFile(file);
    if (violations.length) {
      console.log(`📄 ${file}:`);
      violations.forEach((v) => {
        total++;
        console.log(
          `  ❌ Line ${v.line}: ".${v.cls}" collides with the Tailwind "${v.cls}" utility — rename it (e.g. ".remote-cursor-arrow").`,
        );
      });
      console.log('');
    }
  });

  if (total === 0) {
    console.log('✅ No Tailwind utility collisions found.');
  } else {
    console.log(
      `📊 Found ${total} collision(s).\n\n❌ A component CSS file redefines a Tailwind utility class. ` +
        'These silently override Tailwind in JSX and cause layout breakage. Rename the component class.',
    );
    process.exit(1);
  }
}

if (import.meta.url.endsWith(path.basename(process.argv[1]))) {
  run();
}

export { run, scanFile, STRUCTURAL_UTILITIES };
