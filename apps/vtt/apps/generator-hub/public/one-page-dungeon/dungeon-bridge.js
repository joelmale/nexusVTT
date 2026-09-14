// Dungeon Generator Bridge
// Intercepts saves and sends them to parent window

(function () {
  'use strict';

  function initializeBridge() {
    const originalSaveAs = window.saveAs;

    window.saveAs = function (blob, filename) {
      console.log('Intercepted saveAs call:', filename, blob.type);
      
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'DUNGEON_EXPORT_READY',
            payload: {
              blob: blob,
              filename: filename,
              mimeType: blob.type
            },
          },
          '*',
        );
      } else {
        // Fallback for standalone
        if (originalSaveAs) {
          originalSaveAs(blob, filename);
        }
      }
    };
    
    // Announce ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'DUNGEON_BRIDGE_READY' }, '*');
    }
  }

  // Set up bridge immediately
  initializeBridge();
})();
