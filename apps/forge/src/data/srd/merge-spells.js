#!/usr/bin/env node

/**
 * Script to merge 2014 and 2024 SRD spell lists
 * Creates a unified spell database with source tracking
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the current spell files
const spells2014Path = path.join(__dirname, '2014', '5e-SRD-Spells.json');
const spells2024Path = path.join(__dirname, '2024', '5e-SRD-spells.json');
const outputPath = path.join(__dirname, '5e-SRD-Spells-Merged.json');

console.log('Loading spell data...');

// Load spell data
const spells2014 = JSON.parse(fs.readFileSync(spells2014Path, 'utf8'));
const spells2024 = JSON.parse(fs.readFileSync(spells2024Path, 'utf8'));

console.log(`2014 spells: ${spells2014.length}`);
console.log(`2024 spells: ${spells2024.length}`);

// Create maps for deduplication
const spellMap = new Map();

// Process 2014 spells
spells2014.forEach(spell => {
  if (spell.name && spell.level !== undefined) {
    const key = spell.name.toLowerCase().trim();
    spellMap.set(key, { ...spell, source: '2014' });
  }
});

// Process 2024 spells (prefer 2024 versions for duplicates)
spells2024.forEach(spell => {
  if (spell.name && spell.level !== undefined) {
    const key = spell.name.toLowerCase().trim();
    const existing = spellMap.get(key);
    if (existing) {
      // Spell exists in both - keep 2024 version but mark as having both sources
      spellMap.set(key, { ...spell, source: '2024' });
    } else {
      // 2024-only spell
      spellMap.set(key, { ...spell, source: '2024' });
    }
  }
});

// Convert back to array
const mergedSpells = Array.from(spellMap.values());

console.log(`Merged spells: ${mergedSpells.length}`);

// Write merged file
fs.writeFileSync(outputPath, JSON.stringify(mergedSpells, null, 2));

console.log(`✅ Merged spell database created: ${outputPath}`);
console.log(`   - Total spells: ${mergedSpells.length}`);
console.log(`   - 2014 spells: ${mergedSpells.filter(s => s.source === '2014').length}`);
console.log(`   - 2024 spells: ${mergedSpells.filter(s => s.source === '2024').length}`);