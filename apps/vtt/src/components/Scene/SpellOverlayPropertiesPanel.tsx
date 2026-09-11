import React, { useState } from 'react';
import { X, RotateCw, Eye, EyeOff, Sparkles } from 'lucide-react';
import { ELEMENT_THEMES, ElementType } from '@/types/drawing';
import type {
  SpellOverlayDrawing,
  SpellOverlayStyle,
  BaseDrawing,
} from '@/types/drawing';
import { AnchoredPropertiesPanel } from './AnchoredPropertiesPanel';
import type { ViewportRect } from './anchoredPanelPosition';

type SpellOverlayUpdate = {
  style?: SpellOverlayStyle;
  rotation?: number;
  layer?: BaseDrawing['layer'];
};

interface SpellOverlayPropertiesPanelProps {
  drawing: SpellOverlayDrawing;
  onUpdate: (updates: SpellOverlayUpdate) => void;
  onClose: () => void;
  gridSize: number;
  anchor: ViewportRect;
}

export const SpellOverlayPropertiesPanel: React.FC<
  SpellOverlayPropertiesPanelProps
> = ({ drawing, onUpdate, onClose, gridSize, anchor }) => {
  const elementType = drawing.style.elementType;

  const [spellName, setSpellName] = useState(drawing.style.spellName ?? '');
  const [roundCounter, setRoundCounter] = useState(
    drawing.style.roundCounter ?? 0,
  );
  const [maxRounds, setMaxRounds] = useState(drawing.style.maxRounds ?? 10);
  const [opacity, setOpacity] = useState(
    drawing.style.fillOpacity !== undefined
      ? drawing.style.fillOpacity
      : ELEMENT_THEMES[elementType].opacity,
  );
  const [rotation, setRotation] = useState(
    'rotation' in drawing ? drawing.rotation || 0 : 0,
  );
  const [visibleToPlayers, setVisibleToPlayers] = useState(
    drawing.style.visibleToPlayers !== false,
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(
    drawing.style.animationsEnabled !== false,
  );
  const [notes, setNotes] = useState(drawing.style.notes ?? '');

  // Get size in feet for display
  const getSizeInFeet = () => {
    switch (drawing.type) {
      case 'spell-circle':
        return (drawing.radius / gridSize) * 5;
      case 'spell-ring':
        return (drawing.outerRadius / gridSize) * 5;
      case 'spell-cone':
      case 'spell-triangle':
        return (drawing.length / gridSize) * 5;
      case 'spell-line': {
        const dx = drawing.end.x - drawing.start.x;
        const dy = drawing.end.y - drawing.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        return (length / gridSize) * 5;
      }
      case 'spell-square':
        return (drawing.size / gridSize) * 5;
      default:
        return 0;
    }
  };

  const handleElementChange = (newElement: ElementType) => {
    const theme = ELEMENT_THEMES[newElement];
    const updatedStyle: SpellOverlayStyle = {
      ...drawing.style,
      elementType: newElement,
      edgeGlow: theme.edgeGlow,
      blendMode: theme.blendMode,
      animationSpeed: theme.animationSpeed,
      pulseIntensity: theme.pulseIntensity,
    };
    onUpdate({
      style: updatedStyle,
    });
  };

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    onUpdate({
      style: { ...drawing.style, fillOpacity: newOpacity },
    });
  };

  const handleRotationChange = (newRotation: number) => {
    setRotation(newRotation);
    if ('rotation' in drawing) {
      onUpdate({ rotation: newRotation });
    }
  };

  const handleRoundCounterChange = (newCounter: number) => {
    setRoundCounter(newCounter);
    onUpdate({
      style: { ...drawing.style, roundCounter: newCounter },
    });
  };

  const handleSpellNameChange = (newName: string) => {
    setSpellName(newName);
    onUpdate({
      style: { ...drawing.style, spellName: newName },
    });
  };

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    onUpdate({
      style: { ...drawing.style, notes: newNotes },
    });
  };

  const handleVisibilityToggle = () => {
    const newVisibility = !visibleToPlayers;
    setVisibleToPlayers(newVisibility);
    onUpdate({
      style: { ...drawing.style, visibleToPlayers: newVisibility },
      layer: newVisibility ? 'effects' : 'dm-only',
    });
  };

  const handleAnimationsToggle = () => {
    const newAnimations = !animationsEnabled;
    setAnimationsEnabled(newAnimations);
    onUpdate({
      style: { ...drawing.style, animationsEnabled: newAnimations },
    });
  };

  const incrementRound = () => {
    handleRoundCounterChange(Math.min(roundCounter + 1, maxRounds));
  };

  const decrementRound = () => {
    handleRoundCounterChange(Math.max(roundCounter - 1, 0));
  };

  const resetRound = () => {
    handleRoundCounterChange(0);
  };

  return (
    <AnchoredPropertiesPanel anchor={anchor} label="Spell effect properties">
      <div className="spell-overlay-properties-panel">
        <div className="panel-header">
          <h3>Spell Effect Properties</h3>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close properties"
          >
            <X size={18} />
          </button>
        </div>

        <div className="panel-content">
          {/* Spell Name */}
          <div className="property-section">
            <label htmlFor="spell-name">Spell Name</label>
            <input
              id="spell-name"
              type="text"
              value={spellName}
              onChange={(e) => handleSpellNameChange(e.target.value)}
              placeholder="e.g., Fireball, Darkness"
              className="text-input"
            />
          </div>

          {/* Element Type Selector */}
          <div className="property-section">
            <label>Element Type</label>
            <div className="element-type-grid">
              {(Object.keys(ELEMENT_THEMES) as ElementType[]).map((element) => {
                const theme = ELEMENT_THEMES[element];
                return (
                  <button
                    key={element}
                    className={`element-type-btn ${elementType === element ? 'active' : ''}`}
                    onClick={() => handleElementChange(element)}
                    style={{
                      backgroundColor: theme.baseColor,
                      opacity: elementType === element ? 1 : 0.6,
                    }}
                    title={element.charAt(0).toUpperCase() + element.slice(1)}
                  >
                    <span className="element-label">
                      {element.charAt(0).toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Round Counter */}
          <div className="property-section">
            <label>Round Counter (Duration Tracking)</label>
            <div className="round-counter-controls">
              <div className="counter-display">
                <button
                  className="counter-btn"
                  onClick={decrementRound}
                  disabled={roundCounter === 0}
                >
                  −
                </button>
                <div className="counter-value">
                  <span className="current-round">{roundCounter}</span>
                  <span className="counter-separator">/</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={maxRounds}
                    onChange={(e) =>
                      setMaxRounds(Math.max(1, parseInt(e.target.value) || 10))
                    }
                    className="max-rounds-input"
                  />
                </div>
                <button
                  className="counter-btn"
                  onClick={incrementRound}
                  disabled={roundCounter >= maxRounds}
                >
                  +
                </button>
              </div>
              <button className="reset-btn" onClick={resetRound} title="Reset">
                <RotateCw size={14} />
              </button>
            </div>
            <div className="counter-info">
              {roundCounter > 0 && (
                <span className="rounds-remaining">
                  {maxRounds - roundCounter} rounds remaining
                </span>
              )}
            </div>
          </div>

          {/* Size Display */}
          <div className="property-section">
            <label>Size</label>
            <div className="size-display">
              <span className="size-value">
                {getSizeInFeet().toFixed(0)} ft
              </span>
              <span className="size-type">
                {drawing.type === 'spell-circle' && 'radius'}
                {drawing.type === 'spell-ring' && 'outer radius'}
                {drawing.type === 'spell-cone' && 'length'}
                {drawing.type === 'spell-line' && 'length'}
                {drawing.type === 'spell-square' && 'side'}
                {drawing.type === 'spell-triangle' && 'length'}
              </span>
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="property-section">
            <label htmlFor="opacity-slider">
              Opacity: {(opacity * 100).toFixed(0)}%
            </label>
            <input
              id="opacity-slider"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
              className="slider"
            />
          </div>

          {/* Rotation (for directional spells) */}
          {('rotation' in drawing ||
            drawing.type === 'spell-cone' ||
            drawing.type === 'spell-line' ||
            drawing.type === 'spell-triangle') && (
            <div className="property-section">
              <label htmlFor="rotation-slider">
                Rotation: {rotation.toFixed(0)}°
              </label>
              <input
                id="rotation-slider"
                type="range"
                min="0"
                max="360"
                step="15"
                value={rotation}
                onChange={(e) =>
                  handleRotationChange(parseFloat(e.target.value))
                }
                className="slider"
              />
            </div>
          )}

          {/* Visibility Toggle */}
          <div className="property-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={visibleToPlayers}
                onChange={handleVisibilityToggle}
              />
              <span className="checkbox-icon">
                {visibleToPlayers ? <Eye size={16} /> : <EyeOff size={16} />}
              </span>
              <span>Visible to Players</span>
            </label>
          </div>

          {/* Animations Toggle */}
          <div className="property-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={animationsEnabled}
                onChange={handleAnimationsToggle}
              />
              <span className="checkbox-icon">
                <Sparkles size={16} />
              </span>
              <span>Animations Enabled</span>
            </label>
          </div>

          {/* Notes */}
          <div className="property-section">
            <label htmlFor="spell-notes">Notes / Description</label>
            <textarea
              id="spell-notes"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="e.g., Concentration required, affects undead only"
              className="textarea-input"
              rows={3}
            />
          </div>
        </div>
      </div>
    </AnchoredPropertiesPanel>
  );
};
