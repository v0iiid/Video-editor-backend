import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../services/dbService';
import { ProjectRecord } from '../types';

export const projectController = {
  async saveProject(req: Request, res: Response) {
    try {
      const { id, name, timeline } = req.body;

      if (!name || !timeline) {
        return res.status(400).json({ error: 'Project name and timeline are required' });
      }

      const projectId = id || `proj_${uuidv4()}`;
      const now = new Date().toISOString();

      const existing = await dbService.getProject(projectId);
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

      await dbService.saveProject(project);

      return res.status(200).json({
        message: 'Project saved successfully',
        project
      });
    } catch (error: any) {
      console.error('[Project Save Error]', error);
      return res.status(500).json({ error: error.message || 'Failed to save project' });
    }
  },

  async getAllProjects(req: Request, res: Response) {
    const projects = await dbService.getAllProjects();
    return res.json({ projects });
  },

  async getProjectById(req: Request, res: Response) {
    const projectId = req.params.id;
    const project = await dbService.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ project });
  },

  async deleteProject(req: Request, res: Response) {
    const projectId = req.params.id;
    const project = await dbService.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await dbService.deleteProject(projectId);
    return res.json({ message: 'Project deleted successfully' });
  }
};
