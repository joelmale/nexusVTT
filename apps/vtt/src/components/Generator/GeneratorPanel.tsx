import React, { useState, useEffect, useRef } from 'react';
import { BaseMapImporter } from '@/services/baseMapImporter';
import { GeneratorFloatingControls } from './GeneratorFloatingControls';
import { useGameStore, useActiveScene } from '@/stores/gameStore';
import './GeneratorPanel.css';
import { GeneratorHostClient } from '@/services/generatorHostClient';
import type { GeneratorHostMessage } from '../../../shared/generator/protocol';
import { openNexusDB } from '@/services/nexusDb';



const GENERATOR_MAP_STORAGE_KEY = 'nexus-generator-current-map';

// IndexedDB helper for temporary generator map storage
interface GeneratorMapData {
  imageData: string;
  format: 'webp' | 'png';
  originalSize?: number;
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
  const [generatedBlob, setGeneratedBlob] = useState<{ blob: Blob; filename: string } | null>(null);
  const [activeGenerator, setActiveGenerator] =
    useState<GeneratorType>('dungeon');
  const [forceRasterize, setForceRasterize] = useState(true);
  const [, setIsImporting] = useState(false);

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

  const handleMapGenerated = React.useCallback(async (
    imageDataOrData: GeneratedMapPayload,
    format: 'webp' | 'png' = 'webp',
    originalSize?: number,
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

    await saveGeneratorMapToIndexedDB({
      imageData,
      format,
      originalSize,
      timestamp: Date.now(),
      generator: generatorType,
    });
  }, [activeGenerator]);

  // Setup Host Client
  useEffect(() => {
    const client = new GeneratorHostClient(hubOrigin);
    
    const handleHostMessage = (event: MessageEvent) => {
      if (event.origin !== hubOrigin) return;
      const msg = event.data as GeneratorHostMessage;
      
      if (msg.type === 'generator/export-ready') {
        const artifact = msg.payload;
        const innerPayload = artifact.payload;
        const format = innerPayload.mimeType === 'image/webp' ? 'webp' : 'png';
        const filename = 'generated_map_' + artifact.exportId + (format === 'webp' ? '.webp' : '.png');
        
        // Save blob for server upload
        setGeneratedBlob({ blob: innerPayload.blob, filename });

        const reader = new FileReader();
        reader.onloadend = () => {
          handleMapGenerated(reader.result as string, format);
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
          try {
              // Removed legacy JSON handling
          } catch {
            // Not JSON
          }
        }
      } catch (err) {
        console.error('Failed to restore generator state:', err);
      }
    };
    loadMap();
  }, []);

  const handleApplyToScene = async () => {
    if (!activeScene || (!generatedMap && !generatedBlob)) return;

    try {
      setIsImporting(true);
      
      let finalUrl = generatedMap;

      if (generatedBlob) {
        // Upload the blob through our new importer
        const result = await BaseMapImporter.importGeneratedMap({
          blob: generatedBlob.blob,
          filename: generatedBlob.filename,
        });
        
        finalUrl = result.sceneUrl;
      }

      if (finalUrl) {
        await updateScene(activeScene.id, {
          backgroundImage: {
            url: finalUrl,
            width: 2000,
            height: 2000,
            offsetX: 0,
            offsetY: 0,
            scale: 1,
          },
        });
      }

      if (onSwitchToScenes) {
        onSwitchToScenes();
      } else {
        setActiveTab('scenes');
      }

      await deleteGeneratorMapFromIndexedDB();
    } catch (err) {
      console.error('Failed to apply map to scene:', err);
      alert('Failed to import map: ' + (err as Error).message);
    }
  };

  const handleGeneratorChange = (generator: GeneratorType) => {
    if (generator !== activeGenerator) {
      setGeneratedMap(null);
      setActiveGenerator(generator);
    }
  };

  return (
    <div className="generator-panel h-full flex flex-col relative overflow-hidden bg-vtt-iron-900 border-l border-vtt-iron-700 shadow-2xl">
      <GeneratorFloatingControls
        activeGenerator={activeGenerator}
        onGeneratorChange={handleGeneratorChange}
        onAddToScene={handleApplyToScene}
        hasActiveScene={!!activeScene}
        hasValidArtifact={!!generatedMap && !generatedMap.startsWith('{')}
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

      {['dungeon', 'world'].includes(activeGenerator) && (
        <iframe
          ref={iframeRef}
          key={`generator-hub-${activeGenerator}`}
          src={`${hubUrl}?generator=${activeGenerator}&rasterize=${forceRasterize}`}
          className="generator-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            flex: 1,
          }}
          title="Generator Hub"
        />
      )}
    </div>
  );
};
