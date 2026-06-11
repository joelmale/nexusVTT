/**
 * CSS Lazy Loading Utility
 *
 * Dynamically loads CSS files on-demand to improve initial page load performance.
 * Non-critical styles are loaded only when needed.
 */

// Cache for loaded styles to prevent duplicate imports
const loadedStyles = new Set<string>();

// Performance monitoring and logging
interface CSSLoadMetrics {
  cssPath: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  caller?: string;
  priority?: 'critical' | 'high' | 'normal' | 'low';
}

class CSSPerformanceMonitor {
  private metrics: CSSLoadMetrics[] = [];

  startLoad(
    cssPath: string,
    caller?: string,
    priority: CSSLoadMetrics['priority'] = 'normal',
  ): string {
    const id = `${cssPath}_${Date.now()}`;
    this.metrics.push({
      cssPath,
      startTime: performance.now(),
      success: false,
      caller,
      priority,
    });

    console.debug(
      `🚀 Starting CSS load: ${cssPath}${caller ? ` (from ${caller})` : ''}${priority ? ` [${priority}]` : ''}`,
    );
    return id;
  }

  endLoad(id: string, success: boolean, error?: string) {
    const metric = this.metrics.find(
      (m) => `${m.cssPath}_${Math.floor(m.startTime)}` === id,
    );
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.success = success;
      metric.error = error;

      const status = success ? '✅' : '❌';
      const duration = metric.duration.toFixed(2);
      const priority = metric.priority ? `[${metric.priority}]` : '';
      console.log(
        `${status} CSS loaded: ${metric.cssPath} (${duration}ms) ${priority}${error ? ` - Error: ${error}` : ''}`,
      );
    }
  }

  getMetrics() {
    return this.metrics;
  }

  getAverageLoadTime(cssPath?: string) {
    const relevant = cssPath
      ? this.metrics.filter((m) => m.cssPath === cssPath && m.success)
      : this.metrics.filter((m) => m.success);
    return relevant.length > 0
      ? relevant.reduce((sum, m) => sum + (m.duration || 0), 0) /
          relevant.length
      : 0;
  }

  getLoadStats() {
    const successful = this.metrics.filter((m) => m.success);
    const failed = this.metrics.filter((m) => !m.success);
    const avgTime = this.getAverageLoadTime();

    return {
      totalLoads: this.metrics.length,
      successfulLoads: successful.length,
      failedLoads: failed.length,
      averageLoadTime: avgTime,
      slowestLoad: Math.max(...successful.map((m) => m.duration || 0)),
      fastestLoad: Math.min(...successful.map((m) => m.duration || 0)),
      recentLoads: this.metrics.slice(-5),
    };
  }
}

// Global performance monitor instance
const cssMonitor = new CSSPerformanceMonitor();

// CSS Loading Queue to prevent race conditions
interface CSSLoadRequest {
  cssPath: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  caller?: string;
  timeout?: number;
  retries?: number;
  fallbackCSS?: string;
}

class CSSLoadingQueue {
  private queue: CSSLoadRequest[] = [];
  private processing = false;
  private priorities = { critical: 4, high: 3, normal: 2, low: 1 };

  async enqueue(request: CSSLoadRequest): Promise<void> {
    this.queue.push(request);
    this.queue.sort(
      (a, b) => this.priorities[b.priority] - this.priorities[a.priority],
    );

    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      try {
        await loadCSSWithFallback(request.cssPath, {
          timeout: request.timeout,
          retries: request.retries,
          fallbackCSS: request.fallbackCSS,
          caller: request.caller,
          priority: request.priority,
        });
      } catch (error) {
        console.error(`Failed to load queued CSS: ${request.cssPath}`, error);
        // Continue processing other items
      }
    }

    this.processing = false;
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      queuedItems: this.queue.map((item) => ({
        path: item.cssPath,
        priority: item.priority,
        caller: item.caller,
      })),
    };
  }
}

// Global loading queue instance
const cssQueue = new CSSLoadingQueue();

