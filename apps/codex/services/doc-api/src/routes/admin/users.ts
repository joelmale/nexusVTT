import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../../services/auth.service';
import { AdminListUsersQuerySchema, AdminCreateUserSchema, AdminUpdateUserSchema } from '../../types/admin';



export async function usersRoutes(fastify: FastifyInstance) {
  // List users
  fastify.get('/api/admin/users', async (request) => {
    const { skip, take, search, role, isActive } = request.query as z.infer<typeof AdminListUsersQuerySchema>;

    const result = await AuthService.listUsers({
      skip,
      take,
      search,
      role,
      isActive,
    });

    return {
      ...result,
      skip,
      take,
    };
  });

  // Get user by ID
  fastify.get('/api/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await AuthService.getUserById(id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return user;
  });

  // Create user
  fastify.post('/api/admin/users', async (request, reply) => {
    const userData = request.body as z.infer<typeof AdminCreateUserSchema>;

    try {
      const user = await AuthService.register(userData);
      return reply.code(201).send(user);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  // Update user
  fastify.patch('/api/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updateData = request.body as z.infer<typeof AdminUpdateUserSchema>;

    try {
      const user = await AuthService.updateUser(id, updateData);
      return user;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  // Delete user
  fastify.delete('/api/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await AuthService.deleteUser(id);
      return reply.code(204).send();
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });
}