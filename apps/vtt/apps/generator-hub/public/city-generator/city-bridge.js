// City Generator Bridge
// Intercepts saves, auto-exports on render/reroll, and listens for parent commands

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

  let lastExportTime = 0;
  let exportPending = false;

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

  function captureCanvas() {
    try {
      const canvas =
        document.querySelector('#openfl-content canvas') ||
        document.querySelector('canvas');
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        canvas.toBlob(function (blob) {
          if (blob && blob.size > 0 && window.parent !== window) {
            console.log('City Bridge: Canvas export captured', canvas.width, canvas.height);
            lastExportTime = Date.now();
            exportPending = false;
            window.parent.postMessage(
              {
                type: 'CITY_EXPORT_READY',
                payload: {
                  blob: blob,
                  filename: 'city_' + Date.now() + '.png',
                  mimeType: 'image/png',
                },
              },
              '*',
            );
          }
        }, 'image/png');
      }
    } catch (e) {
      console.warn('City Bridge: Canvas capture failed:', e);
      exportPending = false;
    }
  }

  function triggerExport() {
    if (exportPending) return;
    exportPending = true;
    setTimeout(captureCanvas, 50);
  }

  function initializeBridge() {
    const originalSaveAs = window.saveAs;

    window.saveAs = function (blob, filename) {
      console.log('City Bridge: Intercepted saveAs call:', filename, blob.type);
      lastExportTime = Date.now();
      exportPending = false;

      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'CITY_EXPORT_READY',
            payload: {
              blob: blob,
              filename: filename || 'city.png',
              mimeType: blob.type || 'image/png',
            },
          },
          '*',
        );
      } else if (originalSaveAs) {
        originalSaveAs(blob, filename);
      }
    };

    // Announce ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'CITY_BRIDGE_READY' }, '*');
    }

    // Listen for parent requests
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'REQUEST_EXPORT' || data.type === 'generator/export-request') {
        console.log('City Bridge: Received export request from parent');
        triggerExport();
      } else if (data.type === 'EXECUTE_ACTION' && data.keyCode) {
        console.log('City Bridge: Executing action keyCode:', data.keyCode);
        try {
          dispatchKeyEvent(data.keyCode, data.code, data.key, data.shiftKey);

          if ([13, 83, 67, 84, 80, 65, 66, 68, 69, 76].includes(data.keyCode)) {
            setTimeout(triggerExport, 800);
          }
        } catch (e) {
          console.warn('City Bridge: Action dispatch error:', e);
        }
      }
    });

    // Auto-refresh export when user types Enter inside the iframe
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.keyCode === 13) {
          setTimeout(triggerExport, 900);
        }
      },
      false,
    );

    // Initial auto-export after render
    setTimeout(triggerExport, 1200);
  }

  // Set up bridge immediately
  initializeBridge();
})();
