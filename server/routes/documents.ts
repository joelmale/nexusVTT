import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  DocumentServiceClient,
  DocumentType,
  Document,
} from '../services/documentServiceClient.js';
import { Session } from 'express-session';
import { DatabaseService } from '../database.js';

interface CustomSession extends Session {
  guestUser?: {
    id: string;
    name: string;
    provider: string;
  };
}

const DOCUMENT_ROUTE_PREFIXES = [
  '/documents',
  '/search',
  '/structured-data',
] as const;

function isDocumentRoute(path: string): boolean {
  return (
    path === '/health' ||
    DOCUMENT_ROUTE_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  );
}

/**
 * Helper to check if user is authenticated
 */
function isAuthenticated(req: Request): boolean {
  return req.isAuthenticated() || !!(req.session as CustomSession)?.guestUser;
}

/**
 * Get user ID from session (authenticated or guest)
 */
function getUserId(req: Request): string | null {
  if (req.isAuthenticated()) {
    return (req.user as { id: string })?.id || null;
  }
  return (req.session as CustomSession)?.guestUser?.id || null;
}

/**
 * Create document routes
 * @param documentClient - DocumentServiceClient instance
 * @param documentsEnabled - Whether documents are configured/enabled
 * @param db - DatabaseService instance
 */
export function createDocumentRoutes(
  documentClient: DocumentServiceClient | null,
  documentsEnabled: boolean,
  db: DatabaseService,
): Router {
  const router = Router();

  /**
   * Short-circuit if the document service is disabled or not configured
   */
  router.use((req, res, next) => {
    if (!documentsEnabled || !documentClient) {
      if (req.path === '/health') {
        return res.json({ status: 'disabled' });
      }
      if (isDocumentRoute(req.path)) {
        return res.status(503).json({
          error: 'Document service unavailable',
          details:
            'DOC_API_URL not configured or NexusCodex services are offline',
        });
      }
    }
    return next();
  });

  // Document service client is guaranteed to exist past this point
  const client = documentClient as DocumentServiceClient;

  /**
   * Helper to verify if a user has access to a specific document based on public status,
   * ownership, or campaign participation.
   */
  async function hasDocumentAccess(
    userId: string,
    document: Document,
  ): Promise<boolean> {
    if (document.isPublic || document.uploadedBy === userId) {
      return true;
    }
    if (document.campaigns && Array.isArray(document.campaigns)) {
      for (const campaignId of document.campaigns) {
        if (await db.isUserAuthorizedForCampaign(userId, campaignId)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * GET /api/documents/ws-token - Generate signed JWT token for document WebSocket sync
   */
  router.get('/documents/ws-token', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Generate a signed JWT token using the VTT server's JWT_SECRET
      const jwtSecret =
        process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
      const token = jwt.sign({ userId }, jwtSecret, { expiresIn: '1h' });

      return res.json({ token });
    } catch (error) {
      console.error('Failed to generate ws token:', error);
      return res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  /**
   * POST /api/documents - Create document and get signed upload URL
   * Requires authentication and campaign authorization
   */
  router.post('/documents', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Verify campaign authorization for any campaigns specified in the request body
      const campaigns = req.body.campaigns;
      if (campaigns && Array.isArray(campaigns)) {
        for (const campaignId of campaigns) {
          const authorized = await db.isUserAuthorizedForCampaign(
            userId,
            campaignId,
          );
          if (!authorized) {
            return res.status(403).json({
              error: `Access denied: not authorized for campaign ${campaignId}`,
            });
          }
        }
      }

      const result = await client.createDocument(req.body, userId);
      return res.status(201).json(result);
    } catch (error: unknown) {
      console.error('Failed to create document:', error);
      return res.status(400).json({
        error: 'Failed to create document',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents - List documents with filtering and campaign access verification
   * Requires authentication
   */
  router.get('/documents', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const campaign = req.query.campaign as string | undefined;
      if (campaign) {
        const authorized = await db.isUserAuthorizedForCampaign(
          userId,
          campaign,
        );
        if (!authorized) {
          return res.status(403).json({
            error: 'Access denied: not authorized for campaign',
          });
        }
      }

      const params = {
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
        type: req.query.type as DocumentType | undefined,
        campaign: campaign,
        tag: req.query.tag as string,
        search: req.query.search as string,
      };

      const result = await client.listDocuments(params);

      // Post-filter documents to prevent BOLA and leaks
      const filteredDocuments = [];
      for (const doc of result.documents) {
        if (await hasDocumentAccess(userId, doc)) {
          filteredDocuments.push(doc);
        }
      }

      result.documents = filteredDocuments;
      result.pagination.total = filteredDocuments.length;

      return res.json(result);
    } catch (error: unknown) {
      console.error('Failed to list documents:', error);
      return res.status(400).json({
        error: 'Failed to list documents',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents/:id - Get document metadata with authorization check
   * Requires authentication and document access
   */
  router.get('/documents/:id', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const document = await client.getDocument(String(req.params.id));

      // Verify authorization
      if (!(await hasDocumentAccess(userId, document))) {
        return res.status(403).json({
          error: 'Access denied: not authorized to view document',
        });
      }

      return res.json(document);
    } catch (error: unknown) {
      console.error('Failed to get document:', error);
      if ((error as Error).message.includes('not found')) {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.status(500).json({
        error: 'Failed to get document',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents/:id/content - Get document content URL with authorization check
   * Requires authentication
   */
  router.get('/documents/:id/content', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Verify existence and authorization
      const document = await client.getDocument(String(req.params.id));
      if (!(await hasDocumentAccess(userId, document))) {
        return res.status(403).json({
          error: 'Access denied: not authorized to view document',
        });
      }

      // Return the content URL for the frontend to fetch
      const contentUrl = client.getDocumentContentUrl(String(req.params.id));
      return res.json({ contentUrl });
    } catch (error: unknown) {
      console.error('Failed to get document content:', error);
      if ((error as Error).message.includes('not found')) {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.status(500).json({
        error: 'Failed to get document content',
        details: (error as Error).message,
      });
    }
  });

  /**
   * PUT /api/documents/:id - Update document metadata (Owner only)
   * Requires authentication and ownership
   */
  router.put('/documents/:id', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Verify ownership
      const document = await client.getDocument(String(req.params.id));
      if (document.uploadedBy !== userId) {
        return res.status(403).json({
          error: 'Access denied: only the owner can update this document',
        });
      }

      // Verify campaign authorization for any new campaigns specified in updates
      const campaigns = req.body.campaigns;
      if (campaigns && Array.isArray(campaigns)) {
        for (const campaignId of campaigns) {
          const authorized = await db.isUserAuthorizedForCampaign(
            userId,
            campaignId,
          );
          if (!authorized) {
            return res.status(403).json({
              error: `Access denied: not authorized for campaign ${campaignId}`,
            });
          }
        }
      }

      const updated = await client.updateDocument(
        String(req.params.id),
        req.body,
      );
      return res.json(updated);
    } catch (error: unknown) {
      console.error('Failed to update document:', error);
      if ((error as Error).message.includes('not found')) {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.status(400).json({
        error: 'Failed to update document',
        details: (error as Error).message,
      });
    }
  });

  /**
   * DELETE /api/documents/:id - Delete document (Owner only)
   * Requires authentication and ownership
   */
  router.delete('/documents/:id', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Verify ownership
      const document = await client.getDocument(String(req.params.id));
      if (document.uploadedBy !== userId) {
        return res.status(403).json({
          error: 'Access denied: only the owner can delete this document',
        });
      }

      await client.deleteDocument(String(req.params.id));
      return res.status(204).send();
    } catch (error: unknown) {
      console.error('Failed to delete document:', error);
      if ((error as Error).message.includes('not found')) {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.status(500).json({
        error: 'Failed to delete document',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents/search - Full-text search across documents (With Access Filtering)
   * Requires authentication
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const params = {
        query,
        type: req.query.type as DocumentType | undefined,
        campaigns: req.query.campaigns
          ? (req.query.campaigns as string).split(',')
          : undefined,
        tags: req.query.tags
          ? (req.query.tags as string).split(',')
          : undefined,
        from: req.query.from ? parseInt(req.query.from as string) : undefined,
        size: req.query.size ? parseInt(req.query.size as string) : undefined,
      };

      // Verify campaign authorization for any campaigns specified in search
      if (params.campaigns) {
        for (const campaignId of params.campaigns) {
          const authorized = await db.isUserAuthorizedForCampaign(
            userId,
            campaignId,
          );
          if (!authorized) {
            return res.status(403).json({
              error: `Access denied: not authorized for campaign ${campaignId}`,
            });
          }
        }
      }

      const result = await client.searchDocuments(params);

      // Post-filter search results to ensure user is authorized
      const filteredResults = [];
      for (const resItem of result.results) {
        try {
          const doc = await client.getDocument(resItem.documentId);
          if (await hasDocumentAccess(userId, doc)) {
            filteredResults.push(resItem);
          }
        } catch {
          // Exclude document if we fail to fetch or verify it
        }
      }

      result.results = filteredResults;
      result.total = filteredResults.length;

      return res.json(result);
    } catch (error: unknown) {
      console.error('Failed to search documents:', error);
      return res.status(400).json({
        error: 'Search failed',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents/search/quick - Quick search for top results (With Access Filtering)
   * Requires authentication
   */
  router.get('/search/quick', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const campaign = req.query.campaign as string | undefined;
      if (campaign) {
        const authorized = await db.isUserAuthorizedForCampaign(
          userId,
          campaign,
        );
        if (!authorized) {
          return res.status(403).json({
            error: `Access denied: not authorized for campaign ${campaign}`,
          });
        }
      }

      const size = req.query.size ? parseInt(req.query.size as string) : 5;
      const result = await client.quickSearch(query, campaign, size);

      // Post-filter quick search results
      const filteredResults = [];
      for (const resItem of result.results) {
        try {
          const doc = await client.getDocument(resItem.documentId);
          if (await hasDocumentAccess(userId, doc)) {
            filteredResults.push(resItem);
          }
        } catch {
          // Exclude if failed to fetch/verify
        }
      }

      result.results = filteredResults;

      return res.json(result);
    } catch (error: unknown) {
      console.error('Failed to quick search:', error);
      return res.status(400).json({
        error: 'Quick search failed',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents/search/semantic - Hybrid semantic search across document chunks (With Access Filtering)
   * Requires authentication
   */
  router.get('/search/semantic', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const params = {
        query,
        type: req.query.type as DocumentType | undefined,
        campaigns: req.query.campaigns
          ? (req.query.campaigns as string).split(',')
          : undefined,
        tags: req.query.tags
          ? (req.query.tags as string).split(',')
          : undefined,
        topK: req.query.topK ? parseInt(req.query.topK as string) : undefined,
      };

      // Verify campaign authorization for any campaigns specified in search
      if (params.campaigns) {
        for (const campaignId of params.campaigns) {
          const authorized = await db.isUserAuthorizedForCampaign(
            userId,
            campaignId,
          );
          if (!authorized) {
            return res.status(403).json({
              error: `Access denied: not authorized for campaign ${campaignId}`,
            });
          }
        }
      }

      const result = await client.semanticSearch(params);

      // Post-filter search results to ensure user is authorized
      const filteredResults = [];
      for (const resItem of result.results) {
        try {
          const doc = await client.getDocument(resItem.documentId);
          if (await hasDocumentAccess(userId, doc)) {
            filteredResults.push(resItem);
          }
        } catch {
          // Exclude document if we fail to fetch or verify it
        }
      }

      result.results = filteredResults;
      result.total = filteredResults.length;

      return res.json(result);
    } catch (error: unknown) {
      console.error('Failed to semantic search documents:', error);
      return res.status(400).json({
        error: 'Semantic search failed',
        details: (error as Error).message,
      });
    }
  });

  /**
   * POST /api/documents/search/ask - Grounded Q&A search using document chunks (With Access Filtering)
   * Requires authentication
   */
  router.post('/search/ask', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const { question, type, campaigns, tags, topK } = req.body;
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      // Verify campaign authorization for any campaigns specified
      if (campaigns && Array.isArray(campaigns)) {
        for (const campaignId of campaigns) {
          const authorized = await db.isUserAuthorizedForCampaign(
            userId,
            campaignId,
          );
          if (!authorized) {
            return res.status(403).json({
              error: `Access denied: not authorized for campaign ${campaignId}`,
            });
          }
        }
      }

      const result = await client.ask(question, {
        type,
        campaigns,
        tags,
        topK,
      });

      // Post-filter citations & corresponding snippets to ensure user is authorized
      const filteredCitations = [];
      const filteredSnippets = [];

      for (let i = 0; i < result.citations.length; i++) {
        const citation = result.citations[i];
        try {
          const doc = await client.getDocument(citation.documentId);
          if (await hasDocumentAccess(userId, doc)) {
            filteredCitations.push(citation);
            if (result.snippets[i] !== undefined) {
              filteredSnippets.push(result.snippets[i]);
            }
          }
        } catch {
          // Exclude citation and snippet if we fail to fetch or verify
        }
      }

      result.citations = filteredCitations;
      result.snippets = filteredSnippets;

      // Adjust index pointers in citations after filtering
      result.citations.forEach((c, idx) => {
        c.sourceIndex = idx + 1;
      });

      return res.json(result);
    } catch (error: unknown) {
      console.error('Failed to answer question:', error);
      return res.status(400).json({
        error: 'Failed to answer question',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents/:id/structured-data - Get all structured data for a document
   * Requires authentication
   */
  router.get('/:id/structured-data', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const documentId = String(req.params.id);
      // Authorize document access first
      const doc = await client.getDocument(documentId);
      if (!(await hasDocumentAccess(userId, doc))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const type = req.query.type as string | undefined;
      const name = req.query.name as string | undefined;

      const data = await client.getDocumentStructuredData(documentId, {
        type,
        name,
      });
      return res.json(data);
    } catch (error: unknown) {
      console.error('Failed to get document structured data:', error);
      return res.status(400).json({
        error: 'Failed to get document structured data',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/structured-data/:id - Get specific structured data entry by ID
   * Requires authentication
   */
  router.get('/structured-data/:id', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const dataId = String(req.params.id);
      const entry = await client.getStructuredDataById(dataId);

      // Authorize document access linked to the entry
      const doc = await client.getDocument(entry.documentId);
      if (!(await hasDocumentAccess(userId, doc))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json(entry);
    } catch (error: unknown) {
      console.error('Failed to get structured data entry:', error);
      return res.status(400).json({
        error: 'Failed to get structured data entry',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/structured-data - List structured data with filtering
   * Requires authentication
   */
  router.get('/structured-data', async (req: Request, res: Response) => {
    try {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const params = {
        documentId: req.query.documentId as string | undefined,
        type: req.query.type as string | undefined,
        name: req.query.name as string | undefined,
        search: req.query.search as string | undefined,
        limit: req.query.limit as string | undefined,
        offset: req.query.offset as string | undefined,
      };

      // If filtering by documentId, check authorization
      if (params.documentId) {
        const doc = await client.getDocument(params.documentId);
        if (!(await hasDocumentAccess(userId, doc))) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const data = await client.listStructuredData(params);

      // Post-filter list to ensure user is authorized to view each document
      const filtered = [];
      for (const item of data) {
        try {
          const doc = await client.getDocument(item.documentId);
          if (await hasDocumentAccess(userId, doc)) {
            filtered.push(item);
          }
        } catch {
          // Skip if doc fetch/verify fails
        }
      }

      return res.json(filtered);
    } catch (error: unknown) {
      console.error('Failed to list structured data:', error);
      return res.status(400).json({
        error: 'Failed to list structured data',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/documents/health - Health check for document service
   * Does not require authentication
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await client.healthCheck();
      return res.json(health);
    } catch (error: unknown) {
      console.error('Document service health check failed:', error);
      return res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
      });
    }
  });

  return router;
}
