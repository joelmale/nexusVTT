/**
 * DM Setup Page Component
 *
 * Allows DMs to:
 * - Configure game settings
 * - Create a game room
 * - Get room code to share with players
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import type { GameConfig } from '@/types/game';

export const DMSetupPage: React.FC = () => {
  const { user, createGameRoom } = useGameStore();
  const navigate = useNavigate();
  const [gameConfig, setGameConfig] = useState<GameConfig>({
    name: '',
    description: '',
    estimatedTime: '',
    campaignType: 'oneshot',
    maxPlayers: 6,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    if (!gameConfig.name.trim()) {
      setError('Please enter a game name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const roomCode = await createGameRoom(gameConfig);
      navigate(`/lobby/game/${roomCode}`);
    } catch (err) {
      setError('Failed to create game room');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (updates: Partial<GameConfig>) => {
    setGameConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleBack = () => {
    navigate('/lobby');
  };

  const isFormValid = gameConfig.name.trim().length > 0;

  return (
    <div className="dm-setup">
      <div className="setup-background">
        <div className="background-overlay"></div>
      </div>

      <div className="setup-content">
        <div className="setup-panel glass-panel">
          <div className="setup-header">
            <div className="header-with-back">
              <button
                onClick={handleBack}
                className="back-button glass-button"
                title="Back to Welcome"
              >
                <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                  <path
                    d="M15 18l-6-6 6-6"
                    stroke="white"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="header-content">
                <h1>👑 Dungeon Master Setup</h1>
                <p>
                  Welcome, <strong>{user.name}</strong>! Configure your game and
                  create a room.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message glass-panel error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Game Configuration */}
          <div className="setup-section">
            <h2>🎲 Game Configuration</h2>
            <div className="config-form">
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="gameName">Game Name *</label>
                  <input
                    id="gameName"
                    type="text"
                    value={gameConfig.name}
                    onChange={(e) =>
                      handleConfigChange({ name: e.target.value })
                    }
                    placeholder="The Lost Mines of Phandelver"
                    className="glass-input"
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="estimatedTime">Estimated Duration</label>
                  <input
                    id="estimatedTime"
                    type="text"
                    value={gameConfig.estimatedTime}
                    onChange={(e) =>
                      handleConfigChange({ estimatedTime: e.target.value })
                    }
                    placeholder="3-4 hours"
                    className="glass-input"
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="maxPlayers">Max Players</label>
                  <input
                    id="maxPlayers"
                    type="number"
                    min="1"
                    max="12"
                    value={gameConfig.maxPlayers}
                    onChange={(e) =>
                      handleConfigChange({
                        maxPlayers: parseInt(e.target.value) || 6,
                      })
                    }
                    className="glass-input"
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="campaignType">Game Type</label>
                  <select
                    id="campaignType"
                    value={gameConfig.campaignType}
                    onChange={(e) =>
                      handleConfigChange({
                        campaignType: e.target.value as 'campaign' | 'oneshot',
                      })
                    }
                    className="glass-select"
                    disabled={loading}
                  >
                    <option value="oneshot">One-Shot</option>
                    <option value="campaign">Campaign</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={gameConfig.description}
                  onChange={(e) =>
                    handleConfigChange({ description: e.target.value })
                  }
                  placeholder="A thrilling adventure awaits! Join our heroes as they..."
                  rows={4}
                  className="glass-textarea"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Game Summary */}
          {isFormValid && (
            <div className="setup-section">
              <h2>📋 Game Summary</h2>
              <div className="game-summary glass-panel">
                <h3>{gameConfig.name}</h3>
                {gameConfig.description && (
                  <p className="summary-description">
                    {gameConfig.description}
                  </p>
                )}
                <div className="summary-details">
                  <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">
                      {gameConfig.campaignType === 'campaign'
                        ? '📚 Campaign'
                        : '⚡ One-Shot'}
                    </span>
                  </div>
                  {gameConfig.estimatedTime && (
                    <div className="detail-item">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">
                        ⏱️ {gameConfig.estimatedTime}
                      </span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Players:</span>
                    <span className="detail-value">
                      👥 Up to {gameConfig.maxPlayers}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Room */}
          <div className="setup-section">
            <h2>🚀 Launch Game</h2>
            <div className="create-room-section">
              <p className="create-description">
                Ready to begin? Click below to create your game room and get a
                shareable room code.
              </p>

              <button
                onClick={handleCreateRoom}
                disabled={!isFormValid || loading}
                className="glass-button primary create-room-btn"
              >
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Creating Room...
                  </>
                ) : (
                  <>
                    <span>🎲</span>
                    Create Game Room
                  </>
                )}
              </button>

              {!isFormValid && (
                <p className="form-hint">
                  Please fill in the required fields to create your game room.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
