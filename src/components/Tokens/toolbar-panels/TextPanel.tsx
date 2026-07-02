import React, { useState, useEffect } from 'react';
import { useGameStore, useSelectedPlacedToken, useActiveScene } from '@/stores/gameStore';
import { tokenAssetManager } from '@/services/tokenAssets';
import { getEffectiveTokenName } from '@/types/token';
import { useRef } from 'react';

interface TextPanelProps {
  tokenId?: string; // Not currently used, kept for interface compatibility
  onClose?: () => void;
}

export const TextPanel: React.FC<TextPanelProps> = ({ onClose }) => {
  const placedToken = useSelectedPlacedToken();
  const activeScene = useActiveScene();
  const { updateToken } = useGameStore();
  const [name, setName] = useState('');

  // Get current name when panel opens
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && placedToken) {
      const baseToken = tokenAssetManager.getTokenById(placedToken.tokenId) || undefined;
      const effectiveName = getEffectiveTokenName(placedToken, baseToken);
       
      setName(effectiveName);
      initializedRef.current = true;
    }
  }, [placedToken]);

  if (!placedToken || !activeScene) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // Update with override (empty string means use base token name)
    updateToken(activeScene.id, placedToken.id, {
      nameOverride: newName || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Close panel on Enter
      onClose?.();
    } else if (e.key === 'Escape') {
      // Reset to original value on Escape
      const baseToken = tokenAssetManager.getTokenById(placedToken.tokenId) || undefined;
      const effectiveName = getEffectiveTokenName(placedToken, baseToken);
      setName(effectiveName);
      onClose?.();
    }
  };

  return (
    <div className="token-toolbar-panel text-panel">
      <div className="token-panel-header">
        <span className="token-panel-title">Token Name</span>
      </div>
      <div className="token-panel-content">
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter token name..."
          className="token-text-input"
          autoFocus
        />
        <div className="token-panel-hint">
          Press Enter to confirm, Escape to cancel
        </div>
      </div>
    </div>
  );
};
