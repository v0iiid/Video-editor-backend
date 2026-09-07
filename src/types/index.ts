export interface MediaFileMetadata {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  duration: number; // in seconds
  width?: number;
  height?: number;
  fps?: number;
  resolution?: string;
  hasAudio: boolean;
  thumbnailPath?: string;
  createdAt: string;
}

export type TrackType = 'video' | 'audio';

export interface TransformOptions {
  x: number; // percentage offset -50 to 50
  y: number; // percentage offset -50 to 50
  scale: number; // 0.5 to 2.0
}

export interface Clip {
  id: string;
  fileId: string;
  name: string;
  type: TrackType;
  start: number;      // Position on timeline in seconds
  duration: number;   // Visual duration on timeline in seconds
  trimIn: number;     // Source media start crop point in seconds
  trimOut: number;    // Source media end crop point in seconds
  volume?: number;    // 0.0 to 2.0
  speed?: number;     // 0.25 to 4.0
  filter?: 'none' | 'grayscale' | 'sepia' | 'invert' | 'bright' | 'contrast';
  transform?: TransformOptions;
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  clips: Clip[];
}

export interface TextOverlay {
  id: string;
  text: string;
  start: number;       // Start timestamp on timeline
  end: number;         // End timestamp on timeline
  x: number;           // Percentage position X (0 to 100)
  y: number;           // Percentage position Y (0 to 100)
  fontSize: number;    // In pixels (e.g. 24, 36, 48)
  fontColor: string;   // Hex string #ffffff
  backgroundColor?: string; // Hex string #00000080 or transparent
  fontFamily?: string;
}

export interface Transition {
  id: string;
  type: 'crossfade' | 'fadein' | 'fadeout' | 'wipeleft' | 'wiperight';
  fromClipId: string;
  toClipId: string;
  duration: number; // In seconds
}

export interface CanvasSettings {
  width: number;
  height: number;
  fps: number;
}

// Extensible Timeline Schema for Phase 1 & Phase 2 (AI/Whisper)
export interface TimelineSchema {
  id?: string;
  name: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  canvas: CanvasSettings;
  tracks: Track[];
  textOverlays: TextOverlay[];
  transitions: Transition[];
  
  // Reserved for Phase 2 AI & Transcription Features
  transcript?: {
    language?: string;
    segments: Array<{
      id: string;
      start: number;
      end: number;
      text: string;
      words?: Array<{ word: string; start: number; end: number }>;
    }>;
  } | null;
  aiMetadata?: Record<string, any>;
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  timeline: TimelineSchema;
  status: JobStatus;
  progress: number; // 0 to 100
  outputPath?: string;
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineSchema;
}
