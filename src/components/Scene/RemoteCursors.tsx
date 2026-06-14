import React, { useEffect, useRef, useState } from 'react';
import { webSocketService } from '@/services/websocket';
import { useGameStore } from '@/stores/gameStore';

interface RemoteCursor {
  userId: string;
  userName: string;
  position: { x: number; y: number };
  lastUpdate: number;
}

interface RemoteCursorsProps {
  sceneId: string;
}

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({ sceneId }) => {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const canvasRef = useRef<HTMLDivElement>(null);
  const { user } = useGameStore();

  useEffect(() => {
    // Throttled cursor position sender
    const sendCursorUpdate = throttle((e: MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      webSocketService.sendEvent({
        type: 'cursor/update',
        data: {
          userId: user.id,
          userName: user.name,
          position: { x, y },
          sceneId,
        },
      });
    }, 50); // Update every 50ms max

    const handleCursorUpdate = (e: Event) => {
      const message = (e as CustomEvent).detail;
      if (message.type === 'event' && message.data.name === 'cursor/update') {
        const cursorData = message.data;
        if (cursorData.sceneId === sceneId && cursorData.userId !== user.id) {
          setCursors((prev) => {
            const next = new Map(prev);
            next.set(cursorData.userId, {
              userId: cursorData.userId,
              userName: cursorData.userName,
              position: cursorData.position,
              lastUpdate: Date.now(),
            });
            return next;
          });
        }
      }
    };

    // Cleanup old cursors (remove cursors that haven't updated in 3 seconds)
    const cleanupInterval = setInterval(() => {
      setCursors((prev) => {
        const next = new Map(prev);
        const now = Date.now();
        for (const [userId, cursor] of next) {
          if (now - cursor.lastUpdate > 3000) {
            next.delete(userId);
          }
        }
        return next;
      });
    }, 1000);

    // Add event listeners
    const canvas = canvasRef.current;
    canvas?.addEventListener('mousemove', sendCursorUpdate);
    webSocketService.addEventListener('message', handleCursorUpdate);

    return () => {
      canvas?.removeEventListener('mousemove', sendCursorUpdate);
      webSocketService.removeEventListener('message', handleCursorUpdate);
      clearInterval(cleanupInterval);
    };
  }, [sceneId, user.id, user.name]);

  return (
    <div ref={canvasRef} className="remote-cursors-layer">
      {Array.from(cursors.values()).map((cursor) => (
        <div
          key={cursor.userId}
          className="remote-cursor"
          style={{
            left: cursor.position.x,
            top: cursor.position.y,
            transform: 'translate(-50%, -50%)', // Center the cursor on the position
          }}
        >
          <div className="remote-cursor-arrow" />
          <div className="cursor-label">{cursor.userName}</div>
        </div>
      ))}
    </div>
  );
};

// Throttle utility function
function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  limit: number,
): T {
  let inThrottle: boolean;
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}
