import React, { useEffect, useRef, useState, useCallback } from 'react';
import DiceBox from '@3d-dice/dice-box';
import { useGameStore, useSettings } from '@/stores/gameStore';
import { diceSounds } from '@/services/diceSounds';

export const DiceBox3D: React.FC = () => {
  const diceBoxRef = useRef<DiceBox | null>(null);
  const diceBoxContainerRef = useRef<HTMLDivElement>(null);
  const processedRollIdsRef = useRef<Set<string>>(new Set());
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rollDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRollRef = useRef<{
    notations: string[];
    values: number[];
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const diceRolls = useGameStore((state) => state.diceRolls);
  const settings = useSettings();

  // Get dice theme from localStorage (synced with DiceRoller component)
  const getDiceTheme = useCallback(() => {
    try {
      return localStorage.getItem('nexus_dice_theme') || 'smooth';
    } catch {
      return 'smooth';
    }
  }, []);

  // Initialize DiceBox
  useEffect(() => {
    const initializeDiceBox = async () => {
      if (diceBoxContainerRef.current && !diceBoxRef.current) {
        try {
          // Check WebGL support
          console.log('🎲 Checking WebGL support...');
          const canvas = document.createElement('canvas');
          const gl =
            canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl');
          if (!gl) {
            const error =
              'WebGL is not supported in this browser. 3D dice require WebGL.';
            console.error('🎲 ERROR:', error);
            setInitError(error);
            setIsInitialized(false);
            return;
          }
          console.log('✅ WebGL is supported');

          // Check if container exists
          const container = document.querySelector('#dice-box');
          if (!container) {
            console.error('🎲 ERROR: Container #dice-box not found in DOM');
            setInitError('Dice container not found');
            return;
          }
          console.log('✅ Container found:', container);

          const config = {
            id: 'dice-canvas',
            container: '#dice-box',
            assetPath: '/assets/dice-box/',
            theme: 'default',
            offscreen: false,
            scale: 6,
            gravity: 1,
            mass: 0.85,
            friction: 0.65,
            restitution: 0.04,
            linearDamping: 0.55,
            angularDamping: 0.65,
            spinForce: 2.6,
            throwForce: 3,
            startingHeight: 5,
            settleTimeout: 2000,
            delay: 4,
            enableShadows: false,
            lightIntensity: 0.6,
          };

          console.log('🎲 Initializing DiceBox with config:', config);
          const diceBox = new DiceBox(config);

          diceBox.onRollComplete = (_results: unknown) => {
            console.log('🎲 Roll animation complete');
          };

          console.log('🎲 Calling diceBox.init()...');
          await diceBox.init();
          console.log('✅ DiceBox initialized successfully');

          diceBoxRef.current = diceBox;
          setIsInitialized(true);
          setInitError(null);

          // Debug checks - verify canvas was created
          setTimeout(() => {
            if (diceBoxContainerRef.current) {
              const canvasElement =
                diceBoxContainerRef.current.querySelector('canvas');
              if (canvasElement) {
                console.log('✅ Canvas element found:', canvasElement);
                console.log(
                  '   Canvas dimensions:',
                  canvasElement.width,
                  'x',
                  canvasElement.height,
                );
              } else {
                console.error('🎲 ERROR: No canvas element found after init!');
                console.log(
                  '   Container children:',
                  diceBoxContainerRef.current.children,
                );
              }
            }
          }, 1000);
        } catch (error) {
          console.error('🎲 Failed to initialize DiceBox3D:', error);
          console.error(
            '   Error stack:',
            error instanceof Error ? error.stack : 'No stack trace',
          );
          setInitError(
            error instanceof Error
              ? error.message
              : 'Failed to initialize or create DiceBox',
          );
          setIsInitialized(false);
        }
      }
    };

    initializeDiceBox();

    return () => {
      if (diceBoxRef.current) {
        try {
          diceBoxRef.current.clear();
        } catch (error) {
          console.warn('🎲 Error clearing dice box:', error);
        }
      }
      // Clear any pending timeout
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    };
  }, [getDiceTheme]);

  // Update theme when it changes
  useEffect(() => {
    if (diceBoxRef.current && isInitialized) {
      const theme = getDiceTheme();
      try {
        diceBoxRef.current.updateConfig({ theme });
      } catch (error) {
        console.warn('🎲 Failed to update theme:', error);
      }
    }
  }, [getDiceTheme, isInitialized]);

  // Handle new dice rolls
  useEffect(() => {
    if (diceRolls.length === 0) {
      return;
    }

    // Process all unprocessed rolls
    const unprocessedRolls = diceRolls.filter(
      (roll) => !processedRollIdsRef.current.has(roll.id),
    );

    if (unprocessedRolls.length === 0) {
      return;
    }

    // Play sounds even if animations are disabled
    if (!settings.enableAnimations) {
      if (settings.enableSounds && settings.diceRollSounds) {
        unprocessedRolls.forEach((roll) => {
          let diceCount = 0;
          roll.pools.forEach((pool) => {
            diceCount += pool.results.length + (pool.advResults?.length || 0);
          });
          diceSounds.playRollSound(diceCount);
        });
      }
      // Mark all as processed
      unprocessedRolls.forEach((roll) =>
        processedRollIdsRef.current.add(roll.id),
      );
      return;
    }

    if (!isInitialized || !diceBoxRef.current) {
      return;
    }

    // For now, just process the latest unprocessed roll to maintain existing behavior
    const latestRoll = unprocessedRolls[unprocessedRolls.length - 1];

    // Convert server roll results to dice notation with predetermined values
    const rollNotations: string[] = [];
    const rollValues: number[] = [];

    for (const pool of latestRoll.pools) {
      // For advantage/disadvantage rolls, we have two sets of results
      const resultsToUse =
        latestRoll.advResults && latestRoll.advResults.length > 0
          ? [...pool.results, ...(pool.advResults || [])]
          : pool.results;

      // Add each die individually with its predetermined value
      for (const value of resultsToUse) {
        rollNotations.push(`1d${pool.sides}`);
        rollValues.push(value);
      }
    }

    // Roll the dice with predetermined values from the server
    if (rollNotations.length > 0) {
      // Debounce multiple incoming rolls to avoid stacking animations
      pendingRollRef.current = { notations: rollNotations, values: rollValues };

      if (rollDebounceRef.current) {
        clearTimeout(rollDebounceRef.current);
      }

      rollDebounceRef.current = setTimeout(() => {
        const payload = pendingRollRef.current;
        pendingRollRef.current = null;
        rollDebounceRef.current = null;
        if (!payload || !diceBoxRef.current) return;

        const { notations, values } = payload;

        // Clear any existing timeout
        if (clearTimeoutRef.current) {
          clearTimeout(clearTimeoutRef.current);
          clearTimeoutRef.current = null;
        }

        // Clear existing dice before rolling again to avoid stacking meshes
        try {
          diceBoxRef.current.clear();
        } catch (error) {
          console.warn('🎲 Error clearing dice box before roll:', error);
        }

        // Play sound immediately when dice start rolling
        if (settings.enableSounds && settings.diceRollSounds) {
          diceSounds.playRollSound(values.length);
        }

        diceBoxRef.current
          .roll(notations, { values })
          .then((_results) => {
            // Shorter clear timing to keep scene responsive
            const totalTime = 2000 + settings.diceDisappearTime;
            clearTimeoutRef.current = setTimeout(() => {
              if (diceBoxRef.current) {
                diceBoxRef.current.clear();
              }
            }, totalTime);
          })
          .catch((error) => {
            console.error('🎲 Error rolling dice:', error);
          });

        processedRollIdsRef.current.add(latestRoll.id);
      }, 120);
    }
  }, [
    diceRolls,
    isInitialized,
    settings.diceDisappearTime,
    settings.diceRollSounds,
    settings.enableAnimations,
    settings.enableSounds,
  ]);

  return (
    <>
      <div
        id="dice-box"
        ref={diceBoxContainerRef}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '500px',
          height: '400px',
          zIndex: 'var(--z-dice-3d)',
          pointerEvents: 'none', // Allow clicks to pass through to canvas below
        }}
      />
      {initError && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            padding: '1rem',
            borderRadius: '8px',
            maxWidth: '300px',
            zIndex: 'calc(var(--z-dice-3d) + 1)',
            fontSize: '0.9rem',
          }}
        >
          <strong>3D Dice Error:</strong> {initError}
        </div>
      )}
    </>
  );
};
