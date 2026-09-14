import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

// Extend FastifyInstance to include our decorators
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}
import { env } from './config/env';
import { documentRoutes } from './routes/documents';
import { processingRoutes } from './routes/processing';
import { searchRoutes } from './routes/search';
import { referenceRoutes } from './routes/references';
import { annotationRoutes } from './routes/annotations';
import { structuredDataRoutes } from './routes/structured-data';
import { authRoutes } from './routes/auth';
import { adminDocumentRoutes } from './routes/admin/documents';
import { adminQueueRoutes } from './routes/admin/queue';
import { adminSearchRoutes } from './routes/admin/search';
import { adminDuplicatesRoutes } from './routes/admin/duplicates';
import { adminTagRoutes } from './routes/admin/tags';
import { adminValidationRoutes } from './routes/admin/validation';
import { usersRoutes as adminUserRoutes } from './routes/admin/users';
import { elasticsearchRoutes } from './routes/admin/elasticsearch';
import { healthRoutes } from './routes/admin/health';
import { adminProcessingRoutes } from './routes/admin/processing';
import { adminLogsRoutes } from './routes/admin/logs';
import { vttRoutes } from './routes/vtt';
import { s3Service } from './services/s3.service';
import { prisma } from './services/database.service';
import { AlertsService } from './services/alerts.service';
import { loggingService } from './services/logging.service';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

// Register CORS
fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
});

// Register JWT
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key',
});

// Authentication decorator
fastify.decorate('authenticate', async (request: any, reply: any) => {
  if (env.AUTH_DISABLED) {
    return;
  }
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Admin authorization decorator - DISABLED for development
// fastify.decorate('requireAdmin', async (request: any, reply: any) => {
//   try {
//     await request.jwtVerify();
//     const { role } = request.user;
//     if (role !== 'admin') {
//       return reply.code(403).send({ error: 'Admin access required' });
//     }
//   } catch (err) {
//     reply.code(401).send({ error: 'Unauthorized' });
//   }
// });

// Health check endpoint
fastify.get('/', async () => {
  return {
    service: 'Nexus VTT Document API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  };
});

// Health check with database connection
fastify.get('/health', async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(503).send({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Register routes
fastify.register(documentRoutes);
fastify.register(processingRoutes);
fastify.register(searchRoutes);
fastify.register(referenceRoutes);
fastify.register(annotationRoutes);
fastify.register(structuredDataRoutes);
fastify.register(authRoutes);
fastify.register(adminDocumentRoutes);
fastify.register(adminQueueRoutes);
fastify.register(adminSearchRoutes);
fastify.register(adminDuplicatesRoutes);
fastify.register(adminTagRoutes);
fastify.register(adminValidationRoutes);
fastify.register(adminUserRoutes);
fastify.register(elasticsearchRoutes);
fastify.register(healthRoutes);
fastify.register(adminProcessingRoutes);
fastify.register(adminLogsRoutes);
fastify.register(vttRoutes);

fastify.addHook('onError', async (request, _reply, error) => {
  loggingService.log('error', error.message, {
    method: request.method,
    url: request.url,
  }, request.id).catch(() => {});
});

fastify.addHook('onResponse', async (request, reply) => {
  const statusCode = reply.statusCode;
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  loggingService.log(level, 'http_request', {
    method: request.method,
    url: request.url,
    statusCode,
  }, request.id).catch(() => {});
});

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`);
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  });
});

// Start server
const start = async () => {
  try {
    // Initialize S3 bucket
    fastify.log.info('Initializing S3 bucket...');
    await s3Service.initializeBucket();

    // Initialize alert rules
    fastify.log.info('Initializing alert rules...');
    await AlertsService.initializeRules();

    // Start server
    await fastify.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    fastify.log.info(`Server running on http://0.0.0.0:${env.PORT}`);
    fastify.log.info(`Environment: ${env.NODE_ENV}`);
    await loggingService.log('info', 'doc-api started', { port: env.PORT });
  } catch (err) {
    fastify.log.error(err);
    await loggingService.log('critical', 'doc-api failed to start', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  }
};

start();
