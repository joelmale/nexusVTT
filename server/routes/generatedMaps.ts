import type { Request, Response, Application } from 'express';
import multer from 'multer';

const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  storage: multer.memoryStorage(),
});

export function setupGeneratedMapsRoute(app: Application, requireAuthenticatedNonGuest: any) {
  app.post(
    '/api/generated-maps',
    requireAuthenticatedNonGuest,
    upload.single('file'),
    async (req: Request, res: Response) => {
      try {
        const session = req.session as any;
        const userId = session.passport?.user?.id;
        
        if (!userId) {
          return res.status(401).json({ error: 'User ID not found in session' });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file provided' });
        }

        const formData = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);
        
        if (req.body.importId) formData.append('importId', req.body.importId);
        if (req.body.width) formData.append('width', req.body.width);
        if (req.body.height) formData.append('height', req.body.height);

        const assetServiceUrl = process.env.ASSET_SERVICE_URL || 'http://localhost:5003';
        const response = await fetch(`${assetServiceUrl}/user/${userId}/generated-map`, {
          method: 'POST',
          headers: {
            'x-nexus-auth': process.env.ASSET_SERVICE_SECRET || 'dev-secret-key-123',
          },
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Asset service rejected upload: ${text}`);
        }

        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error('Generated map upload failed:', error);
        res.status(500).json({ error: 'Failed to upload generated map' });
      }
    }
  );
}
