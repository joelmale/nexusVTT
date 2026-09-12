import React from 'react';
import { useTokenStore } from '@/stores/tokenStore';
import { useSession } from '@/stores/gameStore';

interface PlayerPanelProps {
  tokenId: string;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ tokenId }) => {
  const { updateTokenControl } = useTokenStore();
  const session = useSession();
  const token = useTokenStore.getState().tokens.find((t) => t.id === tokenId);

  if (!token || !session) return null;

  const players = session.players;

  const handlePlayerToggle = (playerId: string) => {
    const isControlled = token.controlledBy.includes(playerId);
    const newControlledBy = isControlled
      ? token.controlledBy.filter((id) => id !== playerId)
      : [...token.controlledBy, playerId];
    updateTokenControl(tokenId, newControlledBy);
  };

  return (
    <div className="token-toolbar-panel player-panel">
      <div className="token-panel-header">
        <span className="token-panel-title">Player Control</span>
      </div>
      <div className="token-panel-content">
        <div className="player-list">
          {players.map((player) => {
            const isControlled = token.controlledBy.includes(player.id);
            return (
              <button
                key={player.id}
                className={`player-btn ${isControlled ? 'active' : ''}`}
                onClick={() => handlePlayerToggle(player.id)}
                title={`${player.name} ${isControlled ? '(Controls this token)' : ''}`}
              >
                <span className="player-icon">👤</span>
                <span className="player-name">{player.name}</span>
                {isControlled && <span className="player-check">✓</span>}
              </button>
            );
          })}
        </div>
        {players.length === 0 && (
          <div className="no-players-message">No players in session</div>
        )}
      </div>
    </div>
  );
};