/**
 * Loads a CSS file dynamically by creating a link element
 * @param cssPath - Path to the CSS file (relative to src/styles/)
 * @param options - Loading options
 * @returns Promise that resolves when CSS is loaded
 */
export function loadCSS(
  cssPath: string,
  options: {
    caller?: string;
    priority?: 'critical' | 'high' | 'normal' | 'low';
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Skip if already loaded
    if (loadedStyles.has(cssPath)) {
      resolve();
      return;
    }

    const { caller, priority = 'normal' } = options;
    const loadId = cssMonitor.startLoad(cssPath, caller, priority);

    try {
      // Create link element for dynamic CSS loading
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/src/styles/${cssPath}`;

      link.onload = () => {
        loadedStyles.add(cssPath);
        cssMonitor.endLoad(loadId, true);
        resolve();
      };

      link.onerror = (_event) => {
        const error = `Network error loading ${cssPath}`;
        cssMonitor.endLoad(loadId, false, error);
        reject(new Error(error));
      };

      document.head.appendChild(link);
    } catch (error) {
      const errorMsg = `Failed to create link element for ${cssPath}`;
      cssMonitor.endLoad(loadId, false, errorMsg);
      console.error(`❌ ${errorMsg}`, error);
      reject(error);
    }
  });
}

/**
 * Loads CSS with fallback, retry, and timeout capabilities
 * @param cssPath - Path to the CSS file (relative to src/styles/)
 * @param options - Loading options with fallback and retry logic
 * @returns Promise that resolves when CSS is loaded
 */
export function loadCSSWithFallback(
  cssPath: string,
  options: {
    timeout?: number;
    retries?: number;
    fallbackCSS?: string;
    caller?: string;
    priority?: 'critical' | 'high' | 'normal' | 'low';
    critical?: boolean;
  } = {},
): Promise<void> {
  const {
    timeout = 10000,
    retries = 2,
    fallbackCSS,
    caller,
    priority = 'normal',
    critical = false,
  } = options;

  return new Promise((resolve, reject) => {
    let retryCount = 0;
    let timeoutId: NodeJS.Timeout;

    const attemptLoad = async () => {
      try {
        // Clear any existing timeout
        if (timeoutId) clearTimeout(timeoutId);

        // Set timeout for this attempt
        timeoutId = setTimeout(() => {
          console.warn(
            `⏰ CSS load timeout: ${cssPath} (attempt ${retryCount + 1})`,
          );

          if (retryCount < retries) {
            retryCount++;
            console.log(
              `🔄 Retrying CSS load: ${cssPath} (${retries - retryCount + 1} attempts left)`,
            );
            attemptLoad();
          } else if (fallbackCSS) {
            console.log(
              `🔄 Loading fallback CSS: ${fallbackCSS} for ${cssPath}`,
            );
            loadCSS(fallbackCSS, {
              caller: `${caller || 'unknown'}(fallback)`,
              priority,
            })
              .then(resolve)
              .catch(reject);
          } else if (critical) {
            reject(
              new Error(
                `Critical CSS failed to load after ${retries + 1} attempts: ${cssPath}`,
              ),
            );
          } else {
            console.warn(
              `⚠️ Non-critical CSS failed to load, continuing: ${cssPath}`,
            );
            resolve(); // Non-critical, continue without CSS
          }
        }, timeout);

        await loadCSS(cssPath, { caller, priority });
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);

        if (retryCount < retries) {
          retryCount++;
          console.log(
            `🔄 Retrying CSS load after error: ${cssPath} (${retries - retryCount + 1} attempts left)`,
          );
          attemptLoad();
        } else if (fallbackCSS) {
          console.log(
            `🔄 Loading fallback CSS after error: ${fallbackCSS} for ${cssPath}`,
          );
          loadCSS(fallbackCSS, {
            caller: `${caller || 'unknown'}(fallback)`,
            priority,
          })
            .then(resolve)
            .catch(reject);
        } else if (critical) {
          reject(error);
        } else {
          console.warn(
            `⚠️ Non-critical CSS failed to load, continuing: ${cssPath}`,
            error,
          );
          resolve(); // Non-critical, continue without CSS
        }
      }
    };

    attemptLoad();
  });
}

/**
 * Preloads CSS files without applying them (for critical resources)
 * @param cssPaths - Array of CSS file paths
 * @param options - Preloading options
 */
export function preloadCSS(
  cssPaths: string[],
  options: {
    priority?: 'high' | 'low';
    caller?: string;
  } = {},
): void {
  const { priority = 'low', caller = 'preload' } = options;

  cssPaths.forEach((path) => {
    // Skip if already loaded or preloaded
    if (loadedStyles.has(path)) return;

    try {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = `/src/styles/${path}`;

      if (priority === 'high') {
        link.setAttribute('fetchpriority', 'high');
      }

      // Add load event to track when preload completes
      link.onload = () => {
        console.debug(
          `📦 CSS preloaded: ${path}${caller ? ` (from ${caller})` : ''}`,
        );
      };

      link.onerror = () => {
        console.warn(
          `⚠️ CSS preload failed: ${path}${caller ? ` (from ${caller})` : ''}`,
        );
      };

      document.head.appendChild(link);
    } catch (error) {
      console.error(`❌ Failed to preload CSS: ${path}`, error);
    }
  });
}

/**
 * Strategic preloading based on current page/route context
 */
export const preloadCriticalStyles = (
  context?: 'lobby' | 'game' | 'character-setup' | 'dm-setup',
) => {
  // Only preload styles that are likely to be needed based on current context
  const preloadMap = {
    lobby: [], // No preloading on lobby - wait for user intent
    game: ['scenes.css', 'dice.css'], // Game interface needs these immediately
    'character-setup': ['character-creation-wizard.css', 'character.css'],
    'dm-setup': ['scenes.css', 'dice.css'], // DM setup leads to game
  };

  const stylesToPreload = preloadMap[context || 'lobby'] || [];
  if (stylesToPreload.length > 0) {
    preloadCSS(stylesToPreload, {
      priority: 'high',
      caller: `critical-preload-${context}`,
    });
  }
};

export const preloadOnUserIntent = (
  intent:
    | 'character-creation'
    | 'scene-editing'
    | 'combat'
    | 'asset-management',
) => {
  const preloadMap = {
    'character-creation': ['character-creation-wizard.css', 'character.css'],
    'scene-editing': ['scenes.css', 'asset-browser.css'],
    combat: ['initiative-tracker.css', 'dice.css'],
    'asset-management': ['assets.css', 'asset-browser.css'],
  };

  const stylesToPreload = preloadMap[intent] || [];
  if (stylesToPreload.length > 0) {
    preloadCSS(stylesToPreload, { caller: `intent-${intent}` });
  }
};

/**
 * Component-specific CSS loading functions
 */

// Component-specific CSS loading functions with enhanced error handling

// Scene-related styles
export const loadSceneStyles = (caller?: string) =>
  loadCSSWithFallback('scenes.css', { caller, priority: 'high' });

// Character-related styles
export const loadCharacterWizardStyles = (caller?: string) =>
  loadCSSWithFallback('character-creation-wizard.css', {
    caller,
    priority: 'critical',
    critical: true,
    timeout: 5000,
    fallbackCSS: 'character.css', // Fallback to basic character styles
  });

export const loadCharacterStyles = (caller?: string) =>
  loadCSSWithFallback('character.css', { caller, priority: 'high' });

// Dice-related styles
export const loadDiceStyles = (caller?: string) =>
  loadCSSWithFallback('dice.css', { caller, priority: 'high' });

// Player panel styles
export const loadPlayerPanelStyles = (caller?: string) =>
  loadCSSWithFallback('player-panel.css', {
    caller,
    priority: 'normal',
    timeout: 3000,
  });

// Initiative tracker styles
export const loadInitiativeStyles = (caller?: string) =>
  loadCSSWithFallback('initiative-tracker.css', { caller, priority: 'normal' });

// Asset browser styles
export const loadAssetStyles = (caller?: string) =>
  Promise.all([
    loadCSSWithFallback('assets.css', { caller, priority: 'normal' }),
    loadCSSWithFallback('asset-browser.css', { caller, priority: 'normal' }),
  ]);

// Chat styles
export const loadChatStyles = (caller?: string) =>
  loadCSSWithFallback('chat.css', { caller, priority: 'normal' });

// Administrative styles (welcome page, offline preparation, etc.)
export const loadAdminStyles = (caller?: string) =>
  Promise.all([
    loadCSSWithFallback('offline-preparation.css', { caller, priority: 'low' }),
    loadCSSWithFallback('welcome-page.css', { caller, priority: 'low' }),
    loadCSSWithFallback('linear-flow.css', { caller, priority: 'low' }),
  ]);

// Utility styles (loaded after initial render)
export const loadUtilityStyles = (caller?: string) =>
  Promise.all([
    loadCSSWithFallback('utilities.css', { caller, priority: 'low' }),
    loadCSSWithFallback('accessibility.css', { caller, priority: 'low' }),
  ]);

// Theme styles with enhanced error handling
export const loadThemeStyles = (
  theme: 'solid' | 'glass' = 'solid',
  caller?: string,
) => {
  if (theme === 'solid') {
    return loadCSSWithFallback('theme-solid.css', {
      caller,
      priority: 'critical',
      critical: true,
      timeout: 3000,
      // No fallback for theme - it should always work
    });
  }
  // Add other themes here as needed
  return Promise.resolve();
};

/**
 * Batch loading for common use cases
 */

// Load styles for main game interface
export const loadGameInterfaceStyles = () =>
  Promise.all([
    loadSceneStyles(),
    loadCharacterStyles(),
    loadDiceStyles(),
    loadPlayerPanelStyles(),
  ]);

// Load styles for asset management
export const loadAssetInterfaceStyles = () =>
  Promise.all([loadAssetStyles(), loadInitiativeStyles(), loadChatStyles()]);

// Load all non-critical styles (for debugging or when performance isn't critical)
export const loadAllStyles = (caller?: string) =>
  Promise.all([
    loadSceneStyles(caller),
    loadCharacterStyles(caller),
    loadDiceStyles(caller),
    loadPlayerPanelStyles(caller),
    loadInitiativeStyles(caller),
    loadAssetStyles(caller),
    loadChatStyles(caller),
    loadAdminStyles(caller),
    loadUtilityStyles(caller),
  ]);

/**
 * Utility functions for monitoring and debugging CSS loading
 */

// Get CSS loading performance statistics
export const getCSSLoadStats = () => cssMonitor.getLoadStats();

// Get detailed metrics for all CSS loads
export const getCSSLoadMetrics = () => cssMonitor.getMetrics();

// Get average load time for a specific CSS file or all files
export const getAverageCSSLoadTime = (cssPath?: string) =>
  cssMonitor.getAverageLoadTime(cssPath);

// Get current queue status
export const getCSSQueueStatus = () => cssQueue.getQueueStatus();

// Log comprehensive CSS loading report to console
export const logCSSLoadingReport = () => {
  const stats = getCSSLoadStats();
  const queueStatus = getCSSQueueStatus();

  console.group('📊 CSS Loading Performance Report');
  console.log(`Total Loads: ${stats.totalLoads}`);
  console.log(`Successful: ${stats.successfulLoads}`);
  console.log(`Failed: ${stats.failedLoads}`);
  console.log(`Average Load Time: ${stats.averageLoadTime.toFixed(2)}ms`);
  console.log(`Fastest Load: ${stats.fastestLoad.toFixed(2)}ms`);
  console.log(`Slowest Load: ${stats.slowestLoad.toFixed(2)}ms`);

  if (queueStatus.queueLength > 0) {
    console.log(
      `Queue Status: ${queueStatus.processing ? 'Processing' : 'Idle'} (${queueStatus.queueLength} items)`,
    );
    console.table(queueStatus.queuedItems);
  }

  console.log('Recent Loads:', stats.recentLoads);
  console.groupEnd();
};
