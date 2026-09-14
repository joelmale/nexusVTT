// World Generator Bridge
// Intercepts canvas exports and sends them to parent VTT window
// Based on OpenFL canvas rendering architecture

(function () {
  'use strict';

  const ORIGIN = window.location.origin;
  const GENERATOR_ID = 'world';

  // Store original methods
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  // Detect if canvas is the OpenFL world generator canvas
  function isWorldGeneratorCanvas(canvas) {
    // Primary heuristic: OpenFL canvas in #openfl-content
    if (canvas.parentElement?.id === 'openfl-content') {
      return true;
    }

    // Fallback: Large canvas (world maps are typically big)
    return canvas.width >= 800 && canvas.height >= 600;
  }

  // Export canvas with full + thumbnail
  function exportMap(canvas) {
    // Detect optimal format (WebP with PNG fallback)
    const supportsWebP = (() => {
      try {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = testCanvas.height = 1;
        return (
          testCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
        );
      } catch (e) {
        return false;
      }
    })();

    const fullFormat = supportsWebP ? 'image/webp' : 'image/png';
    const fullQuality = supportsWebP ? 0.85 : undefined;

    return Promise.all([
      // Full resolution export
      new Promise((resolve) => {
        canvas.toBlob(resolve, fullFormat, fullQuality);
      }),
      // Thumbnail (max 512px on longest side)
      new Promise((resolve) => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = Math.max(1, Math.round(canvas.width * scale));
        thumbCanvas.height = Math.max(1, Math.round(canvas.height * scale));

        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }

        const thumbFormat = supportsWebP ? 'image/webp' : 'image/png';
        const thumbQuality = supportsWebP ? 0.7 : undefined;
        thumbCanvas.toBlob(resolve, thumbFormat, thumbQuality);
      }),
    ]).then(([fullBlob, thumbBlob]) => {
      return Promise.all([blobToDataURL(fullBlob), blobToDataURL(thumbBlob)]);
    });
  }

  // Convert blob to data URL
  function blobToDataURL(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // Intercept toBlob (primary export path for OpenFL)
  HTMLCanvasElement.prototype.toBlob = function (callback, mimeType, quality) {
    const canvas = this;

    if (isWorldGeneratorCanvas(canvas) && mimeType?.includes('image/')) {
      console.log('World Generator Bridge: Intercepted canvas export', {
        width: canvas.width,
        height: canvas.height,
        mimeType,
        quality,
      });

      // Export for VTT
      exportMap(canvas)
        .then(([fullDataURL, thumbDataURL]) => {
          const message = {
            type: 'VTT_MAP_EXPORTED',
            generatorId: GENERATOR_ID,
            full: {
              dataUrl: fullDataURL,
              mime: mimeType || 'image/webp',
              quality: quality || 0.85,
            },
            thumb: {
              dataUrl: thumbDataURL,
              mime: mimeType || 'image/webp',
              quality: Math.min(quality || 0.85, 0.7), // Lower quality for thumbs
            },
            meta: {
              width: canvas.width,
              height: canvas.height,
              timestamp: Date.now(),
              generator: 'world-map-generator',
            },
          };

          window.parent.postMessage(message, ORIGIN);
          console.log('World Generator Bridge: Sent map to VTT', message.meta);
        })
        .catch((error) => {
          console.error('World Generator Bridge: Export failed', error);
          window.parent.postMessage(
            {
              type: 'VTT_GEN_ERROR',
              generatorId: GENERATOR_ID,
              message: `Export failed: ${error.message}`,
              timestamp: Date.now(),
            },
            ORIGIN,
          );
        });
    }

    // Call original method
    return originalToBlob.call(this, callback, mimeType, quality);
  };

  // Intercept toDataURL as fallback
  HTMLCanvasElement.prototype.toDataURL = function (mimeType, quality) {
    const canvas = this;

    if (isWorldGeneratorCanvas(canvas) && mimeType?.includes('image/')) {
      console.log('World Generator Bridge: Intercepted toDataURL export');

      // For toDataURL, we can export synchronously
      try {
        const fullDataURL = originalToDataURL.call(this, mimeType, quality);

        // Create thumbnail synchronously
        const max = 512;
        const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = Math.max(1, Math.round(canvas.width * scale));
        thumbCanvas.height = Math.max(1, Math.round(canvas.height * scale));

        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }

        const thumbDataURL = thumbCanvas.toDataURL(
          mimeType,
          Math.min(quality || 1, 0.7),
        );

        const message = {
          type: 'VTT_MAP_EXPORTED',
          generatorId: GENERATOR_ID,
          full: {
            dataUrl: fullDataURL,
            mime: mimeType,
            quality: quality || 1,
          },
          thumb: {
            dataUrl: thumbDataURL,
            mime: mimeType,
            quality: Math.min(quality || 1, 0.7),
          },
          meta: {
            width: canvas.width,
            height: canvas.height,
            timestamp: Date.now(),
            generator: 'world-map-generator',
          },
        };

        window.parent.postMessage(message, ORIGIN);
        console.log(
          'World Generator Bridge: Sent map to VTT (toDataURL)',
          message.meta,
        );
      } catch (error) {
        console.error('World Generator Bridge: toDataURL export failed', error);
      }
    }

    // Call original method
    return originalToDataURL.call(this, mimeType, quality);
  };

  console.log(
    'World Generator Bridge loaded - canvas exports will be intercepted for VTT',
  );

  // Optional: Notify parent that bridge is ready
  window.parent.postMessage(
    {
      type: 'VTT_GEN_READY',
      generatorId: GENERATOR_ID,
      timestamp: Date.now(),
    },
    ORIGIN,
  );
})();
