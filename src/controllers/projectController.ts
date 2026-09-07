import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../services/dbService';
import { ProjectRecord, TimelineSchema } from '../types';

export const projectController = {
  saveProject(req: Request, res: Response) {
    try {
      const { id, name, timeline } = req.body;

      if (!name || !timeline) {
        return res.status(400).json({ error: 'Project name and timeline are required' });
      }

      const projectId = id || `proj_${uuidv4()}`;
      const now = new Date().toISOString();

      const existing = dbService.getProject(projectId);
      const project: ProjectRecord = {
        id: projectId,
        name: name,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        timeline: {
          ...timeline,
          id: projectId,
          name: name
        }
      };

      dbService.saveProject(project);

      return res.status(200).json({
        message: 'Project saved successfully',
        project
      });
    } catch (error: any) {
      console.error('[Project Save Error]', error);
      return res.status(500).json({ error: error.message || 'Failed to save project' });
    }
  },

  getAllProjects(req: Request, res: Response) {
    const projects = dbService.getAllProjects();
    return res.json({ projects });
  },

  getProjectById(req: Request, res: Response) {
    const projectId = req.params.id;
    const project = dbService.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ project });
  },

  deleteProject(req: Request, res: Response) {
    const projectId = req.params.id;
    const project = dbService.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    dbService.deleteProject(projectId);
    return res.json({ message: 'Project deleted successfully' });
  }
};
