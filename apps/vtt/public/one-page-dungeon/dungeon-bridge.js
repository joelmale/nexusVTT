// Dungeon Generator Bridge
// Intercepts PNG saves and sends them to parent window

(function () {
  'use strict';

  // Wait for the page to fully load before setting up interception
  function initializeBridge() {
    // Store original functions
    const originalSaveAs = window.saveAs;
    const originalOcSavePNG = window.Oc && window.Oc.savePNG;

    // Detect optimal image format (WebP with PNG fallback)
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

    const optimalFormat = getOptimalImageFormat();
    const formatQuality = optimalFormat === 'image/webp' ? 0.75 : undefined; // Reduced from 0.9 to 0.75 for better compression

    console.log(
      'Dungeon Bridge: Using format:',
      optimalFormat,
      'quality:',
      formatQuality,
    );

    // Intercept Oc.savePNG (the actual function called by dungeon generator)
    if (window.Oc && window.Oc.savePNG) {
      window.Oc.savePNG = function (canvas, filename) {
        console.log(
          'Intercepted Oc.savePNG call:',
          filename,
          'format:',
          optimalFormat,
        );

        // Convert canvas to blob with optimal format
        canvas.toBlob(
          function (blob) {
            // Convert blob to data URL
            const reader = new FileReader();
            reader.onloadend = function () {
              const imageData = reader.result;

              // Send to parent window with format information
              if (window.parent !== window) {
                // Convert MIME type to short format name ('image/webp' -> 'webp')
                const shortFormat = optimalFormat.replace('image/', '');

                window.parent.postMessage(
                  {
                    type: 'DUNGEON_PNG_GENERATED',
                    data: {
                      imageData: imageData,
                      filename: filename,
                      format: shortFormat,
                      originalSize: blob.size,
                      timestamp: Date.now(),
                    },
                  },
                  window.location.origin,
                );
              }
            };
            reader.readAsDataURL(blob);
          },
          optimalFormat,
          formatQuality,
        );

        // Do NOT call original function - we want VTT-only capture, no downloads
      };
    }

    // Keep the original saveAs interception as fallback
    if (window.saveAs) {
      window.saveAs = function (blob, filename, options) {
        if (
          blob.type === 'image/png' ||
          blob.type === 'image/webp' ||
          (filename &&
            (filename.endsWith('.png') || filename.endsWith('.webp')))
        ) {
          const reader = new FileReader();
          reader.onloadend = function () {
            const imageData = reader.result;

            if (window.parent !== window) {
              // Convert MIME type to short format name ('image/webp' -> 'webp', 'image/png' -> 'png')
              const shortFormat = blob.type.replace('image/', '');

              window.parent.postMessage(
                {
                  type: 'DUNGEON_PNG_GENERATED',
                  data: {
                    imageData: imageData,
                    filename: filename,
                    format: shortFormat,
                    originalSize: blob.size,
                    timestamp: Date.now(),
                  },
                },
                window.location.origin,
              );
            }
          };
          reader.readAsDataURL(blob);
          return; // Prevent any download path for images

          // Do NOT call original for images - VTT-only capture
        } else {
          if (originalSaveAs) {
            originalSaveAs.call(window, blob, filename, options);
          }
        }
      };
    }

    console.log(
      'Dungeon Generator Bridge loaded - PNG saves will be intercepted',
    );
  }

  // Initialize bridge after a short delay to ensure dungeon generator is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initializeBridge, 1000); // Wait 1 second for dungeon generator to initialize
    });
  } else {
    setTimeout(initializeBridge, 1000);
  }
})();
