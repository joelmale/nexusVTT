import Fastify from 'fastify';
import { documentRoutes } from '../routes/documents';
import { prisma } from '../services/database.service';

describe('Document Routes Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    await app.register(documentRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /api/documents', () => {
    it('should return list of documents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents',
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it('should filter by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?type=rulebook',
      });

      expect(response.statusCode).toBe(200);
      const documents = response.json();
      documents.forEach((doc: any) => {
        expect(doc.type).toBe('rulebook');
      });
    });

    it('should filter by campaign', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?campaign=test-campaign',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should search by query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?search=test',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should respect limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?limit=5',
      });

      expect(response.statusCode).toBe(200);
      const documents = response.json();
      expect(documents.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error');
    });

    it('should return document details when found', async () => {
      // This test would need a valid document ID from setup
      // Skipping actual implementation for example purposes
    });
  });

  describe('POST /api/documents', () => {
    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid file types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {
          title: 'Test Document',
          type: 'rulebook',
          // Invalid file data
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/documents/non-existent-id',
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate update payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/documents/some-id',
        payload: {
          type: 'invalid-type', // Invalid enum value
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/documents/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/documents/:id/download', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/non-existent-id/download',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return pre-signed URL for valid document', async () => {
      // This test would need a valid document ID from setup
      // Skipping actual implementation for example purposes
    });
  });
});
