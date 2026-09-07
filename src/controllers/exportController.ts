import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { dbService } from '../services/dbService';
import { jobQueue } from '../services/jobQueue';
import { TimelineSchema } from '../types';

export const exportController = {
  createExportJob(req: Request, res: Response) {
    try {
      const timeline: TimelineSchema = req.body;

      if (!timeline || !timeline.tracks || !Array.isArray(timeline.tracks)) {
        return res.status(400).json({ error: 'Invalid timeline schema payload' });
      }

      const job = jobQueue.createJob(timeline);

      return res.status(202).json({
        message: 'Export job submitted successfully',
        jobId: job.id,
        status: job.status,
        statusUrl: `/api/export/${job.id}/status`
      });
    } catch (error: any) {
      console.error('[Export Controller Error]', error);
      return res.status(500).json({ error: error.message || 'Failed to initiate export' });
    }
  },

  getJobStatus(req: Request, res: Response) {
    const jobId = req.params.jobId;
    const job = dbService.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }

    return res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      downloadUrl: job.status === 'completed' ? `/api/export/${job.id}/download` : undefined,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    });
  },

  downloadExportedFile(req: Request, res: Response) {
    const jobId = req.params.jobId;
    const job = dbService.getJob(jobId);

    if (!job || job.status !== 'completed' || !job.outputPath) {
      return res.status(404).json({ error: 'Export file not ready or job not found' });
    }

    if (!fs.existsSync(job.outputPath)) {
      return res.status(404).json({ error: 'Rendered output file missing on server' });
    }

    const filename = `rendered_video_${jobId.slice(0, 8)}.mp4`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    return res.sendFile(path.resolve(job.outputPath));
  }
};
