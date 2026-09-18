// Cave Generator Bridge
// Intercepts saves, auto-exports on render/reroll, and listens for parent commands

(function () {
  'use strict';

  let lastExportTime = 0;
  let exportPending = false;

  function captureCanvasFallback() {
    try {
      const canvas =
        document.querySelector('#openfl-content canvas') ||
        document.querySelector('canvas');
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        canvas.toBlob(function (blob) {
          if (blob && blob.size > 0 && window.parent !== window) {
            console.log('Cave Bridge: Canvas fallback export captured');
            lastExportTime = Date.now();
            exportPending = false;
            window.parent.postMessage(
              {
                type: 'CAVE_EXPORT_READY',
                payload: {
                  blob: blob,
                  filename: 'cave_' + Date.now() + '.png',
                  mimeType: 'image/png',
                },
              },
              '*',
            );
          }
        }, 'image/png');
      }
    } catch (e) {
      console.warn('Cave Bridge: Canvas fallback capture failed:', e);
      exportPending = false;
    }
  }

  function triggerExport() {
    if (exportPending) return;
    exportPending = true;

    const beforeTime = lastExportTime;

    // Dispatch key event for 'E' (OpenFL / Watabou savePNG)
    try {
      const evt = new KeyboardEvent('keydown', {
        keyCode: 69,
        which: 69,
        code: 'KeyE',
        key: 'e',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(evt);
    } catch (err) {
      console.warn('Cave Bridge: dispatchEvent failed:', err);
    }

    // Safety fallback: if saveAs wasn't triggered within 600ms, use canvas fallback
    setTimeout(() => {
      if (lastExportTime === beforeTime) {
        captureCanvasFallback();
      } else {
        exportPending = false;
      }
    }, 600);
  }

  function initializeBridge() {
    const originalSaveAs = window.saveAs;

    window.saveAs = function (blob, filename) {
      console.log('Cave Bridge: Intercepted saveAs call:', filename, blob.type);
      lastExportTime = Date.now();
      exportPending = false;

      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'CAVE_EXPORT_READY',
            payload: {
              blob: blob,
              filename: filename || 'cave.png',
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
      window.parent.postMessage({ type: 'CAVE_BRIDGE_READY' }, '*');
    }

    // Listen for parent requests
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'REQUEST_EXPORT' || data.type === 'generator/export-request') {
        console.log('Cave Bridge: Received export request from parent');
        triggerExport();
      } else if (data.type === 'EXECUTE_ACTION' && data.keyCode) {
        console.log('Cave Bridge: Executing action keyCode:', data.keyCode);
        try {
          const keyEvt = new KeyboardEvent('keydown', {
            keyCode: data.keyCode,
            which: data.keyCode,
            code: data.code || '',
            key: data.key || '',
            shiftKey: !!data.shiftKey,
            bubbles: true,
            cancelable: true,
          });
          window.dispatchEvent(keyEvt);

          if ([13, 32, 83, 71].includes(data.keyCode)) {
            setTimeout(triggerExport, 800);
          }
        } catch (e) {
          console.warn('Cave Bridge: Action dispatch error:', e);
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
