import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../services/dbService';
import { ffmpegService } from '../services/ffmpegService';
import { MediaFileMetadata } from '../types';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

export const uploadController = {
  async handleUpload(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileId = `file_${uuidv4()}`;
      const filePath = req.file.path;
      const mimeType = req.file.mimetype;
      const isImage = mimeType.startsWith('image/');

      let meta: Partial<MediaFileMetadata> = {
        duration: isImage ? 5 : 5,
        width: 1920,
        height: 1080,
        hasAudio: !isImage
      };

      if (!isImage) {
        try {
          const probed = await ffmpegService.getMediaMetadata(filePath);
          meta = { ...meta, ...probed };
        } catch (err) {
          console.warn(`[Probe Warning] Could not probe ${req.file.originalname}, using default metadata`, err);
        }
      }

      let thumbnailPath: string | undefined = undefined;
      if (mimeType.startsWith('video/')) {
        const thumbFilename = `thumb_${fileId}.jpg`;
        const thumbFullPath = path.join(UPLOAD_DIR, thumbFilename);
        try {
          await ffmpegService.generateThumbnail(filePath, thumbFullPath);
          thumbnailPath = thumbFullPath;
        } catch (thumbErr) {
          console.warn('[Thumbnail Warning] Failed to generate thumbnail snapshot:', thumbErr);
        }
      } else if (isImage) {
        thumbnailPath = filePath;
      }

      const mediaRecord: MediaFileMetadata = {
        id: fileId,
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: filePath,
        mimeType: mimeType,
        size: req.file.size,
        duration: meta.duration || 5,
        width: meta.width || 1920,
        height: meta.height || 1080,
        fps: meta.fps || 30,
        resolution: meta.resolution || `${meta.width || 1920}x${meta.height || 1080}`,
        hasAudio: meta.hasAudio !== undefined ? meta.hasAudio : !isImage,
        thumbnailPath: thumbnailPath,
        createdAt: new Date().toISOString()
      };

      await dbService.saveMediaFile(mediaRecord);

      return res.status(201).json({
        message: 'File uploaded successfully',
        file: {
          ...mediaRecord,
          thumbnailUrl: `/api/thumbnail/${fileId}`,
          streamUrl: `/api/uploads/${fileId}`
        }
      });
    } catch (error: any) {
      console.error('[Upload Controller Error]', error);
      return res.status(500).json({ error: error.message || 'File upload failed' });
    }
  },

  async getAllUploads(req: Request, res: Response) {
    const files = await dbService.getAllMediaFiles();
    const result = files.map(f => ({
      ...f,
      thumbnailUrl: `/api/thumbnail/${f.id}`,
      streamUrl: `/api/uploads/${f.id}`
    }));
    return res.json({ files: result });
  },

  async getThumbnail(req: Request, res: Response) {
    const fileId = req.params.fileId;
    const fileRecord = await dbService.getMediaFile(fileId);

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fileRecord.thumbnailPath && fs.existsSync(fileRecord.thumbnailPath)) {
      return res.sendFile(path.resolve(fileRecord.thumbnailPath));
    }

    if (fileRecord.mimeType.startsWith('image/') && fs.existsSync(fileRecord.path)) {
      return res.sendFile(path.resolve(fileRecord.path));
    }

    return res.status(404).json({ error: 'Thumbnail not available' });
  },

  async getUploadedFile(req: Request, res: Response) {
    const fileId = req.params.fileId;
    const fileRecord = await dbService.getMediaFile(fileId);

    if (!fileRecord || !fs.existsSync(fileRecord.path)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.setHeader('Content-Type', fileRecord.mimeType);
    return res.sendFile(path.resolve(fileRecord.path));
  }
};
