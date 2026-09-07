import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { initCleanupWorker } from './services/cleanupService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, '../exports');

// Ensure required directories exist
[UPLOAD_DIR, EXPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Video Editor Express API',
    ffmpegReady: true,
    timestamp: new Date().toISOString()
  });
});

// Register API Routes
app.use('/api', apiRouter);

// Start Background Cleanup Task
initCleanupWorker(parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '60'));

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🚀 Video Editor Backend Server is running!`);
  console.log(`  📡 API Endpoint: http://localhost:${PORT}/api`);
  console.log(`  📁 Uploads Dir: ${path.resolve(UPLOAD_DIR)}`);
  console.log(`  📁 Exports Dir: ${path.resolve(EXPORT_DIR)}`);
  console.log(`=======================================================`);
});
