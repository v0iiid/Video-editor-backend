import mongoose, { Schema, Document } from 'mongoose';
import { TimelineSchema } from '../types';

export interface IProjectDocument extends Document {
  projectId: string;
  name: string;
  timeline: TimelineSchema;
}

const ProjectSchema = new Schema<IProjectDocument>(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    timeline: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

export const ProjectModel = mongoose.model<IProjectDocument>('Project', ProjectSchema);
