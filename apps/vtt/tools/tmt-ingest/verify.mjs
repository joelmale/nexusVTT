import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

const release = process.argv[2] || '1.1.1';
const stagingDir = path.resolve(`../../assets-data/staging/${release}`);
const manifestPath = path.join(stagingDir, 'normalized-manifest.json');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

console.log("Running normalization pass 1...");
execSync(`node normalize.mjs ${release}`, { stdio: 'inherit' });
const hash1 = hashFile(manifestPath);

console.log("Running normalization pass 2...");
execSync(`node normalize.mjs ${release}`, { stdio: 'inherit' });
const hash2 = hashFile(manifestPath);

if (hash1 === hash2) {
  console.log(`SUCCESS: Determinism verified. Hash: ${hash1}`);
} else {
  console.error(`ERROR: Non-deterministic output!\nPass 1: ${hash1}\nPass 2: ${hash2}`);
  process.exit(1);
}
