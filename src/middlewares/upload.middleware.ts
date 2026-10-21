import multer, { StorageEngine, Options } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export function createUploadStorage(subFolder: string): StorageEngine {
  const uploadDir = path.resolve(process.cwd(), 'uploads', subFolder);

  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${crypto.randomUUID()}${ext}`;
      cb(null, uniqueName);
    },
  });
}

export function createUploadMiddleware(subFolder: string, options?: Omit<Options, 'storage'>) {
  return multer({
    storage: createUploadStorage(subFolder),
    ...options,
  });
}

export const uploadTo = createUploadMiddleware;

export function getRelativeUploadPath(file: Express.Multer.File): string {
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const relativeFromRoot = path.relative(uploadsRoot, file.destination).replace(/\\/g, '/');
  const cleanFolder = relativeFromRoot ? `${relativeFromRoot}/` : '';
  return `/uploads/${cleanFolder}${file.filename}`;
}
