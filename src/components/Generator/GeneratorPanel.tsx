import React, { useState, useEffect } from 'react';
import { DungeonGenerator } from './DungeonGenerator';
import { WorldGenerator, type WorldMapPayload } from './WorldGenerator';
import { type DungeonData } from './DungeonRenderer';
import { GeneratorFloatingControls } from './GeneratorFloatingControls';
import { useGameStore, useActiveScene } from '@/stores/gameStore';
import './GeneratorPanel.css';
import { useProceduralGeneration } from '@/hooks/useProceduralGeneration';

const DEFAULT_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-pointer-lock allow-orientation-lock allow-downloads';

const iframeUrls: Record<string, string> = {
  cave: '/cave-generator/index.html',
  city: '/city-generator/index.html',
  dwelling: '/dwellings-generator/index.html',
};

// Map of any extra allow permissions per generator type
const ALLOW_MAP: Record<string, string | undefined> = {
  city: 'cross-origin-isolated',
  cave: undefined,
  dwelling: undefined,
  dungeon: undefined,
  world: undefined,
};

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
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NexusVTT', 5); // Bump to v5 to add tempStorage
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log(
        `🔧 IndexedDB upgrade for generator: v${event.oldVersion} → v5`,
      );

      // Create existing stores if they don't exist (for compatibility)
      if (!db.objectStoreNames.contains('maps')) {
        const mapsStore = db.createObjectStore('maps', { keyPath: 'id' });
        mapsStore.createIndex('timestamp', 'timestamp', { unique: false });
        mapsStore.createIndex('name', 'name', { unique: false });
        console.log('✅ Created maps store');
      }

      if (!db.objectStoreNames.contains('tempStorage')) {
        db.createObjectStore('tempStorage', { keyPath: 'id' });
        console.log('✅ Created tempStorage store');
      }
    };
  });
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

interface DungeonMapPayload {
  image: string;
  data: DungeonData;
}

type GeneratedMapPayload =
  string | DungeonMapPayload | DungeonData | WorldMapPayload;

function isDungeonMapPayload(
  payload: Exclude<GeneratedMapPayload, string>,
): payload is DungeonMapPayload {
  return 'image' in payload && typeof payload.image === 'string';
}

function isWorldMapPayload(
  payload: Exclude<GeneratedMapPayload, string>,
): payload is WorldMapPayload {
  return 'full' in payload && typeof payload.full?.dataUrl === 'string';
}

export const GeneratorPanel: React.FC<GeneratorPanelProps> = ({
  onSwitchToScenes,
}) => {
  const [generatedMap, setGeneratedMap] = useState<string | null>(null);
  const [, setDungeonData] = useState<DungeonData | null>(null);
  const [activeGenerator, setActiveGenerator] =
    useState<GeneratorType>('dungeon');

  // Load map from IndexedDB on mount
  useEffect(() => {
    const loadMap = async () => {
      try {
        const stored = await loadGeneratorMapFromIndexedDB();
        if (stored) {
          setGeneratedMap(stored.imageData);
          try {
            if (stored.imageData.startsWith('{')) {
              const data = JSON.parse(stored.imageData);
              if (data.grid) setDungeonData(data);
            }
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

  const activeScene = useActiveScene();
  const updateScene = useGameStore((state) => state.updateScene);
  const setActiveTab = useGameStore((state) => state.setActiveTab);

  const { generatedData } = useProceduralGeneration();

  // Sync generated data to generatedMap state
  useEffect(() => {
    if (generatedData) {
      const imgData = JSON.stringify(generatedData);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeneratedMap(imgData);
    }
  }, [generatedData]);

  const handleMapGenerated = async (
    imageDataOrData: GeneratedMapPayload,
    format: 'webp' | 'png' = 'webp',
    originalSize?: number,
  ) => {
    const generatorType =
      typeof imageDataOrData === 'object' && isWorldMapPayload(imageDataOrData)
        ? imageDataOrData.meta.generator
        : 'dungeon';
    console.log('🗺️ Map generated from:', generatorType);

    let imageData: string;
    let data: DungeonData | null = null;

    if (typeof imageDataOrData === 'string') {
      imageData = imageDataOrData;
    } else if (isDungeonMapPayload(imageDataOrData)) {
      imageData = imageDataOrData.image;
      data = imageDataOrData.data;
    } else if (isWorldMapPayload(imageDataOrData)) {
      imageData = imageDataOrData.full.dataUrl;
    } else {
      data = imageDataOrData;
      imageData = '';
    }

    setGeneratedMap(imageData);
    setDungeonData(data);

    await saveGeneratorMapToIndexedDB({
      imageData,
      format,
      originalSize,
      timestamp: Date.now(),
      generator: generatorType,
    });
  };

  const handleApplyToScene = async () => {
    if (!activeScene || !generatedMap) return;

    try {
      await updateScene(activeScene.id, {
        backgroundImage: {
          url: generatedMap,
          width: 2000,
          height: 2000,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        },
      });

      if (onSwitchToScenes) {
        onSwitchToScenes();
      } else {
        setActiveTab('scenes');
      }

      await deleteGeneratorMapFromIndexedDB();
    } catch (err) {
      console.error('Failed to apply map to scene:', err);
    }
  };

  return (
    <div className="generator-panel h-full flex flex-col relative overflow-hidden bg-vtt-iron-900 border-l border-vtt-iron-700 shadow-2xl">
      <GeneratorFloatingControls
        activeGenerator={activeGenerator}
        onGeneratorChange={setActiveGenerator}
        onAddToScene={handleApplyToScene}
        hasActiveScene={!!activeScene}
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

      {activeGenerator === 'dungeon' && (
        <DungeonGenerator onMapGenerated={handleMapGenerated} />
      )}

      {activeGenerator === 'world' && (
        <WorldGenerator onMapGenerated={handleMapGenerated} />
      )}

      {Object.keys(iframeUrls).includes(activeGenerator) && (
        <iframe
          key={activeGenerator}
          src={`${window.location.origin}${iframeUrls[activeGenerator]}`}
          className="generator-iframe"
          sandbox={DEFAULT_SANDBOX}
          allow={ALLOW_MAP[activeGenerator]}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            flex: 1,
          }}
          title={`${activeGenerator} Generator`}
        />
      )}
    </div>
  );
};
