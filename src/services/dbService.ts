import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { MediaFileMetadata, ProjectRecord, ExportJob } from '../types';
import { MediaFileModel } from '../models/MediaFile';
import { ProjectModel } from '../models/Project';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');

const FILES_DB_PATH = path.join(DATA_DIR, 'files.json');
const PROJECTS_DB_PATH = path.join(DATA_DIR, 'projects.json');
const JOBS_DB_PATH = path.join(DATA_DIR, 'jobs.json');

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILES_DB_PATH)) fs.writeFileSync(FILES_DB_PATH, JSON.stringify([]));
  if (!fs.existsSync(PROJECTS_DB_PATH)) fs.writeFileSync(PROJECTS_DB_PATH, JSON.stringify([]));
  if (!fs.existsSync(JOBS_DB_PATH)) fs.writeFileSync(JOBS_DB_PATH, JSON.stringify([]));
}

ensureDataDirectory();

function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

function readJsonFile<T>(filePath: string): T {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error) {
    return [] as unknown as T;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export const dbService = {
  // Connect to MongoDB
  async connectMongo(uri: string): Promise<boolean> {
    try {
      await mongoose.connect(uri);
      console.log('  🍃 Connected to MongoDB with Mongoose successfully!');
      return true;
    } catch (err: any) {
      console.warn('  ⚠️ MongoDB connection failed (make sure mongod is running), falling back to local JSON files:', err.message);
      return false;
    }
  },

  // Media Files
  async saveMediaFile(meta: MediaFileMetadata): Promise<void> {
    if (isMongoConnected()) {
      await MediaFileModel.findOneAndUpdate(
        { fileId: meta.id },
        { ...meta, fileId: meta.id },
        { upsert: true, new: true }
      );
    }
    const files = readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
    const index = files.findIndex(f => f.id === meta.id);
    if (index >= 0) files[index] = meta;
    else files.push(meta);
    writeJsonFile(FILES_DB_PATH, files);
  },

  async getMediaFile(id: string): Promise<MediaFileMetadata | undefined> {
    if (isMongoConnected()) {
      const doc = await MediaFileModel.findOne({ fileId: id }).lean();
      if (doc) {
        return {
          id: doc.fileId,
          originalName: doc.originalName,
          filename: doc.filename,
          path: doc.path,
          mimeType: doc.mimeType,
          size: doc.size,
          duration: doc.duration,
          width: doc.width,
          height: doc.height,
          fps: doc.fps,
          resolution: doc.resolution,
          hasAudio: doc.hasAudio,
          thumbnailPath: doc.thumbnailPath,
          createdAt: (doc as any).createdAt ? new Date((doc as any).createdAt).toISOString() : new Date().toISOString()
        };
      }
    }
    const files = readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
    return files.find(f => f.id === id);
  },

  async getAllMediaFiles(): Promise<MediaFileMetadata[]> {
    if (isMongoConnected()) {
      const docs = await MediaFileModel.find().lean();
      return docs.map(doc => ({
        id: doc.fileId,
        originalName: doc.originalName,
        filename: doc.filename,
        path: doc.path,
        mimeType: doc.mimeType,
        size: doc.size,
        duration: doc.duration,
        width: doc.width,
        height: doc.height,
        fps: doc.fps,
        resolution: doc.resolution,
        hasAudio: doc.hasAudio,
        thumbnailPath: doc.thumbnailPath,
        createdAt: (doc as any).createdAt ? new Date((doc as any).createdAt).toISOString() : new Date().toISOString()
      }));
    }
    return readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
  },

  async deleteMediaFile(id: string): Promise<void> {
    if (isMongoConnected()) {
      await MediaFileModel.deleteOne({ fileId: id });
    }
    const files = readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
    const filtered = files.filter(f => f.id !== id);
    writeJsonFile(FILES_DB_PATH, filtered);
  },

  // Projects
  async saveProject(project: ProjectRecord): Promise<void> {
    if (isMongoConnected()) {
      await ProjectModel.findOneAndUpdate(
        { projectId: project.id },
        { projectId: project.id, name: project.name, timeline: project.timeline },
        { upsert: true, new: true }
      );
    }
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) projects[index] = project;
    else projects.push(project);
    writeJsonFile(PROJECTS_DB_PATH, projects);
  },

  async getProject(id: string): Promise<ProjectRecord | undefined> {
    if (isMongoConnected()) {
      const doc = await ProjectModel.findOne({ projectId: id }).lean();
      if (doc) {
        return {
          id: doc.projectId,
          name: doc.name,
          createdAt: (doc as any).createdAt ? new Date((doc as any).createdAt).toISOString() : new Date().toISOString(),
          updatedAt: (doc as any).updatedAt ? new Date((doc as any).updatedAt).toISOString() : new Date().toISOString(),
          timeline: doc.timeline
        };
      }
    }
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    return projects.find(p => p.id === id);
  },

  async getAllProjects(): Promise<ProjectRecord[]> {
    if (isMongoConnected()) {
      const docs = await ProjectModel.find().sort({ updatedAt: -1 }).lean();
      return docs.map(doc => ({
        id: doc.projectId,
        name: doc.name,
        createdAt: (doc as any).createdAt ? new Date((doc as any).createdAt).toISOString() : new Date().toISOString(),
        updatedAt: (doc as any).updatedAt ? new Date((doc as any).updatedAt).toISOString() : new Date().toISOString(),
        timeline: doc.timeline
      }));
    }
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async deleteProject(id: string): Promise<void> {
    if (isMongoConnected()) {
      await ProjectModel.deleteOne({ projectId: id });
    }
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    const filtered = projects.filter(p => p.id !== id);
    writeJsonFile(PROJECTS_DB_PATH, filtered);
  },

  // Export Jobs
  saveJob(job: ExportJob): void {
    const jobs = readJsonFile<ExportJob[]>(JOBS_DB_PATH);
    const index = jobs.findIndex(j => j.id === job.id);
    if (index >= 0) jobs[index] = job;
    else jobs.push(job);
    writeJsonFile(JOBS_DB_PATH, jobs);
  },

  getJob(id: string): ExportJob | undefined {
    const jobs = readJsonFile<ExportJob[]>(JOBS_DB_PATH);
    return jobs.find(j => j.id === id);
  }
};
