// Dungeon Generator Bridge
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
            console.log('Dungeon Bridge: Canvas fallback export captured');
            lastExportTime = Date.now();
            exportPending = false;
            window.parent.postMessage(
              {
                type: 'DUNGEON_EXPORT_READY',
                payload: {
                  blob: blob,
                  filename: 'dungeon_' + Date.now() + '.png',
                  mimeType: 'image/png',
                },
              },
              '*',
            );
          }
        }, 'image/png');
      }
    } catch (e) {
      console.warn('Dungeon Bridge: Canvas fallback capture failed:', e);
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
      console.warn('Dungeon Bridge: dispatchEvent failed:', err);
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
      console.log('Dungeon Bridge: Intercepted saveAs call:', filename, blob.type);
      lastExportTime = Date.now();
      exportPending = false;

      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'DUNGEON_EXPORT_READY',
            payload: {
              blob: blob,
              filename: filename || 'dungeon.png',
              mimeType: blob.type || 'image/png',
            },
          },
          '*',
        );
      } else if (originalSaveAs) {
        originalSaveAs(blob, filename);
      }
    };

    // Announce ready to parent
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'DUNGEON_BRIDGE_READY' }, '*');
    }

    // Listen for parent requests
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'REQUEST_EXPORT' || data.type === 'generator/export-request') {
        console.log('Dungeon Bridge: Received export request from parent');
        triggerExport();
      } else if (data.type === 'EXECUTE_ACTION' && data.keyCode) {
        console.log('Dungeon Bridge: Executing action keyCode:', data.keyCode);
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

          // If action rerolls or changes visuals, refresh the export after layout settles
          if ([13, 32, 83, 71, 77, 82].includes(data.keyCode)) {
            setTimeout(triggerExport, 800);
          }
        } catch (e) {
          console.warn('Dungeon Bridge: Action dispatch error:', e);
        }
      }
    });

    // Also auto-refresh export when user types Enter (13) or Space (32) inside the iframe
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.keyCode === 13 || e.keyCode === 32) {
          setTimeout(triggerExport, 900);
        }
      },
      false,
    );

    // Initial auto-export after map renders
    setTimeout(triggerExport, 1200);
  }

  // Set up bridge immediately
  initializeBridge();
})();
