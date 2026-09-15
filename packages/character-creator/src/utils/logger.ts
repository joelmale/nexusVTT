import loglevel from 'loglevel';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const allowedLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];

const coerceLevel = (rawLevel: string | undefined, fallback: LogLevel): LogLevel => {
  if (rawLevel && allowedLevels.includes(rawLevel as LogLevel)) {
    return rawLevel as LogLevel;
  }
  return fallback;
};

const isEnabled = () => {
  const flag = import.meta.env.VITE_ENABLE_LOGS;
  // Default to enabled unless explicitly false/0
  return !(flag === 'false' || flag === '0');
};

const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined; // Vite injects env via import.meta
const defaultLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';
const level: LogLevel = isEnabled() ? coerceLevel(envLevel, defaultLevel) : 'silent';

const baseLogger = loglevel.getLogger('nexus-forge');
baseLogger.setLevel(level, false); // Do not persist to localStorage; controlled via env

const formatMeta = (meta?: Record<string, unknown>) => {
  if (!meta || !Object.keys(meta).length) return '';
  try {
    return JSON.stringify(meta);
  } catch (err) {
    baseLogger.warn('Failed to stringify logger meta', err);
    return '';
  }
};

const createLogger = (baseMeta: Record<string, unknown> = {}) => {
  const mergeMeta = (meta?: Record<string, unknown>) => ({ ...baseMeta, ...(meta || {}) });

  const emit = (logLevel: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>) => {
    const mergedMeta = mergeMeta(meta);
    const metaString = formatMeta(mergedMeta);
    const output = `[${new Date().toISOString()}] ${message}${metaString ? ` ${metaString}` : ''}`;

    baseLogger[logLevel](output);
  };

  return {
    error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
    debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
    trace: (message: string, meta?: Record<string, unknown>) => emit('trace', message, meta),
    setLevel: (newLevel: LogLevel) => baseLogger.setLevel(coerceLevel(newLevel, level), false),
    child: (meta: Record<string, unknown>) => createLogger(mergeMeta(meta)),
  };
};

// Thin wrapper for consistent imports
export const log = createLogger({
  app: 'nexus-forge',
  env: import.meta.env.MODE,
});

export type Logger = typeof log;
