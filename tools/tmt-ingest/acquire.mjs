import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { execSync } from 'child_process';
import { parseArgs } from 'util';

const REPO_OWNER = 'IsThisMyRealName';
const REPO_NAME = 'too-many-tokens-dnd';

const { values } = parseArgs({
  options: {
    release: { type: 'string', default: '1.1.1' },
    dest: { type: 'string' }
  }
});

const release = values.release;
const dest = values.dest || path.resolve(`./assets-data/staging/${release}`);
const archiveUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/tags/${release}.tar.gz`;
const archivePath = path.join(dest, `archive-${release}.tar.gz`);

// 1. Setup dest
fs.mkdirSync(dest, { recursive: true });

// 2. Download and Hash Archive
console.log(`Downloading ${archiveUrl} into ${dest}...`);

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function walkAndHash(dir, destRoot, inventory) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      await walkAndHash(fullPath, destRoot, inventory);
    } else {
      const fileHash = await hashFile(fullPath);
      const relPath = path.relative(destRoot, fullPath);
      inventory[relPath] = {
        size: stat.size,
        hash: fileHash
      };
    }
  }
}

async function run() {
  try {
    await downloadFile(archiveUrl, archivePath);
    const archiveSha256 = await hashFile(archivePath);
    console.log(`Archive downloaded. SHA-256: ${archiveSha256}`);

    // 3. Extract
    console.log('Extracting archive...');
    execSync(`tar -xzf "${archivePath}" -C "${dest}" --strip-components=1`);
    fs.unlinkSync(archivePath);

    // 4. Compute per-file hashes
    console.log('Computing file hashes...');
    const inventory = {};
    await walkAndHash(dest, dest, inventory);

    // Sort inventory keys for determinism
    const sortedInventory = Object.keys(inventory).sort().reduce((acc, key) => {
      acc[key] = inventory[key];
      return acc;
    }, {});

    const fileCount = Object.keys(sortedInventory).length;

    fs.writeFileSync(path.join(dest, 'raw-inventory.json'), JSON.stringify(sortedInventory, null, 2));
    
    const lockData = {
      tag: release,
      archiveSha256,
      fileCount,
      acquiredAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(dest, 'release.lock.json'), JSON.stringify(lockData, null, 2));

    console.log(`Acquisition complete. ${fileCount} files processed.`);
  } catch (err) {
    console.error('Acquisition failed:', err);
    process.exit(1);
  }
}

run();
