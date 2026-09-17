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

async function rasterizeSvgToWebp(svgText: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));

      ctx.fillStyle = 'white'; // default background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (webpBlob) => {
          URL.revokeObjectURL(url);
          if (webpBlob) resolve(webpBlob);
          else reject(new Error('Failed to create WebP blob'));
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
      // Trust the iframe we created
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (
        event.data.type === 'DUNGEON_BRIDGE_READY' ||
        event.data.type === 'CAVE_BRIDGE_READY' ||
        event.data.type === 'CITY_BRIDGE_READY' ||
        event.data.type === 'DWELLINGS_BRIDGE_READY' ||
        event.data.type === 'VTT_GEN_READY'
      ) {
        setLoading(false);
      }

      // Handle World Generator
      if (
        event.data.type === 'VTT_MAP_EXPORTED' &&
        event.data.generatorId === 'world'
      ) {
        const payload = event.data;
        const dataUrl = payload.full?.dataUrl;
        if (!dataUrl) return;

        const res = await fetch(dataUrl);
        const blob = await res.blob();

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
              width: payload.meta?.width || 2000,
              height: payload.meta?.height || 2000,
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
        event.data.type === 'DWELLINGS_EXPORT_READY'
      ) {
        const { blob, mimeType } = event.data.payload;

        let finalBlob = blob;
        let finalMimeType = mimeType;
        let format: 'svg' | 'webp' | 'png' = 'svg';

        // Font decision gate & rasterization
        if (mimeType === 'image/svg+xml') {
          const text = await blob.text();
          // Extremely basic check - if it references fonts not standard, we rasterize
          const requiresRasterization =
            text.includes('font-family') &&
            !text.includes('font-family="monospace"');

          if (forceRasterize || requiresRasterization) {
            console.log(
              'Rasterizing SVG to WebP due to font constraints or user preference',
            );
            finalBlob = await rasterizeSvgToWebp(text);
            finalMimeType = 'image/webp';
            format = 'webp';
          }
        } else if (mimeType === 'image/png') {
          format = 'png';
        } else if (mimeType === 'image/webp') {
          format = 'webp';
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
                  }
                : {
                    kind: 'raster',
                    blob: finalBlob,
                    mimeType: finalMimeType as 'image/webp' | 'image/png',
                    width: 2000,
                    height: 2000,
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
