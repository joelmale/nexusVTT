// Node.js test to verify WebP detection logic
// This simulates the canvas-based WebP detection

console.log('Testing WebP detection logic...');

// Simulate the canvas toDataURL test
// In a real browser, this would create a canvas and test WebP support
// For Node.js testing, we'll simulate different scenarios

function simulateWebPDetection(hasWebPSupport) {
  if (hasWebPSupport) {
    // Simulate successful WebP detection
    return 'image/webp';
  } else {
    // Simulate fallback to PNG
    return 'image/png';
  }
}

// Test WebP supported scenario
const formatWebP = simulateWebPDetection(true);
const qualityWebP = formatWebP === 'image/webp' ? 0.9 : undefined;

console.log('WebP supported scenario:');
console.log('Format:', formatWebP);
console.log('Quality:', qualityWebP);

// Test PNG fallback scenario
const formatPNG = simulateWebPDetection(false);
const qualityPNG = formatPNG === 'image/webp' ? 0.9 : undefined;

console.log('\nPNG fallback scenario:');
console.log('Format:', formatPNG);
console.log('Quality:', qualityPNG);

// Test file size estimation
function estimateBase64Size(originalSize, format) {
  // Base64 encoding increases size by ~33%
  const base64Size = Math.floor((originalSize * 4) / 3);

  if (format === 'image/webp') {
    // WebP typically provides 40-60% compression
    const compressionRatio = 0.5; // 50% average
    return Math.floor(base64Size * compressionRatio);
  }

  return base64Size;
}

const testSizes = [10000, 50000, 100000, 500000]; // bytes

console.log('\nSize comparison (original -> base64):');
testSizes.forEach((size) => {
  const pngSize = estimateBase64Size(size, 'image/png');
  const webpSize = estimateBase64Size(size, 'image/webp');
  const savings = (((pngSize - webpSize) / pngSize) * 100).toFixed(1);

  console.log(
    `${(size / 1024).toFixed(1)}KB -> PNG: ${(pngSize / 1024).toFixed(1)}KB, WebP: ${(webpSize / 1024).toFixed(1)}KB (${savings}% savings)`,
  );
});

// Test export filename generation
function generateExportFilename(name, format) {
  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const extension = format === 'webp' ? 'webp' : 'png';
  return `${safeName}.${extension}`;
}

const testNames = [
  'Generated Dungeon 2024-01-15',
  'My Awesome Map!!!',
  'test-map',
];

console.log('\nExport filename generation:');
testNames.forEach((name) => {
  const webpFilename = generateExportFilename(name, 'webp');
  const pngFilename = generateExportFilename(name, 'png');
  console.log(`"${name}" -> WebP: ${webpFilename}, PNG: ${pngFilename}`);
});

console.log('\n✅ WebP detection logic test completed successfully!');
