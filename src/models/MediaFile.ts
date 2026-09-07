import mongoose, { Schema, Document } from 'mongoose';
import { MediaFileMetadata } from '../types';

export interface IMediaFileDocument extends Omit<MediaFileMetadata, 'id'>, Document {
  fileId: string;
}

const MediaFileSchema = new Schema<IMediaFileDocument>(
  {
    fileId: { type: String, required: true, unique: true, index: true },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    duration: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    fps: { type: Number },
    resolution: { type: String },
    hasAudio: { type: Boolean, default: true },
    thumbnailPath: { type: String }
  },
  { timestamps: true }
);

export const MediaFileModel = mongoose.model<IMediaFileDocument>('MediaFile', MediaFileSchema);
