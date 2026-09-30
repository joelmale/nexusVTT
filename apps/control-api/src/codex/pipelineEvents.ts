import { Redis } from 'ioredis';
import type { Logger } from '../logger.js';

/**
 * Live "doorbell" for the ingestion pipeline's processing events.
 *
 * doc-processor stores every event in PostgreSQL and then publishes it on
 * `codex:pipeline:events:<documentId>`. control-api only uses the publish as a
 * wake-up for open streams: the stream then reads the next events from doc-api
 * by id cursor, so ordering, replay and reconnects never depend on Redis
 * delivering every message.
 */
export interface PipelineEvents {
  /** Calls `onEvent` whenever an event for `documentId` is published. Returns an unsubscribe function. */
  subscribe(documentId: string, onEvent: () => void): () => void;
  close(): Promise<void>;
}

export const PIPELINE_CHANNEL_PREFIX = 'codex:pipeline:events:';

export function createRedisPipelineEvents(redisUrl: string, logger: Logger): PipelineEvents {
  const listeners = new Map<string, Set<() => void>>();
  const subscriber = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: null });

  subscriber.on('error', (error: Error) => logger.warn('pipeline events: Redis error', { error: error.message }));
  subscriber.on('pmessage', (_pattern: string, channel: string) => {
    const documentId = channel.slice(PIPELINE_CHANNEL_PREFIX.length);
    for (const listener of listeners.get(documentId) ?? []) listener();
  });
  subscriber.psubscribe(`${PIPELINE_CHANNEL_PREFIX}*`).catch((error: Error) => {
    logger.warn('pipeline events: psubscribe failed; streams fall back to polling', { error: error.message });
  });

  return {
    subscribe(documentId, onEvent) {
      const set = listeners.get(documentId) ?? new Set();
      set.add(onEvent);
      listeners.set(documentId, set);
      return () => {
        set.delete(onEvent);
        if (set.size === 0) listeners.delete(documentId);
      };
    },
    async close() {
      listeners.clear();
      await subscriber.quit().catch(() => undefined);
    },
  };
}

/** In-process bus for tests. */
export function createMemoryPipelineEvents(): PipelineEvents & { publish(documentId: string): void } {
  const listeners = new Map<string, Set<() => void>>();
  return {
    subscribe(documentId, onEvent) {
      const set = listeners.get(documentId) ?? new Set();
      set.add(onEvent);
      listeners.set(documentId, set);
      return () => set.delete(onEvent);
    },
    publish(documentId) {
      for (const listener of listeners.get(documentId) ?? []) listener();
    },
    async close() {
      listeners.clear();
    },
  };
}
