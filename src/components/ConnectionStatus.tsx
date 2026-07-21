import React, { useState, useEffect } from 'react';
import { webSocketService } from '@/services/websocket';
import { useGameStore } from '@/stores/gameStore';

interface ConnectionQuality {
  latency: number;
  packetLoss: number;
  quality: 'excellent' | 'good' | 'poor' | 'critical';
  lastUpdate: number;
}

interface ConnectionStatusProps {
  showDetails?: boolean;
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  className = '',
}) => {
  const [connectionQuality, setConnectionQuality] =
    useState<ConnectionQuality | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { session } = useGameStore();

  useEffect(() => {
    const updateConnectionStatus = () => {
      const connected = webSocketService.isConnected();
      setIsConnected(connected);

      if (connected) {
        const quality = webSocketService.getConnectionQuality();
        setConnectionQuality(quality);
      } else {
        setConnectionQuality(null);
      }
    };

    // Update immediately
    updateConnectionStatus();

    // Set up periodic updates
    const interval = setInterval(updateConnectionStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    if (!session?.roomCode) return;

    try {
      setIsReconnecting(true);
      await webSocketService.reconnect('manual-button');
    } catch (error) {
      console.error('Failed to reconnect:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-blue-500';
      case 'poor':
        return 'text-yellow-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getQualityIcon = (quality: string) => {
    if (!isConnected) return '🔴';

    switch (quality) {
      case 'excellent':
        return '🟢';
      case 'good':
        return '🟡';
      case 'poor':
        return '🟠';
      case 'critical':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getQualityLabel = (quality: string) => {
    if (!isConnected) return 'Disconnected';

    switch (quality) {
      case 'excellent':
        return 'Excellent';
      case 'good':
        return 'Good';
      case 'poor':
        return 'Poor';
      case 'critical':
        return 'Critical';
      default:
        return 'Unknown';
    }
  };

  if (!isConnected && !showDetails) {
    return null; // Don't show anything when disconnected unless details are requested
  }

  return (
    <div className={`connection-status ${className}`}>
      <div className="flex items-center gap-2">
        <span
          className="text-lg"
          title={getQualityLabel(connectionQuality?.quality || 'unknown')}
        >
          {getQualityIcon(connectionQuality?.quality || 'unknown')}
        </span>

        {showDetails && connectionQuality && (
          <div className="flex flex-col text-sm">
            <span
              className={`font-medium ${getQualityColor(connectionQuality.quality)}`}
            >
              {getQualityLabel(connectionQuality.quality)}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {connectionQuality.latency}ms latency
            </span>
          </div>
        )}

        {!isConnected && session?.roomCode && (
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            title="Attempt to reconnect"
          >
            {isReconnecting ? 'Reconnecting…' : 'Reconnect'}
          </button>
        )}
      </div>

      {showDetails && connectionQuality && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Last updated:{' '}
          {new Date(connectionQuality.lastUpdate).toLocaleTimeString()}
          {connectionQuality.packetLoss > 0 && (
            <span className="ml-2 text-red-500">
              {connectionQuality.packetLoss} packet loss
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
