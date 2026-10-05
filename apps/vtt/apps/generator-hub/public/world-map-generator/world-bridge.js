// World Generator Bridge
// Intercepts canvas exports and sends them to parent VTT window
// Based on OpenFL canvas rendering architecture

(function () {
  'use strict';

  // Ensure WebGL drawing buffer is preserved for canvas captures
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
      attributes = Object.assign({}, attributes, { preserveDrawingBuffer: true });
    }
    return originalGetContext.call(this, type, attributes);
  };

  const ORIGIN = window.location.origin;
  const GENERATOR_ID = 'world';

  // Store original methods
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  let isInternalExporting = false;

  function dispatchKeyEvent(keyCode, code, key, shiftKey = false) {
    const targetCanvas =
      document.querySelector('#openfl-content canvas') ||
      document.querySelector('canvas');

    for (const type of ['keydown', 'keyup']) {
      const evt = new KeyboardEvent(type, {
        key: key || '',
        code: code || '',
        keyCode: keyCode,
        which: keyCode,
        shiftKey: !!shiftKey,
        bubbles: true,
        cancelable: true,
        composed: true,
      });

      try {
        Object.defineProperty(evt, 'keyCode', { get: () => keyCode });
        Object.defineProperty(evt, 'which', { get: () => keyCode });
      } catch (_) {}

      if (targetCanvas) {
        try {
          targetCanvas.dispatchEvent(evt);
        } catch (_) {}
      }
      try {
        document.dispatchEvent(evt);
      } catch (_) {}
      try {
        window.dispatchEvent(evt);
      } catch (_) {}
    }
  }

  // Detect if canvas is the OpenFL world generator canvas
  function isWorldGeneratorCanvas(canvas) {
    if (canvas.parentElement?.id === 'openfl-content') {
      return true;
    }
    return canvas.width >= 800 && canvas.height >= 600;
  }

  // Export canvas with full + thumbnail
  function exportMap(canvas) {
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

    isInternalExporting = true;
    return Promise.all([
      // Full resolution export using original toBlob to avoid recursive intercept
      new Promise((resolve) => {
        originalToBlob.call(canvas, resolve, fullFormat, fullQuality);
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
        originalToBlob.call(thumbCanvas, resolve, thumbFormat, thumbQuality);
      }),
    ])
      .then(([fullBlob, thumbBlob]) => {
        isInternalExporting = false;
        return Promise.all([blobToDataURL(fullBlob), blobToDataURL(thumbBlob)]);
      })
      .catch((err) => {
        isInternalExporting = false;
        throw err;
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

    if (!isInternalExporting && isWorldGeneratorCanvas(canvas) && mimeType?.includes('image/')) {
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
              quality: Math.min(quality || 0.85, 0.7),
            },
            meta: {
              width: canvas.width,
              height: canvas.height,
              timestamp: Date.now(),
              generator: 'world-map-generator',
            },
          };

          window.parent.postMessage(message, '*');
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
            '*',
          );
        });
    }

    // Call original method
    return originalToBlob.call(this, callback, mimeType, quality);
  };

  // Intercept toDataURL as fallback
  HTMLCanvasElement.prototype.toDataURL = function (mimeType, quality) {
    const canvas = this;

    if (!isInternalExporting && isWorldGeneratorCanvas(canvas) && mimeType?.includes('image/')) {
      console.log('World Generator Bridge: Intercepted toDataURL export');

      try {
        const fullDataURL = originalToDataURL.call(this, mimeType, quality);

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

        window.parent.postMessage(message, '*');
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

  function triggerWorldExport() {
    const canvas =
      document.querySelector('#openfl-content canvas') ||
      document.querySelector('canvas');
    if (canvas && isWorldGeneratorCanvas(canvas)) {
      exportMap(canvas)
        .then(([fullDataURL, thumbDataURL]) => {
          const message = {
            type: 'VTT_MAP_EXPORTED',
            generatorId: GENERATOR_ID,
            full: {
              dataUrl: fullDataURL,
              mime: 'image/webp',
              quality: 0.85,
            },
            thumb: {
              dataUrl: thumbDataURL,
              mime: 'image/webp',
              quality: 0.7,
            },
            meta: {
              width: canvas.width,
              height: canvas.height,
              timestamp: Date.now(),
              generator: 'world-map-generator',
            },
          };
          window.parent.postMessage(message, '*');
          console.log('World Generator Bridge: Auto-exported map to VTT', message.meta);
        })
        .catch((error) => {
          console.warn('World Generator Bridge: Auto-export failed', error);
        });
    }
  }

  // Listen for parent messages
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'REQUEST_EXPORT' || data.type === 'generator/export-request') {
      console.log('World Generator Bridge: Received export request from parent');
      triggerWorldExport();
    } else if (data.type === 'EXECUTE_ACTION' && data.keyCode) {
      console.log('World Generator Bridge: Executing action keyCode:', data.keyCode);
      try {
        dispatchKeyEvent(data.keyCode, data.code, data.key, data.shiftKey);

        if ([13, 83, 71, 49, 50, 51, 52, 53, 65, 67, 70, 76, 77, 78, 82].includes(data.keyCode)) {
          setTimeout(triggerWorldExport, 1000);
        }
      } catch (e) {
        console.warn('World Generator Bridge: Action dispatch error:', e);
      }
    }
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.keyCode === 13) {
        setTimeout(triggerWorldExport, 1200);
      }
    },
    false,
  );

  // Auto-export initial world map after render
  setTimeout(triggerWorldExport, 1800);

  console.log(
    'World Generator Bridge loaded - canvas exports will be intercepted for VTT',
  );

  // Notify parent that bridge is ready
  window.parent.postMessage(
    {
      type: 'VTT_GEN_READY',
      generatorId: GENERATOR_ID,
      timestamp: Date.now(),
    },
    '*',
  );
})();
