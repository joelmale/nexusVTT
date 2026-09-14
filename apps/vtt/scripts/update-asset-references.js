import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Updating asset references...');

// Function to check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Function to update a file with new content
function updateFile(filePath, updater) {
  if (fileExists(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const newContent = updater(content);
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Updated ${filePath}`);
      return true;
    }
  }
  return false;
}

// Change to project root directory
const projectRoot = path.join(__dirname, '..');
process.chdir(projectRoot);

// Update index.html
updateFile('index.html', (content) => {
  let newContent = content;
  
  // Update favicon reference
  if (fileExists('public/assets/icons/nexus-icon.svg')) {
    newContent = newContent.replace(
      /rel="icon"[^>]*href="[^"]*"/,
      'rel="icon" type="image/svg+xml" href="/assets/icons/nexus-icon.svg"'
    );
  }
  
  // Update apple touch icon
  if (fileExists('public/assets/icons/nexus-apple-touch-icon.png')) {
    newContent = newContent.replace(
      /rel="apple-touch-icon"[^>]*href="[^"]*"/,
      'rel="apple-touch-icon" href="/assets/icons/nexus-apple-touch-icon.png"'
    );
  } else if (fileExists('public/assets/icons/nexus-icon-192.png')) {
    newContent = newContent.replace(
      /rel="apple-touch-icon"[^>]*href="[^"]*"/,
      'rel="apple-touch-icon" href="/assets/icons/nexus-icon-192.png"'
    );
  }
  
  // Update og:image
  if (fileExists('public/assets/images/og-image.png')) {
    newContent = newContent.replace(
      /property="og:image"[^>]*content="[^"]*"/,
      'property="og:image" content="/assets/images/og-image.png"'
    );
  }
  
  return newContent;
});

// Update manifest.json
updateFile('public/manifest.json', (content) => {
  try {
    const manifest = JSON.parse(content);
    
    // Update icons array
    manifest.icons = [];
    
    if (fileExists('public/assets/icons/nexus-icon-192.png')) {
      manifest.icons.push({
        "src": "/assets/icons/nexus-icon-192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any maskable"
      });
    }
    
    if (fileExists('public/assets/icons/nexus-icon-512.png')) {
      manifest.icons.push({
        "src": "/assets/icons/nexus-icon-512.png",
        "sizes": "512x512", 
        "type": "image/png",
        "purpose": "any maskable"
      });
    }
    
    return JSON.stringify(manifest, null, 2);
  } catch (e) {
    console.error('❌ Error updating manifest.json:', e.message);
    return content;
  }
});

// Check what assets are available
console.log('\n📋 Available assets:');
const assetChecks = [
  ['Logo SVG', 'public/assets/logos/nexus-logo.svg'],
  ['Logo PNG', 'public/assets/logos/nexus-logo.png'],
  ['Icon SVG', 'public/assets/icons/nexus-icon.svg'],
  ['Icon 192px', 'public/assets/icons/nexus-icon-192.png'],
  ['Icon 512px', 'public/assets/icons/nexus-icon-512.png'],
  ['Favicon ICO', 'public/assets/icons/nexus-favicon.ico'],
  ['Apple Touch Icon', 'public/assets/icons/nexus-apple-touch-icon.png'],
  ['OG Image', 'public/assets/images/og-image.png']
];

assetChecks.forEach(([name, path]) => {
  const exists = fileExists(path);
  console.log(`   ${exists ? '✅' : '❌'} ${name}: ${path}`);
});

console.log('\n🎯 To add missing assets:');
console.log('   1. Place files in the appropriate /public/assets/ directories');
console.log('   2. Run: npm run update-assets');
console.log('   3. Restart the dev server to see changes');

console.log('\n✅ Asset reference update complete!');
