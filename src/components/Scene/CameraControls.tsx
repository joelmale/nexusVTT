import React from 'react';
import type { Camera } from '@/types/game';

interface CameraControlsProps {
  camera: Camera;
  onCameraUpdate: (updates: Partial<Camera>) => void;
  canControl: boolean;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  camera,
  onCameraUpdate,
  canControl,
}) => {
  const handleZoomIn = () => {
    if (!canControl) return;
    const newZoom = Math.min(5.0, camera.zoom * 1.2);
    onCameraUpdate({ zoom: newZoom });
  };

  const handleZoomOut = () => {
    if (!canControl) return;
    const newZoom = Math.max(0.1, camera.zoom * 0.8);
    onCameraUpdate({ zoom: newZoom });
  };

  const handleResetView = () => {
    if (!canControl) return;
    onCameraUpdate({ x: 0, y: 0, zoom: 0.25 });
  };

  const handleFitToScreen = () => {
    if (!canControl) return;
    // This is a placeholder - we'll implement proper fit-to-content logic later
    onCameraUpdate({ x: 0, y: 0, zoom: 0.8 });
  };

  if (!canControl) {
    return (
      <div className="camera-controls disabled">
        <span className="camera-info">
          Zoom: {Math.round(camera.zoom * 100)}%
        </span>
      </div>
    );
  }

  return (
    <div className="camera-controls">
      <div className="zoom-controls">
        <button
          className="btn btn-small"
          onClick={handleZoomOut}
          title="Zoom Out"
          disabled={camera.zoom <= 0.1}
        >
          -
        </button>

        <span className="zoom-display">{Math.round(camera.zoom * 100)}%</span>

        <button
          className="btn btn-small"
          onClick={handleZoomIn}
          title="Zoom In"
          disabled={camera.zoom >= 5.0}
        >
          +
        </button>
      </div>

      <div className="camera-actions">
        <button
          className="btn btn-small"
          onClick={handleResetView}
          title="Reset View"
        >
          🎯
        </button>

        <button
          className="btn btn-small"
          onClick={handleFitToScreen}
          title="Fit to Screen"
        >
          📐
        </button>
      </div>

      <div className="position-display">
        <span title="Camera Position">
          ({Math.round(camera.x)}, {Math.round(camera.y)})
        </span>
      </div>
    </div>
  );
};
