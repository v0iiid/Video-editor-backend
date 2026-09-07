import fs from 'fs';
import path from 'path';
import { MediaFileMetadata, ProjectRecord, ExportJob } from '../types';

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
  // Media Files
  saveMediaFile(meta: MediaFileMetadata): void {
    const files = readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
    const index = files.findIndex(f => f.id === meta.id);
    if (index >= 0) {
      files[index] = meta;
    } else {
      files.push(meta);
    }
    writeJsonFile(FILES_DB_PATH, files);
  },

  getMediaFile(id: string): MediaFileMetadata | undefined {
    const files = readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
    return files.find(f => f.id === id);
  },

  getAllMediaFiles(): MediaFileMetadata[] {
    return readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
  },

  deleteMediaFile(id: string): void {
    const files = readJsonFile<MediaFileMetadata[]>(FILES_DB_PATH);
    const filtered = files.filter(f => f.id !== id);
    writeJsonFile(FILES_DB_PATH, filtered);
  },

  // Projects
  saveProject(project: ProjectRecord): void {
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    writeJsonFile(PROJECTS_DB_PATH, projects);
  },

  getProject(id: string): ProjectRecord | undefined {
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    return projects.find(p => p.id === id);
  },

  getAllProjects(): ProjectRecord[] {
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  deleteProject(id: string): void {
    const projects = readJsonFile<ProjectRecord[]>(PROJECTS_DB_PATH);
    const filtered = projects.filter(p => p.id !== id);
    writeJsonFile(PROJECTS_DB_PATH, filtered);
  },

  // Export Jobs
  saveJob(job: ExportJob): void {
    const jobs = readJsonFile<ExportJob[]>(JOBS_DB_PATH);
    const index = jobs.findIndex(j => j.id === job.id);
    if (index >= 0) {
      jobs[index] = job;
    } else {
      jobs.push(job);
    }
    writeJsonFile(JOBS_DB_PATH, jobs);
  },

  getJob(id: string): ExportJob | undefined {
    const jobs = readJsonFile<ExportJob[]>(JOBS_DB_PATH);
    return jobs.find(j => j.id === id);
  }
};
