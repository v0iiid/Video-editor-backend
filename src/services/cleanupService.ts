import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, '../../exports');
const MAX_AGE_HOURS = parseFloat(process.env.TEMP_FILE_MAX_AGE_HOURS || '2');

export function initCleanupWorker(intervalMinutes: number = 60) {
  console.log(`[Cleanup Worker] Started. Interval: ${intervalMinutes} mins. Max age: ${MAX_AGE_HOURS} hrs.`);

  const cleanupDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) return;
    
    fs.readdir(dirPath, (err, files) => {
      if (err) return console.error(`[Cleanup Error] Failed to read ${dirPath}:`, err);

      const now = Date.now();
      const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;

      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) return;

          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlink(filePath, (unlinkErr) => {
              if (!unlinkErr) {
                console.log(`[Cleanup Worker] Removed expired file: ${file}`);
              }
            });
          }
        });
      });
    });
  };

  // Run immediately and set periodic interval
  cleanupDir(UPLOAD_DIR);
  cleanupDir(EXPORT_DIR);

  setInterval(() => {
    cleanupDir(UPLOAD_DIR);
    cleanupDir(EXPORT_DIR);
  }, intervalMinutes * 60 * 1000);
}
