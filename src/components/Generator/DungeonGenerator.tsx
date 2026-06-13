import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useProceduralGeneration } from '@/hooks/useProceduralGeneration';

interface DungeonGeneratorProps {
  // Retained callback for legacy compatibility; now also receives generated payload directly.
  onMapGenerated: (
    imageData: string,
    format?: 'webp' | 'png',
    originalSize?: number,
  ) => void;
}

export const DungeonGenerator: React.FC<DungeonGeneratorProps> = ({
  onMapGenerated,
}) => {
  // Existing iframe handling (kept for backward compatibility)
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New worker‑based generation hook
  const { isGenerating, generatedData, error, triggerGeneration } = useProceduralGeneration();

  // Example configuration – can be derived from UI or props later
  const defaultConfig = useMemo(() => ({
    seed: 'default-seed',
    width: 100,
    height: 100,
    grammarPreset: 'cave',
    themeStyle: 'dark',
  }), []);

  // Trigger generation on component mount (or replace with UI button as needed)
  useEffect(() => {
    triggerGeneration('cave', defaultConfig);
  }, [triggerGeneration, defaultConfig]);

  // Forward generated image data to legacy callback if needed
  useEffect(() => {
    if (generatedData) {
      // Convert the grid/rooms to an image placeholder (for demo we just stringify)
      const imageData = JSON.stringify(generatedData);
      onMapGenerated(imageData, 'png');
    }
  }, [generatedData, onMapGenerated]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('DungeonGenerator received message:', event.data);
      if (event.origin !== window.location.origin && event.origin !== 'null') {
        console.log('Message rejected due to origin:', event.origin);
        return;
      }
      if (event.data.type === 'DUNGEON_PNG_GENERATED') {
        const { imageData, format = 'png', originalSize } = event.data.data;
        onMapGenerated(imageData, format, originalSize);
      }
      if (event.data.type === 'DUNGEON_MAP_GENERATED') {
        onMapGenerated(event.data.data.imageData, 'png');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMapGenerated]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="generator-iframe-container">
      {isLoading && (
        <div className="generator-loading">
          <div className="spinner"></div>
          <p>Loading dungeon generator...</p>
        </div>
      )}
      {isGenerating && (
        <div className="generator-loading">
          <div className="spinner"></div>
          <p>Generating map in background...</p>
        </div>
      )}
      {error && (
        <div className="generator-error">
          <p>Error: {error}</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/one-page-dungeon/index.html"
        className="generator-iframe"
        title="Dungeon Generator"
        onLoad={handleIframeLoad}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
};
