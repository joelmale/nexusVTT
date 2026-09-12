 
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DiceRoll } from '../../services/diceService';
import DiceBox, { DiceBoxConfig } from '@3d-dice/dice-box';
import { log } from '../../utils/logger';

interface DiceBox3DProps {
  latestRoll: DiceRoll | null;
  onRollComplete?: () => void;
  onRollResults?: (rollId: string, diceValues: number[], total: number) => void;
}

export const DiceBox3D: React.FC<DiceBox3DProps> = ({
  latestRoll,
  onRollComplete,
  onRollResults,
}) => {
  const diceBoxRef = useRef<DiceBox | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRollIdRef = useRef<string | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diceVisible, setDiceVisible] = useState(false);

  // Function to ensure canvas is visible and properly sized
  const ensureCanvasVisible = () => {
    const container = document.getElementById('dice-box');
    if (container) {
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        // Calculate 50% of viewport size
        const width = Math.floor(window.innerWidth * 0.5);
        const height = Math.floor(window.innerHeight * 0.5);

        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.width = width;
        canvas.height = height;
      }
    }
  };

  // Initialize DiceBox lazily on first roll
  const initDiceBoxIfNeeded = useCallback(async () => {
    if (isInitialized || diceBoxRef.current) {
      return;
    }

    try {
      const config: DiceBoxConfig = {
        container: '#dice-box',
        assetPath: '/assets/dice-box/',
        offscreen: false,
        gravity: 2, // Increased gravity for faster settling
        friction: 0.9, // Increased friction to slow down faster
        restitution: 0.3, // Reduced bounce for quicker settle
        linearDamping: 0.6, // Increased damping for faster energy loss
        angularDamping: 0.6, // Increased damping for faster spin reduction
        spinForce: 3,
        throwForce: 4,
        startingHeight: 6, // Reduced height for faster landing
        settleTimeout: 2000, // Reduced from 5000ms to 2000ms
        enableShadows: true,
        scale: 6
      };

      const diceBox = new DiceBox(config);

      await diceBox.init();

      // Ensure canvas is visible and sized properly
      setTimeout(() => {
        ensureCanvasVisible();
      }, 100);

      diceBoxRef.current = diceBox;
      setIsInitialized(true);

      diceBox.onRollComplete = (_results) => {
        if (onRollComplete) {
          onRollComplete();
        }
      };

    } catch (err) {
      log.error('Failed to initialize 3D dice', { error: err });
      setError('Failed to initialize 3D dice');
    }
  }, [isInitialized, onRollComplete]);

  // Handle dice rolls
  useEffect(() => {
    // Only roll when there's a new roll that hasn't been resolved with dice results yet
    if (
      !latestRoll ||
      lastRollIdRef.current === latestRoll.id ||
      latestRoll.diceResults.length > 0
    ) {
      return;
    }

    const performRoll = async () => {
      // Initialize DiceBox if needed
      await initDiceBoxIfNeeded();

      if (!diceBoxRef.current) {
        log.error('DiceBox not available after initialization');
        return;
      }

      lastRollIdRef.current = latestRoll.id;

       // Determine the correct notation to use for DiceBox
       let diceNotation: string;

        if (latestRoll.pools && latestRoll.pools.length > 0) {
          // For complex rolls (advantage/disadvantage), use the pool info
          const pool = latestRoll.pools[0];
          diceNotation = `${pool.count}d${pool.sides}`;
        } else {
          // For simple rolls, strip modifiers
          diceNotation = latestRoll.notation.replace(/[+-]\d+$/, '').trim();
        }

       // Clear previous dice first
       await diceBoxRef.current.clear();

       // Show dice and ensure canvas is visible
       setDiceVisible(true);
        ensureCanvasVisible();

        diceBoxRef.current.roll(diceNotation)
          .then(results => {
            // Extract the actual dice values from DiceBox results
            const diceValues = results.map(result => result.value);

            // Calculate the total based on roll type
            let actualTotal: number;
            if (latestRoll.pools && latestRoll.pools.length > 0) {
              // For complex rolls, apply the keep/drop logic
              if (latestRoll.notation.includes('kh1')) {
               // Keep highest
               actualTotal = Math.max(...diceValues) + latestRoll.modifier;
             } else if (latestRoll.notation.includes('kl1')) {
               // Keep lowest
               actualTotal = Math.min(...diceValues) + latestRoll.modifier;
             } else {
               // Default to sum
               actualTotal = diceValues.reduce((sum, val) => sum + val, 0) + latestRoll.modifier;
             }
           } else {
             // For simple rolls, just the die value + modifier
             actualTotal = diceValues[0] + latestRoll.modifier;
            }

            // Update the roll with real results
           if (onRollResults) {
             if (latestRoll.pools && latestRoll.pools.length > 0) {
               // For complex rolls, update both diceResults and pools
               const keptValues = latestRoll.notation.includes('kh1')
                 ? [Math.max(...diceValues)]
                 : latestRoll.notation.includes('kl1')
                 ? [Math.min(...diceValues)]
                 : diceValues;

               onRollResults(latestRoll.id, keptValues, actualTotal);
             } else {
               // For simple rolls, just update diceResults
               onRollResults(latestRoll.id, diceValues, actualTotal);
             }
           }
         })
        .catch(err => {
           log.error('Dice roll failed in DiceBox3D', { error: err });
         });

      // Auto-hide after 3 seconds (reduced from 5 for faster settling)
      const timer = setTimeout(() => {
        if (diceBoxRef.current) {
          diceBoxRef.current.clear();
          setDiceVisible(false);
        }
      }, 3000);

      return () => clearTimeout(timer);
    };

    performRoll();
  }, [latestRoll, initDiceBoxIfNeeded, onRollResults]);

  if (error) {
    return (
      <div className="fixed top-4 right-4 p-4 bg-red-900/90 text-theme-primary rounded-lg shadow-xl z-50 max-w-sm">
        <p className="font-bold">Dice Error</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-2 px-3 py-1 bg-theme-tertiary hover:bg-theme-quaternary rounded text-sm"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        pointerEvents: diceVisible ? 'auto' : 'none',
        opacity: diceVisible ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => {
        if (diceBoxRef.current) {
          diceBoxRef.current.clear();
          setDiceVisible(false);
        }
      }}
    >
      {/* Dice box container - 50% size, centered with white border and backdrop blur */}
      <div
        id="dice-box"
        ref={containerRef}
        className={diceVisible ? 'cursor-pointer' : ''}
        style={{
          width: '50vw',
          height: '50vh',
          border: '2px solid rgba(255, 255, 255, 0.5)',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          position: 'relative',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Force canvas to be positioned inside this container */}
        <style>{`
          #dice-box canvas {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
        `}</style>
        {/* Placeholder content to ensure container is not empty */}
        <div style={{ display: 'none' }}>Dice Box Container</div>
      </div>
    </div>
  );
};

export default DiceBox3D;
