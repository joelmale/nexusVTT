import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
process.env.REDIS_URL ??= `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`;
