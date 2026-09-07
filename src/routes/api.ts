import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { uploadController } from '../controllers/uploadController';
import { exportController } from '../controllers/exportController';
import { projectController } from '../controllers/projectController';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '500')) * 1024 * 1024
  }
});

const router = Router();

// Upload routes
router.post('/upload', upload.single('file'), uploadController.handleUpload);
router.get('/uploads', uploadController.getAllUploads);
router.get('/uploads/:fileId', uploadController.getUploadedFile);
router.get('/thumbnail/:fileId', uploadController.getThumbnail);

// Export routes
router.post('/export', exportController.createExportJob);
router.get('/export/:jobId/status', exportController.getJobStatus);
router.get('/export/:jobId/download', exportController.downloadExportedFile);

// Project routes
router.post('/projects', projectController.saveProject);
router.get('/projects', projectController.getAllProjects);
router.get('/projects/:id', projectController.getProjectById);
router.delete('/projects/:id', projectController.deleteProject);

export default router;
