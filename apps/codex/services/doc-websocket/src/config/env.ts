import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string(),
  SESSION_TTL: z.string().default('86400').transform(Number), // 24 hours in seconds

  // Auth: required, with no default, so a missing secret fails startup
  // instead of silently accepting tokens signed with a well-known key.
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),

  // Logging
  LOGGING_ENABLED: z.string().default('true').transform(val => val === 'true'),
  LOGGING_SERVICE_NAME: z.string().default('doc-websocket'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
