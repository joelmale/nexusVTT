import React, { useEffect, useRef, useState, useCallback } from 'react';
import DiceBox from '@3d-dice/dice-box-threejs';
import { useGameStore, useSettings } from '@/stores/gameStore';
import { diceSounds } from '@/services/diceSounds';

/**
 * Feature-detect WebGL without stranding the probe context. Browsers cap the
 * number of live WebGL contexts, so a probe that is never released costs a real
 * slot for the lifetime of the page.
 */
const hasWebGLSupport = (): boolean => {
  const probeCanvas = document.createElement('canvas');
  const probeGl = (probeCanvas.getContext('webgl') ||
    probeCanvas.getContext(
      'experimental-webgl',
    )) as WebGLRenderingContext | null;

  if (!probeGl) {
    return false;
  }

  try {
    probeGl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Losing the probe context is best-effort.
  }

  return true;
};

/** How long to wait for diceBox.initialize() before giving up. */
const INIT_TIMEOUT_MS = 15000;
/** How long to wait for a single .roll() before giving up on that roll. */
const ROLL_TIMEOUT_MS = 10000;

/**
 * Race a promise against a timeout so a hung dependency (a stalled texture
 * fetch, a physics edge case) surfaces as an error instead of leaving the
 * caller waiting forever with no feedback.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * dice-box-threejs exposes no dispose(), so release what it owns by hand:
 * stop the dice, dispose the three.js renderer/WebGL context, and detach the
 * canvas it created. Unlike the previous AmmoJS-based engine this runs
 * entirely on the main thread (no worker to terminate).
 */
const disposeDiceBox = (diceBox: DiceBox | null): void => {
  if (!diceBox) {
    return;
  }

  try {
    diceBox.clearDice();
  } catch (error) {
    console.warn('🎲 Error clearing dice box:', error);
  }

  try {
    diceBox.renderer?.dispose();
  } catch (error) {
    console.warn('🎲 Error disposing dice box renderer:', error);
  }

  diceBox.renderer?.domElement?.remove();
};

