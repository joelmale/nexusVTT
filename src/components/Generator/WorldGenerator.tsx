import React, { useEffect, useRef, useState } from 'react';

export interface WorldMapPayload {
  full: { dataUrl: string; mime: string; quality: number };
  thumb: { dataUrl: string; mime: string; quality: number };
  meta: {
    width: number;
    height: number;
    timestamp: number;
    generator: string;
  };
}

interface WorldGeneratorProps {
  onMapGenerated: (data: WorldMapPayload) => void;
}

export const WorldGenerator: React.FC<WorldGeneratorProps> = ({
  onMapGenerated,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Debug: Log all messages for troubleshooting
      console.log('WorldGenerator received message:', event.data);

      // Validate origin for security (allow same origin or data URI)
      if (event.origin !== window.location.origin && event.origin !== 'null') {
        console.log('Message rejected due to origin:', event.origin);
        return;
      }

      // Handle map export from world generator bridge
      if (
        event.data.type === 'VTT_MAP_EXPORTED' &&
        event.data.generatorId === 'world'
      ) {
        console.log('Processing VTT_MAP_EXPORTED message from world generator');
        onMapGenerated(event.data);
      }

      // Handle bridge ready notification
      if (
        event.data.type === 'VTT_GEN_READY' &&
        event.data.generatorId === 'world'
      ) {
        console.log('World generator bridge is ready');
      }

      // Handle errors
      if (
        event.data.type === 'VTT_GEN_ERROR' &&
        event.data.generatorId === 'world'
      ) {
        console.error('World generator bridge error:', event.data.message);
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
          <p>Loading world generator...</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/world-map-generator/index.html"
        className="generator-iframe"
        title="World Map Generator"
        onLoad={handleIframeLoad}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
};
