/**
 * Lobby Panel Component
 *
 * Unified session management panel for both DMs and Players.
 * Handles online/offline modes, room codes, and player connections.
 */

import React, { useState } from 'react';
import {
  useSession,
  useIsHost,
  useGameStore,
  useServerRoomCode,
  useIsConnected,
} from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';
import type { Player } from '@/types/game';

interface PlayerCardProps {
  player: Player;
  isHost: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player }) => {
  return (
    <div
      className={`player-card ${player.type === 'host' ? 'dm-card' : ''} ${player.connected ? 'online' : 'offline'}`}
    >
      <div className="player-header">
        <div className="player-avatar">
          {player.type === 'host' ? '👑' : '⚔️'}
        </div>
        <div className="player-info">
          <div className="player-name">{player.name}</div>
          <div className="player-role">
            {player.type === 'host' ? 'Dungeon Master' : 'Player'}
            {player.canEditScenes && player.type !== 'host' && ' (Co-DM)'}
          </div>
        </div>
        <div
          className={`connection-indicator ${player.connected ? 'online' : 'offline'}`}
        >
          <span className="indicator-dot"></span>
          <span className="status-text">
            {player.connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const LobbyPanel: React.FC = () => {
  const session = useSession();
  const isHost = useIsHost();
  const { gameConfig, leaveRoom, createGameRoom } = useGameStore();
  const roomCode = useServerRoomCode();
  const isConnectedToRoom = useIsConnected();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [playerRoomCode, setPlayerRoomCode] = useState('');

  const handleStartOnlineGame = async () => {
    setIsConnecting(true);
    setError('');

    try {
      if (isHost) {
        // DM: Create a new online room (don't clear existing data - preserve offline work)

        const config = gameConfig || {
          name: 'New Campaign',
          description: 'Online game session',
          estimatedTime: '2',
          campaignType: 'oneshot' as const,
          maxPlayers: 4,
        };

        await createGameRoom(config, false); // false = don't clear data
      } else {
        // Player: Connect to existing room using entered room code
        const codeToJoin = playerRoomCode.trim().toUpperCase();

        if (!codeToJoin) {
          setError('Please enter a room code');
          return;
        }

        await webSocketService.connect(codeToJoin, 'player');

        // Note: roomCode and connection status are derived from session state
      }
    } catch (err) {
      console.error('Failed to start online game:', err);
      setError('Failed to connect to server. Please check your connection.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleShareRoom = () => {
    if (!roomCode) return;

    const url = `${window.location.origin}/game/${roomCode}`;

    // Try to use Web Share API if available
    if (navigator.share) {
      navigator
        .share({
          title: 'Join my D&D game!',
          text: `Join my game with room code: ${roomCode}`,
          url,
        })
        .catch((_err) => {});
    } else {
      // Fallback to clipboard
      navigator.clipboard
        .writeText(url)
        .then(() => {
          alert(`Room URL copied to clipboard!\n${url}`);
        })
        .catch(() => {
          alert(
            `Share this URL with your players:\n${url}\n\nRoom Code: ${roomCode}`,
          );
        });
    }
  };

  const handleCopyRoomCode = () => {
    if (!roomCode) return;

    navigator.clipboard
      .writeText(roomCode)
      .then(() => {
        alert(`Room code copied: ${roomCode}`);
      })
      .catch(() => {
        alert(`Room Code: ${roomCode}`);
      });
  };

  return (
    <div className="lobby-panel">
      <div className="lobby-panel__header">
        <h2>🎲 Game Lobby</h2>
        <div
          className={`lobby-panel__connection-status ${isConnectedToRoom ? 'online' : 'offline'}`}
        >
          <span className="lobby-panel__status-dot"></span>
          <span className="lobby-panel__status-text">
            {isConnectedToRoom ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {error && (
        <div className="lobby-panel__error-message glass-panel error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Room Information */}
      <div className="lobby-panel__section glass-panel">
        <h3>Room Information</h3>

        <div className="lobby-panel__room-info-grid">
          <div className="lobby-panel__room-info-item">
            <label>Room Code</label>
            <div className="lobby-panel__room-code-display">
              <span className="lobby-panel__code">{roomCode || 'N/A'}</span>
              <button
                onClick={handleCopyRoomCode}
                className="glass-button small"
                title="Copy room code"
                disabled={!roomCode}
              >
                📋
              </button>
            </div>
          </div>

          <div className="lobby-panel__room-info-item">
            <label>Your Role</label>
            <div className="lobby-panel__role-badge">
              {isHost ? (
                <>
                  <span className="lobby-panel__role-icon">👑</span>
                  Dungeon Master
                </>
              ) : (
                <>
                  <span className="lobby-panel__role-icon">⚔️</span>
                  Player
                </>
              )}
            </div>
          </div>
        </div>

        {/* Online Game Controls */}
        {!isConnectedToRoom ? (
          <div className="lobby-panel__online-controls">
            <p className="lobby-panel__help-text">
              {isHost
                ? 'Start an online game to allow players to join remotely.'
                : 'Enter a room code to connect to the online game.'}
            </p>

            {/* Player: Room Code Input */}
            {!isHost && (
              <div className="lobby-panel__room-code-input-group">
                <input
                  type="text"
                  value={playerRoomCode}
                  onChange={(e) =>
                    setPlayerRoomCode(e.target.value.toUpperCase())
                  }
                  placeholder="Enter room code"
                  maxLength={6}
                  className="glass-input"
                  disabled={isConnecting}
                />
              </div>
            )}

            <button
              onClick={handleStartOnlineGame}
              disabled={isConnecting || (!isHost && !playerRoomCode.trim())}
              className="glass-button primary"
            >
              {isConnecting ? (
                <>
                  <span className="lobby-panel__loading-spinner"></span>
                  Connecting...
                </>
              ) : (
                <>
                  <span>🌐</span>
                  {isHost ? 'Start Online Game' : 'Join Online Game'}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="lobby-panel__online-controls">
            <p className="lobby-panel__help-text success">
              ✅ Connected to online game server
            </p>
            {isHost && (
              <button
                onClick={handleShareRoom}
                className="glass-button secondary"
              >
                <span>🔗</span>
                Share Room
              </button>
            )}
          </div>
        )}
      </div>

      {/* Players List */}
      {session && (
        <div className="lobby-panel__section">
          <h3>Party Members ({session.players.length})</h3>
          <div className="lobby-panel__players-list">
            {session.players.map((player) => (
              <PlayerCard key={player.id} player={player} isHost={isHost} />
            ))}
          </div>
        </div>
      )}

      {/* Leave Room */}
      <div className="lobby-panel__actions">
        <button onClick={leaveRoom} className="glass-button danger">
          <span>🚪</span>
          Leave Room
        </button>
      </div>
    </div>
  );
};
