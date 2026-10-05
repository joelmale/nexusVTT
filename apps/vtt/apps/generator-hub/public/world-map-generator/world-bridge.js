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

  const GENERATOR_ID = 'world';
  let lastExportTime = 0;
  let lastExportAttempt = 0;
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

  function captureCanvas(retryCount = 0) {
    try {
      const canvas =
        document.querySelector('#openfl-content canvas') ||
        document.querySelector('canvas');

      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        exportPending = false;
        if (retryCount < 10) {
          setTimeout(() => triggerWorldExport(retryCount + 1), 600);
        }
        return;
      }

      canvas.toBlob(function (blob) {
        exportPending = false;
        if (blob && blob.size > 0 && window.parent !== window) {
          console.log('World Generator Bridge: Canvas export captured', canvas.width, canvas.height);
          lastExportTime = Date.now();
          window.parent.postMessage(
            {
              type: 'WORLD_EXPORT_READY',
              payload: {
                blob: blob,
                filename: 'world_' + Date.now() + '.png',
                mimeType: 'image/png',
                width: canvas.width,
                height: canvas.height,
              },
            },
            '*',
          );
        } else if (retryCount < 10) {
          setTimeout(() => triggerWorldExport(retryCount + 1), 600);
        }
      }, 'image/png');
    } catch (e) {
      console.warn('World Generator Bridge: Canvas capture failed:', e);
      exportPending = false;
    }
  }

  function triggerWorldExport(retryCount = 0) {
    if (exportPending && retryCount === 0 && Date.now() - lastExportAttempt < 2000) return;
    exportPending = true;
    lastExportAttempt = Date.now();
    setTimeout(() => captureCanvas(retryCount), 50);
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
          setTimeout(() => triggerWorldExport(0), 1000);
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
        setTimeout(() => triggerWorldExport(0), 1200);
      }
    },
    false,
  );

  // Auto-export initial world map after render with retry support
  setTimeout(() => triggerWorldExport(0), 1500);

  console.log(
    'World Generator Bridge loaded - canvas exports will be captured for VTT',
  );

  // Notify parent that bridge is ready
  window.parent.postMessage(
    {
      type: 'WORLD_BRIDGE_READY',
      generatorId: GENERATOR_ID,
      timestamp: Date.now(),
    },
    '*',
  );
  window.parent.postMessage(
    {
      type: 'VTT_GEN_READY',
      generatorId: GENERATOR_ID,
      timestamp: Date.now(),
    },
    '*',
  );
})();
