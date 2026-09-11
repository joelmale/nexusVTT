import Redis from 'ioredis';
import { env } from '../config/env';

class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<string | null> {
    return this.client.get(`session:${sessionId}`);
  }

  /**
   * Save a session with TTL
   */
  async setSession(sessionId: string, data: string): Promise<void> {
    await this.client.setex(`session:${sessionId}`, env.SESSION_TTL, data);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  /**
   * Refresh session TTL (extend expiry)
   */
  async refreshSession(sessionId: string): Promise<void> {
    await this.client.expire(`session:${sessionId}`, env.SESSION_TTL);
  }

  /**
   * Get all active session IDs
   */
  async getAllSessionIds(): Promise<string[]> {
    const keys = await this.client.keys('session:*');
    return keys.map((key) => key.replace('session:', ''));
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }
}

export const redisService = new RedisService();
