import { useEffect, useRef, useState } from 'react';
import type { GeneratorHostMessage } from '../../../shared/generator/protocol';
import { getGeneratorUrl, type GeneratorSource } from './generatorUrl';

function isGeneratorSource(value: string | null): value is GeneratorSource {
  return (
    value === 'dungeon' ||
    value === 'world' ||
    value === 'cave' ||
    value === 'city' ||
    value === 'dwelling'
  );
}

function getSvgDimensions(
  svgText: string,
): { width: number; height: number } | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (svg) {
      const widthAttr = parseFloat(svg.getAttribute('width') || '');
      const heightAttr = parseFloat(svg.getAttribute('height') || '');
      if (widthAttr > 0 && heightAttr > 0) {
        return { width: Math.round(widthAttr), height: Math.round(heightAttr) };
      }
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
        }
      }
    }
  } catch {
    // Fallback if parsing fails
  }
  return null;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/webp';
  const binaryString = atob(parts[1] || '');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function getImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (dims.width > 0 && dims.height > 0) return dims;
    } catch {
      // Fallback
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth || img.width || 2000,
        height: img.naturalHeight || img.height || 2000,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 2000, height: 2000 });
    };
    img.src = url;
  });
}

async function rasterizeSvgToWebp(
  svgText: string,
  hintWidth?: number,
  hintHeight?: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const naturalWidth = img.naturalWidth || img.width || hintWidth || 2000;
      const naturalHeight =
        img.naturalHeight || img.height || hintHeight || 2000;

      const canvas = document.createElement('canvas');
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Failed to get canvas context'));
      }

      ctx.fillStyle = 'white'; // default background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (webpBlob) => {
          URL.revokeObjectURL(url);
          if (webpBlob) {
            resolve({
              blob: webpBlob,
              width: canvas.width,
              height: canvas.height,
            });
          } else {
            reject(new Error('Failed to create WebP blob'));
          }
        },
        'image/webp',
        0.9,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG for rasterization'));
    };

    img.src = url;
  });
}

function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  // Determine which generator to load based on URL params
  const urlParams = new URLSearchParams(window.location.search);
  const requestedGenerator = urlParams.get('generator');
  const generator = isGeneratorSource(requestedGenerator)
    ? requestedGenerator
    : 'dungeon';
  const forceRasterize = urlParams.get('rasterize') === 'true';

  const iframeSrc = getGeneratorUrl(generator, window.location.href);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // 1. Handle commands from parent (Nexus VTT)
      if (event.source === window.parent && window.parent !== window) {
        if (event.data?.type === 'generator/export-request') {
          console.log('[GeneratorHub] Forwarding export-request to generator iframe');
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'REQUEST_EXPORT' },
            '*',
          );
        } else if (event.data?.type === 'generator/action') {
          console.log('[GeneratorHub] Forwarding action to generator iframe', event.data);
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'EXECUTE_ACTION',
              keyCode: event.data.keyCode,
              code: event.data.code,
              key: event.data.key,
              shiftKey: event.data.shiftKey,
            },
            '*',
          );
        }
        return;
      }

      // 2. Trust the generator iframe we created
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (
        event.data.type === 'DUNGEON_BRIDGE_READY' ||
        event.data.type === 'CAVE_BRIDGE_READY' ||
        event.data.type === 'CITY_BRIDGE_READY' ||
        event.data.type === 'DWELLINGS_BRIDGE_READY' ||
        event.data.type === 'WORLD_BRIDGE_READY' ||
        event.data.type === 'VTT_GEN_READY'
      ) {
        setLoading(false);
        // Inform parent that generator is fully ready
        window.parent.postMessage({ type: 'generator/ready' }, '*');
      }

      // Handle World Generator (legacy/fallback dataUrl payload)
      if (
        event.data.type === 'VTT_MAP_EXPORTED' &&
        event.data.generatorId === 'world'
      ) {
        const payload = event.data;
        const dataUrl = payload.full?.dataUrl;
        if (!dataUrl) return;

        const blob = dataUrlToBlob(dataUrl);
        const dims = await getImageDimensions(blob);

        const msg: GeneratorHostMessage = {
          type: 'generator/export-ready',
          payload: {
            protocolVersion: '1.0',
            exportId: Math.random().toString(36).slice(2),
            importId: Math.random().toString(36).slice(2),
            source: 'world',
            generatorVersion: '1.0',
            byteLength: blob.size,
            grid: {
              bakedIntoImage: true,
            },
            payload: {
              kind: 'raster',
              blob,
              mimeType: blob.type as 'image/webp' | 'image/png',
              width: dims.width,
              height: dims.height,
            },
          },
        };
        window.parent.postMessage(msg, '*');
        return;
      }

      if (
        event.data.type === 'DUNGEON_EXPORT_READY' ||
        event.data.type === 'CAVE_EXPORT_READY' ||
        event.data.type === 'CITY_EXPORT_READY' ||
        event.data.type === 'DWELLINGS_EXPORT_READY' ||
        event.data.type === 'WORLD_EXPORT_READY'
      ) {
        const { blob, mimeType, width: hintedWidth, height: hintedHeight } =
          event.data.payload || {};

        let finalBlob = blob;
        let finalMimeType = mimeType;
        let format: 'svg' | 'webp' | 'png' = 'svg';
        let outputWidth = hintedWidth;
        let outputHeight = hintedHeight;

        // Font decision gate & rasterization
        if (mimeType === 'image/svg+xml') {
          const text = await blob.text();
          const svgDims = getSvgDimensions(text);
          outputWidth = svgDims?.width || outputWidth;
          outputHeight = svgDims?.height || outputHeight;

          // Extremely basic check - if it references fonts not standard, we rasterize
          const requiresRasterization =
            text.includes('font-family') &&
            !text.includes('font-family="monospace"');

          if (forceRasterize || requiresRasterization) {
            console.log(
              'Rasterizing SVG to WebP due to font constraints or user preference',
            );
            const rasterResult = await rasterizeSvgToWebp(
              text,
              outputWidth,
              outputHeight,
            );
            finalBlob = rasterResult.blob;
            outputWidth = rasterResult.width;
            outputHeight = rasterResult.height;
            finalMimeType = 'image/webp';
            format = 'webp';
          }
        } else {
          format = mimeType === 'image/png' ? 'png' : 'webp';
          const dims = await getImageDimensions(finalBlob);
          outputWidth = dims.width;
          outputHeight = dims.height;
        }

        const msg: GeneratorHostMessage = {
          type: 'generator/export-ready',
          payload: {
            protocolVersion: '1.0',
            exportId: Math.random().toString(36).slice(2),
            importId: Math.random().toString(36).slice(2),
            source: generator,
            generatorVersion: '1.0',
            byteLength: finalBlob.size,
            grid: {
              bakedIntoImage: true,
            },
            payload:
              format === 'svg'
                ? {
                    kind: 'svg-master',
                    blob: finalBlob,
                    mimeType: 'image/svg+xml',
                    width: outputWidth || 2000,
                    height: outputHeight || 2000,
                  }
                : {
                    kind: 'raster',
                    blob: finalBlob,
                    mimeType: finalMimeType as 'image/webp' | 'image/png',
                    width: outputWidth || 2000,
                    height: outputHeight || 2000,
                  },
          },
        };

        window.parent.postMessage(msg, '*');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [forceRasterize, generator]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        background: '#000000',
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111827',
            color: 'white',
            zIndex: 10,
          }}
        >
          Loading Generator...
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          minHeight: 0,
          border: 'none',
          display: 'block',
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
        title="Generator Content"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}

export default App;