export const DiceBox3D: React.FC = () => {
  const diceBoxRef = useRef<DiceBox | null>(null);
  const diceBoxContainerRef = useRef<HTMLDivElement>(null);
  const processedRollIdsRef = useRef<Set<string>>(new Set());
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initInFlightRef = useRef(false);
  const effectActiveRef = useRef(false);
  const rollDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRollRef = useRef<{
    notations: string[];
    values: number[];
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const diceRolls = useGameStore((state) => state.diceRolls);
  const settings = useSettings();

  // Get dice theme (a dice-box-threejs colorset id) from localStorage,
  // synced with DiceRoller component.
  const getDiceTheme = useCallback(() => {
    try {
      return localStorage.getItem('nexus_dice_theme') || 'white';
    } catch {
      return 'white';
    }
  }, []);

  // Initialize DiceBox
  useEffect(() => {
    effectActiveRef.current = true;

    const initializeDiceBox = async () => {
      // Synchronous claim: React StrictMode double-invokes this effect in dev,
      // and `diceBoxRef` is only populated after `await initialize()`. Without
      // an in-flight flag set *before* the first await, both invocations pass
      // the guard and we end up with two renderers / WebGL contexts.
      if (!diceBoxContainerRef.current || diceBoxRef.current) {
        return;
      }
      if (initInFlightRef.current) {
        return;
      }
      initInFlightRef.current = true;

      // Hoisted so the catch block can dispose it on a failed/timed-out
      // init -- otherwise a DiceBox that got as far as creating its canvas,
      // then failed, leaks it (diceBoxRef never gets set, so the unmount
      // cleanup below never sees it either).
      let diceBox: DiceBox | null = null;

      try {
        // Check WebGL support
        console.log('🎲 Checking WebGL support...');
        if (!hasWebGLSupport()) {
          const error =
            'WebGL is not supported in this browser. 3D dice require WebGL.';
          console.error('🎲 ERROR:', error);
          setInitError(error);
          setIsInitialized(false);
          return;
        }
        console.log('✅ WebGL is supported');

        // Check if container exists. The DiceBox constructor resolves the
        // selector synchronously via document.querySelector with no
        // null-check of its own, so this pre-check gives a clear error
        // instead of a cryptic "Cannot read properties of null" crash.
        const container = document.querySelector('#dice-box');
        if (!container) {
          console.error('🎲 ERROR: Container #dice-box not found in DOM');
          setInitError('Dice container not found');
          return;
        }
        console.log('✅ Container found:', container);

        const config = {
          assetPath: '/assets/dice-box-threejs/',
          sounds: false, // We drive sound effects ourselves via diceSounds.
          theme_colorset: getDiceTheme(),
          theme_material: 'glass' as const,
          gravity_multiplier: 400,
          strength: 1.4,
          light_intensity: 0.9,
          shadows: false,
        };

        console.log('🎲 Initializing DiceBox with config:', config);
        diceBox = new DiceBox('#dice-box', config);

        diceBox.onRollComplete = () => {
          console.log('🎲 Roll animation complete');
        };

        console.log('🎲 Calling diceBox.initialize()...');
        await withTimeout(
          diceBox.initialize(),
          INIT_TIMEOUT_MS,
          'Timed out initializing the 3D dice engine (texture/asset load ' +
            'never completed).',
        );
        console.log('✅ DiceBox initialized successfully');

        // The component unmounted while init was in flight — tear the engine
        // down instead of stranding it.
        if (!effectActiveRef.current) {
          disposeDiceBox(diceBox);
          return;
        }

        diceBoxRef.current = diceBox;
        setIsInitialized(true);
        setInitError(null);

        // Debug checks - verify canvas was created
        debugCheckTimeoutRef.current = setTimeout(() => {
          debugCheckTimeoutRef.current = null;
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
        // init() failed or timed out before diceBoxRef was ever set, so the
        // unmount cleanup below won't dispose this instance -- do it here so
        // a half-created canvas/renderer doesn't leak.
        disposeDiceBox(diceBox);
        setInitError(
          error instanceof Error
            ? error.message
            : 'Failed to initialize or create DiceBox',
        );
        setIsInitialized(false);
      }
    };

    initializeDiceBox();

    return () => {
      effectActiveRef.current = false;

      // Clear any pending timeouts first so nothing fires against a disposed
      // engine.
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      if (debugCheckTimeoutRef.current) {
        clearTimeout(debugCheckTimeoutRef.current);
        debugCheckTimeoutRef.current = null;
      }

      // Defer the teardown decision by a task: under StrictMode the second
      // effect invocation runs synchronously right after this cleanup and sets
      // `effectActiveRef` back to true, so we keep the single engine alive
      // instead of churning it. On a real unmount the flag stays false.
      setTimeout(() => {
        if (effectActiveRef.current) {
          return;
        }
        disposeDiceBox(diceBoxRef.current);
        diceBoxRef.current = null;
        initInFlightRef.current = false;
      }, 0);
    };
  }, [getDiceTheme]);

  // Re-apply the theme once the engine finishes initializing (it's already
  // set via the constructor config, but this is a harmless safety net).
  useEffect(() => {
    if (diceBoxRef.current && isInitialized) {
      const theme_colorset = getDiceTheme();
      diceBoxRef.current.updateConfig({ theme_colorset }).catch((error) => {
        console.warn('🎲 Failed to update theme:', error);
      });
    }
  }, [getDiceTheme, isInitialized]);

  // DiceRoller's theme-cycle button writes the new theme to localStorage and
  // dispatches this event, since a same-tab localStorage write fires neither
  // a re-render here nor a native 'storage' event -- without it there is no
  // way for this component to learn the theme changed after its one-time
  // init.
  useEffect(() => {
    const handleDiceThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: string }>).detail;
      const theme_colorset = detail?.theme ?? getDiceTheme();
      if (!diceBoxRef.current || !isInitialized) return;
      diceBoxRef.current.updateConfig({ theme_colorset }).catch((error) => {
        console.warn('🎲 Failed to update theme:', error);
      });
    };

    window.addEventListener('nexus-dice-theme-changed', handleDiceThemeChanged);
    return () =>
      window.removeEventListener(
        'nexus-dice-theme-changed',
        handleDiceThemeChanged,
      );
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
          diceBoxRef.current.clearDice();
        } catch (error) {
          console.warn('🎲 Error clearing dice box before roll:', error);
        }

        // Play sound immediately when dice start rolling
        if (settings.enableSounds && settings.diceRollSounds) {
          diceSounds.playRollSound(values.length);
        }

        // Unlike the previous engine, dice-box-threejs genuinely supports
        // forcing each die's landed face via `@v1,v2,...` appended to the
        // notation, applied in the same order the dice were spawned -- which
        // matches the order notations/values were built above. So the 3D
        // animation now actually shows the server-authoritative result
        // instead of a decorrelated random one.
        const notation = `${notations.join('+')}@${values.join(',')}`;

        withTimeout(
          diceBoxRef.current.roll(notation),
          ROLL_TIMEOUT_MS,
          'Timed out waiting for the dice roll animation to finish.',
        )
          .then(() => {
            // Shorter clear timing to keep scene responsive
            const totalTime = 2000 + settings.diceDisappearTime;
            clearTimeoutRef.current = setTimeout(() => {
              if (diceBoxRef.current) {
                diceBoxRef.current.clearDice();
              }
            }, totalTime);
          })
          .catch((error) => {
            // A single bad roll (e.g. a known upstream edge case forcing a
            // d2/d4 face) shouldn't tear down the whole engine -- log and
            // leave it ready for the next roll.
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
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
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
