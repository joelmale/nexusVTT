// Test script to verify WebP detection and format selection
// This simulates the logic from dungeon-bridge.js

function getOptimalImageFormat() {
  // Test WebP support by creating a small canvas and checking toDataURL
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = testCanvas.height = 1;
    const testDataURL = testCanvas.toDataURL('image/webp');
    return testDataURL.indexOf('data:image/webp') === 0
      ? 'image/webp'
      : 'image/png';
  } catch (e) {
    return 'image/png'; // Fallback on any error
  }
}

// Test the format detection
const format = getOptimalImageFormat();
const quality = format === 'image/webp' ? 0.9 : undefined;

console.log('Browser WebP support test:');
console.log('Format:', format);
console.log('Quality:', quality);

// Test canvas to blob conversion
const testCanvas = document.createElement('canvas');
testCanvas.width = testCanvas.height = 100;
const ctx = testCanvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 100, 100);

testCanvas.toBlob(
  (blob) => {
    console.log('Blob size:', blob.size, 'bytes');
    console.log('Blob type:', blob.type);
    console.log('Expected format:', format);

    // Test base64 conversion
    const reader = new FileReader();
    reader.onloadend = function () {
      const base64 = reader.result;
      console.log('Base64 length:', base64.length, 'characters');
      console.log('Base64 starts with:', base64.substring(0, 50) + '...');
    };
    reader.readAsDataURL(blob);
  },
  format,
  quality,
);
