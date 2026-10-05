import React, { useState, useEffect, useRef } from 'react';
import { BaseMapImporter, UploadAuthRequiredError } from '@/services/baseMapImporter';
import {
  GeneratorFloatingControls,
  type GeneratorActionPayload,
} from './GeneratorFloatingControls';
import { useGameStore, useActiveScene } from '@/stores/gameStore';
import './GeneratorPanel.css';
import { GeneratorHostClient } from '@/services/generatorHostClient';
import type { GeneratorHostMessage } from '../../../shared/generator/protocol';
import { openNexusDB } from '@/services/nexusDb';
import { toast } from '@/utils/notifications';

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  if (typeof blob.arrayBuffer === 'function') {
    try {
      const buffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return `data:${blob.type || 'image/webp'};base64,${base64}`;
    } catch {
      // Fallback to FileReader below
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
};

const GENERATOR_MAP_STORAGE_KEY = 'nexus-generator-current-map';

const measureImageDimensions = async (
  source: Blob | string,
): Promise<{ width: number; height: number }> => {
  if (typeof source !== 'string' && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (dims.width > 0 && dims.height > 0) return dims;
    } catch {
      // Fall back to Image
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const img = new Image();
    const url =
      typeof source === 'string' ? source : URL.createObjectURL(source);

    const finish = (dims: { width: number; height: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof source !== 'string') {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore
        }
      }
      resolve(dims);
    };

    const timer = setTimeout(() => {
      finish({ width: 2000, height: 2000 });
    }, 500);

    img.onload = () => {
      finish({
        width: img.naturalWidth || img.width || 2000,
        height: img.naturalHeight || img.height || 2000,
      });
    };
    img.onerror = () => {
      finish({ width: 2000, height: 2000 });
    };
    img.src = url;
  });
};

// IndexedDB helper for temporary generator map storage
interface GeneratorMapData {
  imageData: string;
  format: 'webp' | 'png';
  originalSize?: number;
  width?: number;
  height?: number;
  timestamp: number;
  generator: string;
}

const openGeneratorDB = async (): Promise<IDBDatabase> => {
  return openNexusDB();
};

