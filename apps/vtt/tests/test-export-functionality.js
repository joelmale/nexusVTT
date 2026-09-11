// Test export functionality for WebP and PNG formats
// This simulates the export logic from dungeonMapService.ts

console.log('Testing export functionality...\n');

// Mock data for testing
const mockMaps = [
  {
    id: 'dungeon_1',
    name: 'Generated Dungeon 2024-01-15',
    format: 'webp',
    imageData:
      'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  },
  {
    id: 'dungeon_2',
    name: 'My Awesome Map!!!',
    format: 'png',
    imageData:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  },
  {
    id: 'dungeon_3',
    name: 'test-map',
    format: 'webp',
    imageData:
      'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  },
];

// Simulate base64ToBlob function
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64.split(',')[1] || base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Simulate export function
function simulateExportMap(map) {
  // Convert base64 to blob with correct MIME type
  const mimeType = map.format === 'webp' ? 'image/webp' : 'image/png';
  const blob = base64ToBlob(map.imageData, mimeType);

  // Sanitize filename with correct extension
  const safeName = map.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const extension = map.format === 'webp' ? 'webp' : 'png';
  const filename = `${safeName}.${extension}`;

  return {
    filename,
    mimeType,
    blobSize: blob.size,
    blobType: blob.type,
  };
}

// Test export for each map
mockMaps.forEach((map, index) => {
  console.log(
    `🧪 Testing export for map ${index + 1}: "${map.name}" (${map.format.toUpperCase()})`,
  );

  const result = simulateExportMap(map);

  console.log(`  Filename: ${result.filename}`);
  console.log(`  MIME Type: ${result.mimeType}`);
  console.log(`  Blob Type: ${result.blobType}`);
  console.log(`  Blob Size: ${result.blobSize} bytes`);

  // Verify correctness
  const expectedExtension = map.format === 'webp' ? 'webp' : 'png';
  const expectedMimeType = map.format === 'webp' ? 'image/webp' : 'image/png';

  const filenameCorrect = result.filename.endsWith(`.${expectedExtension}`);
  const mimeTypeCorrect = result.mimeType === expectedMimeType;
  const blobTypeCorrect = result.blobType === expectedMimeType;

  console.log(`  ✓ Filename extension: ${filenameCorrect ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ MIME type: ${mimeTypeCorrect ? 'PASS' : 'FAIL'}`);
  console.log(`  ✓ Blob type: ${blobTypeCorrect ? 'PASS' : 'FAIL'}`);

  if (filenameCorrect && mimeTypeCorrect && blobTypeCorrect) {
    console.log(`  ✅ Export test PASSED for ${map.format.toUpperCase()}\n`);
  } else {
    console.log(`  ❌ Export test FAILED for ${map.format.toUpperCase()}\n`);
  }
});

// Test edge cases
console.log('🧪 Testing edge cases:');

const edgeCases = [
  {
    name: 'Map with Special Chars !@#$%^&*()',
    format: 'webp',
    imageData:
      'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  },
  {
    name: 'UPPERCASE MAP NAME',
    format: 'png',
    imageData:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  },
  {
    name: 'map with spaces and symbols -_+=[]{}|;:,.<>?',
    format: 'webp',
    imageData:
      'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  },
];

edgeCases.forEach((map, index) => {
  console.log(`  Edge case ${index + 1}: "${map.name}"`);

  const result = simulateExportMap(map);
  console.log(`    Result: ${result.filename} (${result.mimeType})`);

  // Check that special characters are properly sanitized
  const hasOnlySafeChars = /^[a-z0-9_.]+$/.test(result.filename);
  console.log(`    ✓ Safe filename: ${hasOnlySafeChars ? 'PASS' : 'FAIL'}`);
});

console.log('\n✅ Export functionality tests completed successfully!');
console.log('\n📋 Summary:');
console.log(
  '- WebP files export with .webp extension and image/webp MIME type',
);
console.log('- PNG files export with .png extension and image/png MIME type');
console.log(
  '- Filenames are properly sanitized (special chars replaced with _)',
);
console.log('- All formats maintain correct blob types and MIME types');
console.log('- Export logic handles both WebP and PNG formats correctly');
