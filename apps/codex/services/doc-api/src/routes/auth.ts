import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService, LoginSchema, RegisterSchema } from '../services/auth.service';

const LoginBodySchema = LoginSchema;
const RegisterBodySchema = RegisterSchema;

const RefreshTokenBodySchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register new user
  fastify.post('/auth/register', {
    handler: async (request, reply) => {
      const userData = request.body as z.infer<typeof RegisterBodySchema>;

      try {
        const user = await AuthService.register(userData);
        const tokens = AuthService.generateTokens(user);

        return reply.code(201).send({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            createdAt: user.createdAt,
          },
          tokens,
        });
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    },
  });

  // Login
  fastify.post('/auth/login', {
    handler: async (request, reply) => {
      const credentials = request.body as z.infer<typeof LoginBodySchema>;

      try {
        const { user, tokens } = await AuthService.login(credentials);

        return {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            lastLoginAt: user.lastLoginAt,
          },
          tokens,
        };
      } catch (error) {
        return reply.code(401).send({ error: (error as Error).message });
      }
    },
  });

  // Refresh token
  fastify.post('/auth/refresh', {
    handler: async (request, reply) => {
      const { refreshToken } = request.body as z.infer<typeof RefreshTokenBodySchema>;

      try {
        const tokens = await AuthService.refreshToken(refreshToken);
        return tokens;
      } catch (error) {
        return reply.code(401).send({ error: 'Invalid refresh token' });
      }
    },
  });

  // Get current user profile
  fastify.get('/auth/me', {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const { userId } = request.user as { userId: string };

      const user = await AuthService.getUserById(userId);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return user;
    },
  });

  // Logout (client-side token removal, no server-side action needed)
  fastify.post('/auth/logout', async () => {
    return { message: 'Logged out successfully' };
  });
}