const saveGeneratorMapToIndexedDB = async (
  data: GeneratorMapData,
): Promise<void> => {
  try {
    const db = await openGeneratorDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tempStorage'], 'readwrite');
      const store = transaction.objectStore('tempStorage');
      const request = store.put({
        id: GENERATOR_MAP_STORAGE_KEY,
        ...data,
      });
      request.onsuccess = () => {
        console.log('💾 Saved generator map to IndexedDB');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Failed to save generator map to IndexedDB:', error);
  }
};

const loadGeneratorMapFromIndexedDB =
  async (): Promise<GeneratorMapData | null> => {
    try {
      const db = await openGeneratorDB();
      if (!db.objectStoreNames.contains('tempStorage')) return null;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tempStorage'], 'readonly');
        const store = transaction.objectStore('tempStorage');
        const request = store.get(GENERATOR_MAP_STORAGE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to load generator map from IndexedDB:', error);
      return null;
    }
  };

const deleteGeneratorMapFromIndexedDB = async (): Promise<void> => {
  try {
    const db = await openGeneratorDB();
    if (!db.objectStoreNames.contains('tempStorage')) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tempStorage'], 'readwrite');
      const store = transaction.objectStore('tempStorage');
      const request = store.delete(GENERATOR_MAP_STORAGE_KEY);
      request.onsuccess = () => {
        console.log('🗑️ Deleted generator map from IndexedDB');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Failed to delete generator map from IndexedDB:', error);
  }
};

interface GeneratorPanelProps {
  onSwitchToScenes?: () => void;
}

type GeneratorType = 'dungeon' | 'cave' | 'world' | 'city' | 'dwelling';

type GeneratedMapPayload = string;

export const GeneratorPanel: React.FC<GeneratorPanelProps> = ({
  onSwitchToScenes,
}) => {
  const [generatedMap, setGeneratedMap] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<{
    blob: Blob;
    filename: string;
    width?: number;
    height?: number;
    source?: GeneratorType;
  } | null>(null);
  const [generatedDimensions, setGeneratedDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [activeGenerator, setActiveGenerator] =
    useState<GeneratorType>('dungeon');
  const [forceRasterize, setForceRasterize] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const configuredHubUrl =
    import.meta.env.VITE_GENERATOR_HUB_URL ||
    (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
  const hubUrl =
    typeof window === 'undefined'
      ? configuredHubUrl
      : new URL(configuredHubUrl, window.location.href).toString();
  const hubOrigin =
    typeof window === 'undefined'
      ? ''
      : new URL(configuredHubUrl, window.location.href).origin;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeScene = useActiveScene();
  const updateScene = useGameStore((state) => state.updateScene);
  const setActiveTab = useGameStore((state) => state.setActiveTab);

  const handleMapGenerated = React.useCallback(
    async (
      imageDataOrData: GeneratedMapPayload,
      format: 'webp' | 'png' = 'webp',
      originalSize?: number,
      width?: number,
      height?: number,
    ) => {
      const generatorType = activeGenerator;
      console.log('🗺️ Map generated from:', generatorType);

      let imageData: string;
      if (typeof imageDataOrData === 'string') {
        if (imageDataOrData.startsWith('{')) {
          console.warn('Blocked JSON payload from entering scene state');
          return;
        }
        imageData = imageDataOrData;
      } else {
        imageData = '';
      }

      setGeneratedMap(imageData);
      if (width && height && width > 0 && height > 0) {
        setGeneratedDimensions({ width, height });
      }

      await saveGeneratorMapToIndexedDB({
        imageData,
        format,
        originalSize,
        width,
        height,
        timestamp: Date.now(),
        generator: generatorType,
      });
    },
    [activeGenerator],
  );

  // Setup Host Client & Message Handling
  useEffect(() => {
    const client = new GeneratorHostClient(hubOrigin);

    const handleHostMessage = (event: MessageEvent) => {
      if (event.origin !== hubOrigin) return;
      const msg = event.data as GeneratorHostMessage;

      if (msg.type === 'generator/export-ready') {
        const artifact = msg.payload;
        const innerPayload = artifact.payload;
        const format = innerPayload.mimeType === 'image/webp' ? 'webp' : 'png';
        const filename =
          'generated_map_' +
          artifact.exportId +
          (format === 'webp' ? '.webp' : '.png');
        const width = 'width' in innerPayload ? innerPayload.width : undefined;
        const height =
          'height' in innerPayload ? innerPayload.height : undefined;

        // Save blob for server upload
        setGeneratedBlob({
          blob: innerPayload.blob,
          filename,
          width,
          height,
          source: (artifact.source as GeneratorType) || activeGenerator,
        });
        if (width && height) {
          setGeneratedDimensions({ width, height });
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          handleMapGenerated(
            reader.result as string,
            format,
            innerPayload.blob.size,
            width,
            height,
          );
        };
        reader.readAsDataURL(innerPayload.blob);
      }
    };

    window.addEventListener('message', handleHostMessage);

    if (iframeRef.current?.contentWindow) {
      client.connect(iframeRef.current.contentWindow);
    }

    return () => {
      window.removeEventListener('message', handleHostMessage);
      client.disconnect();
    };
  }, [hubOrigin, hubUrl, handleMapGenerated]);

  // Load map from IndexedDB on mount
  useEffect(() => {
    const loadMap = async () => {
      try {
        const stored = await loadGeneratorMapFromIndexedDB();
        if (stored) {
          setGeneratedMap(stored.imageData);
          if (stored.width && stored.height) {
            setGeneratedDimensions({
              width: stored.width,
              height: stored.height,
            });
          }
        }
      } catch (err) {
        console.error('Failed to restore generator state:', err);
      }
    };
    loadMap();
  }, []);

  const handleGeneratorAction = (action: GeneratorActionPayload) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'generator/action',
          keyCode: action.keyCode,
          code: action.code,
          key: action.key,
          shiftKey: action.shiftKey,
        },
        '*',
      );
    }
  };

  const handleApplyToScene = async () => {
    if (!activeScene) return;

    try {
      setIsImporting(true);

      let currentBlob = generatedBlob;
      const currentMap = generatedMap;

      // If we don't have an export yet, request one on demand from the hub
      if (!currentBlob && !currentMap) {
        console.log(
          '[GeneratorPanel] No map cached yet, requesting immediate export from generator...',
        );
        const exportPromise = new Promise<{
          blob: Blob;
          filename: string;
          width?: number;
          height?: number;
          source?: GeneratorType;
        }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('message', onExport);
            reject(new Error('Timed out waiting for generator to export map'));
          }, 3500);

          const onExport = (event: MessageEvent) => {
            if (event.data?.type === 'generator/export-ready') {
              clearTimeout(timeout);
              window.removeEventListener('message', onExport);
              const artifact = event.data.payload;
              const inner = artifact.payload;
              const format = inner.mimeType === 'image/webp' ? 'webp' : 'png';
              const filename =
                'generated_map_' +
                artifact.exportId +
                (format === 'webp' ? '.webp' : '.png');
              const width =
                'width' in inner ? inner.width : undefined;
              const height =
                'height' in inner ? inner.height : undefined;
              resolve({
                blob: inner.blob,
                filename,
                width,
                height,
                source: (artifact.source as GeneratorType) || activeGenerator,
              });
            }
          };

          window.addEventListener('message', onExport);

          iframeRef.current?.contentWindow?.postMessage(
            { type: 'generator/export-request' },
            '*',
          );
        });

        try {
          const res = await exportPromise;
          currentBlob = res;
          if (res.width && res.height) {
            setGeneratedDimensions({ width: res.width, height: res.height });
          }
        } catch (exportErr) {
          console.warn(
            '[GeneratorPanel] Export request failed or timed out:',
            exportErr,
          );
        }
      }

      let finalUrl = currentMap;

      let mapWidth = currentBlob?.width ?? generatedDimensions?.width;
      let mapHeight = currentBlob?.height ?? generatedDimensions?.height;

      // If dimensions are missing or not positive, measure the image directly
      if (!mapWidth || !mapHeight || mapWidth <= 0 || mapHeight <= 0) {
        const sourceToMeasure = currentBlob?.blob || finalUrl;
        if (sourceToMeasure) {
          try {
            const dims = await measureImageDimensions(sourceToMeasure);
            mapWidth = dims.width;
            mapHeight = dims.height;
          } catch (measureErr) {
            console.warn(
              '[GeneratorPanel] Failed to measure image dimensions:',
              measureErr,
            );
          }
        }
      }

      let finalWidth = mapWidth && mapWidth > 0 ? mapWidth : 2000;
      let finalHeight = mapHeight && mapHeight > 0 ? mapHeight : 2000;

      // If dungeon generator produced an oversized image (e.g. > 2000px on either dimension),
      // scale it down to a sensible scene dimension (max 1600px) while maintaining aspect ratio,
      // matching the sizing behavior of the cave generator.
      const mapSource = currentBlob?.source || activeGenerator;
      if (mapSource === 'dungeon' && (finalWidth > 2000 || finalHeight > 2000)) {
        const maxDimension = 1600;
        const scaleFactor = Math.min(
          maxDimension / finalWidth,
          maxDimension / finalHeight,
        );
        finalWidth = Math.round(finalWidth * scaleFactor);
        finalHeight = Math.round(finalHeight * scaleFactor);
      }

      if (currentBlob) {
        try {
          // Upload the blob through our importer
          const result = await BaseMapImporter.importGeneratedMap({
            blob: currentBlob.blob,
            filename: currentBlob.filename,
            width: finalWidth,
            height: finalHeight,
          });

          finalUrl = result.sceneUrl;
        } catch (uploadErr) {
          if (
            !(uploadErr instanceof UploadAuthRequiredError) &&
            (uploadErr as Error)?.name !== 'UploadAuthRequiredError'
          ) {
            throw uploadErr;
          }

          // Guests / unauthenticated sessions can't persist to the asset
          // service (server/middleware/assetWriteGuard.ts). Fall back to
          // embedding the map directly as a local data: URL background
          // instead of hard failing -- it still syncs to other players as
          // part of the scene's own state, it just isn't saved to the
          // asset library or served from the asset CDN.
          finalUrl = await blobToDataUrl(currentBlob.blob);
          toast.info(
            'Map added to the scene locally — sign in to also save it to your asset library.',
          );
        }
      }

      if (finalUrl) {
        await updateScene(activeScene.id, {
          backgroundImage: {
            url: finalUrl,
            width: finalWidth,
            height: finalHeight,
            offsetX: -finalWidth / 2,
            offsetY: -finalHeight / 2,
            scale: 1,
          },
        });

        if (onSwitchToScenes) {
          onSwitchToScenes();
        } else {
          setActiveTab('scenes');
        }

        await deleteGeneratorMapFromIndexedDB();
      } else {
        alert(
          'Could not capture the generated map. Please try clicking Reroll Map first.',
        );
      }
    } catch (err) {
      console.error('Failed to apply map to scene:', err);
      alert('Failed to import map: ' + (err as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleGeneratorChange = (generator: GeneratorType) => {
    if (generator !== activeGenerator) {
      setGeneratedMap(null);
      setGeneratedBlob(null);
      setGeneratedDimensions(null);
      setActiveGenerator(generator);
    }
  };

  return (
    <div className="generator-panel h-full flex flex-col relative overflow-hidden bg-vtt-iron-900 border-l border-vtt-iron-700 shadow-2xl">
      <GeneratorFloatingControls
        activeGenerator={activeGenerator}
        onGeneratorChange={handleGeneratorChange}
        onAddToScene={handleApplyToScene}
        onAction={handleGeneratorAction}
        hasActiveScene={!!activeScene}
        hasValidArtifact={(!!generatedMap && !generatedMap.startsWith('{')) || !!generatedBlob}
        activeSceneName={activeScene?.name}
        isImporting={isImporting}
        forceRasterize={forceRasterize}
        onForceRasterizeChange={setForceRasterize}
      />

      {/* Debug: Show generated map preview */}
      {generatedMap && process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            zIndex: 'var(--z-modal)',
            background: 'rgba(0,0,0,0.8)',
            padding: '10px',
            borderRadius: '8px',
            border: '2px solid #4ade80',
          }}
        >
          <div
            style={{ color: '#4ade80', fontSize: '12px', marginBottom: '5px' }}
          >
            ✅ Map Generated ({(generatedMap.length / 1024).toFixed(0)} KB)
          </div>
          <img
            src={generatedMap}
            alt="Generated preview"
            style={{
              width: '150px',
              height: 'auto',
              border: '1px solid #4ade80',
              borderRadius: '4px',
            }}
          />
        </div>
      )}

      {['dungeon', 'world', 'cave', 'city', 'dwelling'].includes(
        activeGenerator,
      ) && (
        <div className="generator-iframe-container">
          <iframe
            ref={iframeRef}
            key={`generator-hub-${activeGenerator}`}
            src={`${hubUrl}?generator=${activeGenerator}&rasterize=${forceRasterize}`}
            className="generator-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
            title="Generator Hub"
          />
        </div>
      )}
    </div>
  );
};
