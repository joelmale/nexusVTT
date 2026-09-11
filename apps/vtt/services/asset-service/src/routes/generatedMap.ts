import type { Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Reusing same storage configuration as main app
const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB for generated maps
  storage: multer.memoryStorage(),
});

function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  const files = fs.readdirSync(dirPath);
  let size = 0;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += stat.size;
    }
  }
  return size;
}

const USER_QUOTA_BYTES = 100 * 1024 * 1024; // 100MB for generated maps (larger)

export function setupGeneratedMapRoute(
  app: import('express').Application,
  requireNexusAuth: import('express').RequestHandler,
  assetsPath: string
) {
  app.post(
    '/user/:userId/generated-map',
    requireNexusAuth,
    upload.single('file'),
    async (req: Request, res: Response) => {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      if (!userId || !/^[a-zA-Z0-9-]+$/.test(userId)) {
        return res.status(400).json({ error: 'Invalid userId' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const importId = req.body.importId;
      if (!importId) {
        return res.status(400).json({ error: 'Missing importId' });
      }

      const userDir = path.join(assetsPath, 'users', userId);
      const generatedMapsDir = path.join(userDir, 'generated');
      const currentSize = getDirSize(userDir);

      if (currentSize + req.file.size > USER_QUOTA_BYTES) {
        return res.status(413).json({ error: 'Quota exceeded' });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const mime = req.file.mimetype;

      if (mime === 'image/svg+xml') {
        const svgContent = req.file.buffer.toString('utf-8');
        
        // SVG Admission Policy
        if (
          svgContent.includes('<!DOCTYPE') ||
          svgContent.includes('<script') ||
          svgContent.includes('<foreignObject') ||
          /on[a-z]+=/i.test(svgContent) || // Event attributes
          /href\s*=/i.test(svgContent) || // External links
          /url\(["']?http/i.test(svgContent) // Remote URLs
        ) {
          return res.status(400).json({ error: 'Invalid SVG content. Scripts, external links, and foreignObjects are prohibited.' });
        }
      } else if (!['.webp', '.png'].includes(ext)) {
        return res.status(400).json({ error: 'Invalid file type. Only SVG, WebP, and PNG are allowed.' });
      }

      const assetId = crypto.randomUUID();
      const filename = `${assetId}${ext}`;
      const filePath = path.join(generatedMapsDir, filename);

      if (!fs.existsSync(generatedMapsDir)) {
        fs.mkdirSync(generatedMapsDir, { recursive: true });
      }

      fs.writeFileSync(filePath, req.file.buffer);

      const mapResponse = {
        importId,
        assetId,
        sceneUrl: `/users/${userId}/generated/${filename}`,
        thumbnailUrl: `/users/${userId}/generated/${filename}`,
        mimeType: mime,
        width: Number(req.body.width) || 4096,
        height: Number(req.body.height) || 4096,
        byteLength: req.file.size,
        contentHash: crypto.createHash('sha256').update(req.file.buffer).digest('hex')
      };

      res.json(mapResponse);
    }
  );
}
