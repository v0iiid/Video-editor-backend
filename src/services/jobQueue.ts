import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ExportJob, TimelineSchema } from '../types';
import { dbService } from './dbService';
import { ffmpegService } from './ffmpegService';

const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, '../../exports');

export const jobQueue = {
  createJob(timeline: TimelineSchema): ExportJob {
    const id = `job_${uuidv4()}`;
    const job: ExportJob = {
      id,
      timeline,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString()
    };
    dbService.saveJob(job);

    // Process job asynchronously in background
    setImmediate(() => {
      this.processJob(id);
    });

    return job;
  },

  async processJob(jobId: string) {
    const job = dbService.getJob(jobId);
    if (!job) return;

    job.status = 'processing';
    job.progress = 5;
    dbService.saveJob(job);

    try {
      const outputFilename = `export_${jobId}.mp4`;
      const outputPath = path.join(EXPORT_DIR, outputFilename);

      await ffmpegService.renderTimeline(
        job.timeline,
        (fileId) => dbService.getMediaFile(fileId),
        outputPath,
        (percent) => {
          const currentJob = dbService.getJob(jobId);
          if (currentJob && currentJob.status === 'processing') {
            currentJob.progress = percent;
            dbService.saveJob(currentJob);
          }
        }
      );

      const completedJob = dbService.getJob(jobId);
      if (completedJob) {
        completedJob.status = 'completed';
        completedJob.progress = 100;
        completedJob.outputPath = outputPath;
        completedJob.downloadUrl = `/api/export/${jobId}/download`;
        completedJob.completedAt = new Date().toISOString();
        dbService.saveJob(completedJob);
      }
    } catch (err: any) {
      console.error(`[Job ${jobId} Error]`, err);
      const failedJob = dbService.getJob(jobId);
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.error = err.message || 'Render processing failed';
        dbService.saveJob(failedJob);
      }
    }
  }
};
