import React, { useEffect, useRef } from 'react';
import { useGameStore, useActiveScene } from '@/stores/gameStore';
import { propAssetManager } from '@/services/propAssets';
import type { PlacedProp } from '@/types/prop';
import { PopoverMenu } from '../PopoverMenu';
import './PropToolbar.css';

interface PropToolbarProps {
  position: { x: number; y: number };
  placedProp: PlacedProp;
}

export const PropToolbar: React.FC<PropToolbarProps> = ({ position, placedProp }) => {
  const activeScene = useActiveScene();
  const { updateProp, deleteProp, clearSelection, interactWithProp } = useGameStore();

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Get prop definition
  const prop = propAssetManager.getPropById(placedProp.propId);

  // Debug logging
  useEffect(() => {
    console.log('🎭 PropToolbar render:', {
      hasProp: !!placedProp,
      propId: placedProp?.id,
      hasScene: !!activeScene,
      position,
      propDefinition: prop
    });
  }, [placedProp, activeScene, position, prop]);

  // Handle clicking outside to close toolbar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        clearSelection();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSelection]);

  if (!activeScene || !prop) {
    return null;
  }

  const handleRemoveProp = () => {
    if (window.confirm('Are you sure you want to remove this prop?')) {
      deleteProp(activeScene.id, placedProp.id);
    }
  };

  const handleRotate = (delta: number) => {
    const newRotation = (placedProp.rotation + delta) % 360;
    updateProp(activeScene.id, placedProp.id, { rotation: newRotation });
  };

  const handleScale = (delta: number) => {
    const newScale = Math.max(0.25, Math.min(4, placedProp.scale + delta));
    updateProp(activeScene.id, placedProp.id, { scale: newScale });
  };

  const handleToggleVisibility = () => {
    updateProp(activeScene.id, placedProp.id, {
      visibleToPlayers: !placedProp.visibleToPlayers
    });
  };

  const handleToggleDMOnly = () => {
    updateProp(activeScene.id, placedProp.id, {
      dmNotesOnly: !placedProp.dmNotesOnly
    });
  };

  const handleInteract = (action: 'open' | 'close' | 'lock' | 'unlock') => {
    interactWithProp(activeScene.id, placedProp.id, action);
  };

  const currentState = placedProp.currentStats?.state || 'closed';
  const isInteractive = prop.interactive;

  const renderOptionsPanel = () => {
    return (
      <div className="prop-toolbar-panel">
        <div className="prop-panel-header">
          <h4 className="prop-panel-title">Prop Options</h4>
        </div>
        <div className="prop-panel-content options-panel">
          {/* Rotation */}
          <div className="option-row">
            <span className="option-label">Rotate</span>
            <div className="option-controls">
              <button
                className="option-btn"
                onClick={() => handleRotate(-45)}
                title="Rotate -45°"
              >
                ↶
              </button>
              <span className="option-value">{Math.round(placedProp.rotation)}°</span>
              <button
                className="option-btn"
                onClick={() => handleRotate(45)}
                title="Rotate +45°"
              >
                ↷
              </button>
            </div>
          </div>

          {/* Scale */}
          <div className="option-row">
            <span className="option-label">Scale</span>
            <div className="option-controls">
              <button
                className="option-btn"
                onClick={() => handleScale(-0.25)}
                title="Shrink"
              >
                -
              </button>
              <span className="option-value">{Math.round(placedProp.scale * 100)}%</span>
              <button
                className="option-btn"
                onClick={() => handleScale(0.25)}
                title="Enlarge"
              >
                +
              </button>
            </div>
          </div>

          {/* Layer */}
          <div className="option-row">
            <span className="option-label">Layer</span>
            <div className="option-controls">
              <button
                className={`option-btn ${placedProp.layer === 'background' ? 'active' : ''}`}
                onClick={() => updateProp(activeScene.id, placedProp.id, { layer: 'background' })}
                title="Background Layer"
              >
                Back
              </button>
              <button
                className={`option-btn ${placedProp.layer === 'props' ? 'active' : ''}`}
                onClick={() => updateProp(activeScene.id, placedProp.id, { layer: 'props' })}
                title="Props Layer"
              >
                Props
              </button>
              <button
                className={`option-btn ${placedProp.layer === 'overlay' ? 'active' : ''}`}
                onClick={() => updateProp(activeScene.id, placedProp.id, { layer: 'overlay' })}
                title="Overlay Layer"
              >
                Over
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInteractivePanel = () => {
    if (!isInteractive) return null;

    return (
      <div className="prop-toolbar-panel">
        <div className="prop-panel-header">
          <h4 className="prop-panel-title">Interactive State</h4>
        </div>
        <div className="prop-panel-content">
          <div className="state-buttons">
            <button
              className={`state-btn ${currentState === 'closed' ? 'active' : ''}`}
              onClick={() => handleInteract('close')}
              title="Closed"
            >
              <span className="state-icon">🚪</span>
              <span className="state-label">Closed</span>
            </button>
            <button
              className={`state-btn ${currentState === 'open' ? 'active' : ''}`}
              onClick={() => handleInteract('open')}
              title="Open"
            >
              <span className="state-icon">🔓</span>
              <span className="state-label">Open</span>
            </button>
            <button
              className={`state-btn ${currentState === 'locked' ? 'active' : ''}`}
              onClick={() => handleInteract('lock')}
              title="Locked"
            >
              <span className="state-icon">🔒</span>
              <span className="state-label">Locked</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={toolbarRef}
      className="prop-toolbar"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Main Toolbar */}
      <div className="prop-toolbar-main">
        {/* Primary Tools */}
        <div className="prop-toolbar-primary">
          <PopoverMenu
            trigger={
              <span className="prop-toolbar-icon">⚙️</span>
            }
            triggerClassName="prop-toolbar-btn"
            contentClassName="prop-toolbar-popover"
          >
            {renderOptionsPanel()}
          </PopoverMenu>

          {isInteractive && (
            <PopoverMenu
              trigger={
                <span className="prop-toolbar-icon">
                  {currentState === 'locked' ? '🔒' : currentState === 'open' ? '🔓' : '🚪'}
                </span>
              }
              triggerClassName="prop-toolbar-btn"
              contentClassName="prop-toolbar-popover"
            >
              {renderInteractivePanel()}
            </PopoverMenu>
          )}

          <button
            className={`prop-toolbar-btn ${placedProp.visibleToPlayers ? '' : 'active'}`}
            onClick={handleToggleVisibility}
            title={placedProp.visibleToPlayers ? 'Hide from Players' : 'Show to Players'}
          >
            <span className="prop-toolbar-icon">
              {placedProp.visibleToPlayers ? '👁️' : '🙈'}
            </span>
          </button>
        </div>

        {/* Separator */}
        <div className="prop-toolbar-separator" />

        {/* Secondary Tools */}
        <div className="prop-toolbar-secondary">
          <button
            className={`prop-toolbar-btn ${placedProp.dmNotesOnly ? 'active' : ''}`}
            onClick={handleToggleDMOnly}
            title={placedProp.dmNotesOnly ? 'Visible to DM' : 'Hide from Players (DM Notes)'}
          >
            <span className="prop-toolbar-icon">
              {placedProp.dmNotesOnly ? 'DM' : '📝'}
            </span>
          </button>

          <button
            className="prop-toolbar-btn danger"
            onClick={handleRemoveProp}
            title="Remove Prop"
          >
            <span className="prop-toolbar-icon">🗑️</span>
          </button>
        </div>
      </div>
    </div>
  );
};
