import React from 'react';
import { useGameStore, useSelectedPlacedToken, useActiveScene } from '@/stores/gameStore';
import { tokenAssetManager } from '@/services/tokenAssets';
import {
  getEffectiveTokenSize,
  getEffectiveTokenLightRadius,
  getEffectiveTokenAura,
  type TokenSize
} from '@/types/token';
import { webSocketService } from '@/utils/websocket';

interface OptionsPanelProps {
  tokenId?: string; // Not currently used, kept for interface compatibility
}

const SIZE_OPTIONS: Array<{
  size: TokenSize;
  display: string;
}> = [
  { size: 'tiny', display: 'Tiny (2.5ft)' },
  { size: 'small', display: 'Small (5ft)' },
  { size: 'medium', display: 'Medium (5ft)' },
  { size: 'large', display: 'Large (10ft)' },
  { size: 'huge', display: 'Huge (15ft)' },
  { size: 'gargantuan', display: 'Gargantuan (20ft+)' },
];

const AURA_OPTIONS = ['None', 'Frightened', 'Charmed', 'Poisoned', 'Custom'];

export const OptionsPanel: React.FC<OptionsPanelProps> = () => {
  const placedToken = useSelectedPlacedToken();
  const activeScene = useActiveScene();
  const { updateToken, deleteToken, clearSelection } = useGameStore();

  if (!placedToken || !activeScene) return null;

  const baseToken = tokenAssetManager.getTokenById(placedToken.tokenId) || undefined;
  const effectiveSize = getEffectiveTokenSize(placedToken, baseToken);
  const effectiveLightRadius = getEffectiveTokenLightRadius(placedToken, baseToken);
  const effectiveAura = getEffectiveTokenAura(placedToken, baseToken);

  const handleSizeChange = (direction: 'prev' | 'next') => {
    const currentIndex = SIZE_OPTIONS.findIndex(
      (option) => option.size === effectiveSize,
    );
    let newIndex;

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : SIZE_OPTIONS.length - 1;
    } else {
      newIndex = currentIndex < SIZE_OPTIONS.length - 1 ? currentIndex + 1 : 0;
    }

    updateToken(activeScene.id, placedToken.id, {
      sizeOverride: SIZE_OPTIONS[newIndex].size,
    });
  };

  const handleLightChange = (direction: 'prev' | 'next') => {
    let newRadius;

    if (direction === 'prev') {
      newRadius = Math.max(0, effectiveLightRadius - 5);
    } else {
      newRadius = Math.min(120, effectiveLightRadius + 5); // Max 120ft
    }

    updateToken(activeScene.id, placedToken.id, {
      lightRadiusOverride: newRadius,
    });
  };

  const handleAuraChange = (direction: 'prev' | 'next') => {
    const currentIndex = AURA_OPTIONS.indexOf(effectiveAura);
    let newIndex;

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : AURA_OPTIONS.length - 1;
    } else {
      newIndex = currentIndex < AURA_OPTIONS.length - 1 ? currentIndex + 1 : 0;
    }

    updateToken(activeScene.id, placedToken.id, {
      auraOverride: AURA_OPTIONS[newIndex],
    });
  };

  const currentSizeOption = SIZE_OPTIONS.find(
    (option) => option.size === effectiveSize,
  );

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this token?')) {
      deleteToken(activeScene.id, placedToken.id);
      clearSelection();

      // Broadcast deletion
      webSocketService.sendEvent({
        type: 'token/delete',
        data: {
          sceneId: activeScene.id,
          tokenId: placedToken.id,
        },
      });
    }
  };

  return (
    <div className="token-toolbar-panel options-panel">
      <div className="token-panel-header">
        <span className="token-panel-title">Token Options</span>
      </div>
      <div className="token-panel-content">
        {/* Size Row */}
        <div className="token-option-row">
          <span className="token-option-label">Size:</span>
          <button
            className="token-option-btn"
            onClick={() => handleSizeChange('prev')}
            title="Previous size"
          >
            ‹
          </button>
          <span className="token-option-value">
            {currentSizeOption?.display || effectiveSize}
          </span>
          <button
            className="token-option-btn"
            onClick={() => handleSizeChange('next')}
            title="Next size"
          >
            ›
          </button>
        </div>

        {/* Light Row */}
        <div className="token-option-row">
          <span className="token-option-label">Light:</span>
          <button
            className="token-option-btn"
            onClick={() => handleLightChange('prev')}
            title="Decrease light radius"
          >
            ‹
          </button>
          <span className="token-option-value">
            {effectiveLightRadius}ft. radius
          </span>
          <button
            className="token-option-btn"
            onClick={() => handleLightChange('next')}
            title="Increase light radius"
          >
            ›
          </button>
        </div>

        {/* Aura Row */}
        <div className="token-option-row">
          <span className="token-option-label">Aura:</span>
          <button
            className="token-option-btn"
            onClick={() => handleAuraChange('prev')}
            title="Previous aura"
          >
            ‹
          </button>
          <span className="token-option-value">{effectiveAura}</span>
          <button
            className="token-option-btn"
            onClick={() => handleAuraChange('next')}
            title="Next aura"
          >
            ›
          </button>
        </div>

        {/* Delete Token Row */}
        <div className="token-option-row" style={{ marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
          <button
            className="token-option-btn danger"
            onClick={handleDelete}
            title="Delete Token"
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              color: 'var(--color-danger, #dc2626)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <span>🗑️</span>
            <span>Delete Token</span>
          </button>
        </div>
      </div>
    </div>
  );
};
