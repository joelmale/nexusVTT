#!/usr/bin/env node

/**
 * Species Normalization Validation Script
 * Checks for 2024 PHB compatibility issues in species data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load species data
const racesPath = path.join(__dirname, 'src/data/species.json');
const enhancedSpeciesPath = path.join(__dirname, 'src/data/enhancedSpeciesData.json');

const racesData = JSON.parse(fs.readFileSync(racesPath, 'utf8'));
const enhancedData = JSON.parse(fs.readFileSync(enhancedSpeciesPath, 'utf8'));

console.log('🔍 Species Normalization Validation Report\n');

// Check for species with ability bonuses
const speciesWithBonuses = racesData.species.filter(species =>
  species.ability_bonuses &&
  Object.values(species.ability_bonuses).some(bonus => bonus !== 0)
);

if (speciesWithBonuses.length > 0) {
  speciesWithBonuses.forEach(species => {
    console.log(`  ❌ ${species.name} (${species.source}): ${JSON.stringify(species.ability_bonuses)}`);
  });
} else {
  console.log('  ✅ No species found with ability score bonuses');
}

// Check for species with lineages (converted subraces)
const speciesWithLineages = racesData.species.filter(species =>
  species.variants && species.variants.length > 0
);

if (speciesWithLineages.length > 0) {
  speciesWithLineages.forEach(species => {
    console.log(`  ✅ ${species.name}: ${species.variants.length} lineages (converted)`);
    species.variants.forEach(variant => {
      console.log(`    - ${variant.name}`);
    });
  });
} else {
  console.log('  ✅ No species found with lineages');
}

// Check for edition compatibility
const edition2014 = racesData.species.filter(s => s.edition === '2014').length;
const edition2024 = racesData.species.filter(s => s.edition === '2024').length;
const noEdition = racesData.species.filter(s => !s.edition).length;

console.log(`  📊 2014 Edition: ${edition2014} species`);
console.log(`  📊 2024 Edition: ${edition2024} species`);
console.log(`  ⚠️  No Edition: ${noEdition} species`);

// Check for enhanced data coverage
console.log('\n4. Enhanced Data Coverage:');
const enhancedSpeciesCount = Object.keys(enhancedData).length;
console.log(`  📚 Enhanced descriptions available: ${enhancedSpeciesCount} species`);

// Summary
console.log('\n📋 SUMMARY:');
console.log(`  Total Species: ${racesData.species.length}`);
console.log(`  Need Ability Bonus Removal: ${speciesWithBonuses.length}`);
console.log(`  Lineages Converted: ${speciesWithLineages.length} species`);
console.log(`  Enhanced Data Coverage: ${enhancedSpeciesCount}/${racesData.species.length}`);

const completionPercentage = Math.round(
  ((racesData.species.length - speciesWithBonuses.length) / racesData.species.length) * 100
);
console.log(`  📈 Estimated Completion: ${completionPercentage}%`);

console.log('\n✅ Validation complete!');