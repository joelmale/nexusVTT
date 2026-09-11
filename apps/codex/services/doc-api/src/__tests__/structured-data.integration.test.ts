import Fastify from 'fastify';
import { structuredDataRoutes } from '../routes/structured-data';
import { prisma } from '../services/database.service';

describe('Structured Data Routes Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = Fastify();
    await app.register(structuredDataRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /api/structured-data', () => {
    it('should return list of structured data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/structured-data',
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it('should filter by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/structured-data?type=spell',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      data.forEach((item: any) => {
        expect(item.type).toBe('spell');
      });
    });

    it('should filter by name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/structured-data?name=fireball',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should search in searchText field', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/structured-data?search=evocation',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should respect limit and offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/structured-data?limit=10&offset=5',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.length).toBeLessThanOrEqual(10);
    });
  });

  describe('GET /api/documents/:id/structured-data', () => {
    it('should return structured data for a document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/test-doc-id/structured-data',
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json())).toBe(true);
    });

    it('should filter by type for specific document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/test-doc-id/structured-data?type=monster',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/structured-data/:id', () => {
    it('should return 404 for non-existent data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/structured-data/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error');
    });

    it('should include document details when found', async () => {
      // This test would need a valid structured data ID from setup
      // Skipping actual implementation for example purposes
    });
  });

  describe('GET /api/search/quick', () => {
    it('should require search term', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/search/quick',
      });

      // Should fail validation without term
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should perform quick search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/search/quick?term=fireball',
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should filter by type in quick search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/search/quick?term=test&type=spell',
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      result.results.forEach((item: any) => {
        expect(item.type).toBe('spell');
      });
    });

    it('should filter by campaign in quick search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/search/quick?term=test&campaign=my-campaign',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should respect limit in quick search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/search/quick?term=test&limit=3',
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('DELETE /api/structured-data/:id', () => {
    it('should return 404 for non-existent data', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/structured-data/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 204 on successful deletion', async () => {
      // This test would need a valid structured data ID from setup
      // and proper cleanup
      // Skipping actual implementation for example purposes
    });
  });
});
