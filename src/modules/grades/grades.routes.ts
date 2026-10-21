import { requireTeachingAssignment } from '../../middlewares/teaching.middleware';
import { requireRecordAccess } from '../../middlewares/ownership.middleware';
import { Router } from 'express';
import path from 'path';
import { GradesController } from './grades.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { createUploadMiddleware } from '../../middlewares/upload.middleware';
import { AppError } from '../../middlewares/error.middleware';
import {
  programacionComponenteIdParamSchema,
  matriculaComponenteIdParamSchema,
  inscripcionIdParamSchema,
  modifyGradeSchema,
} from './grades.schema';

export const gradesRouter = Router();

// Configure Multer storage in ./uploads/actas_excel/
const uploadActasExcel = createUploadMiddleware('actas_excel', {
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new AppError('Solo se permiten archivos de hoja de cálculo (.xlsx, .xls)', 400));
    }
  },
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
});

// ==========================================
// GRADES ENDPOINTS
// ==========================================

/**
 * 1. Import Grades from Excel file (.xlsx)
 * POST /api/grades/import/:programacionComponenteId
 */
gradesRouter.post(
  '/import/:programacionComponenteId',
  requireAuth,
  requirePermission('NOTA_IMPORTAR'),
  requireTeachingAssignment,
  uploadActasExcel.single('archivo_excel'),
  validateSchema({
    params: programacionComponenteIdParamSchema,
  }),
  GradesController.importGradesExcel
);

/**
 * 2. Manual Grade Modification with Mandatory Justification & Audit Trail
 * PATCH /api/grades/:matriculaComponenteId
 */
gradesRouter.patch(
  '/:matriculaComponenteId',
  requireAuth,
  requirePermission('NOTA_MODIFICAR'),
  requireRecordAccess('grade', 'matriculaComponenteId', ['NOTA_MODIFICAR']),
  validateSchema({
    params: matriculaComponenteIdParamSchema,
    body: modifyGradeSchema,
  }),
  GradesController.modifyGrade
);

/**
 * 3. List student grades for a modular course schedule
 * GET /api/grades/component/:programacionComponenteId
 */
gradesRouter.get(
  '/component/:programacionComponenteId',
  requireAuth,
  requirePermission('NOTA_IMPORTAR'),
  requireTeachingAssignment,
  validateSchema({
    params: programacionComponenteIdParamSchema,
  }),
  GradesController.getGradesByComponent
);

/**
 * 4. List import lots history for a scheduled component
 * GET /api/grades/lots/:programacionComponenteId
 */
gradesRouter.get(
  '/lots/:programacionComponenteId',
  requireAuth,
  requirePermission('NOTA_IMPORTAR'),
  requireTeachingAssignment,
  validateSchema({
    params: programacionComponenteIdParamSchema,
  }),
  GradesController.getImportLots
);

/**
 * 5. Get student transcript / kardex by enrollment ID
 * GET /api/grades/student/:inscripcionId
 */
gradesRouter.get(
  '/student/:inscripcionId',
  requireAuth,
  requireRecordAccess('enrollment', 'inscripcionId', ['NOTA_IMPORTAR', 'NOTA_MODIFICAR']),
  validateSchema({
    params: inscripcionIdParamSchema,
  }),
  GradesController.getGradesByStudent
);

/**
 * 6. Audit trail for a single grade
 * GET /api/grades/:matriculaComponenteId/logs
 */
gradesRouter.get(
  '/:matriculaComponenteId/logs',
  requireAuth,
  requireRecordAccess('grade', 'matriculaComponenteId', ['NOTA_IMPORTAR', 'NOTA_MODIFICAR']),
  validateSchema({
    params: matriculaComponenteIdParamSchema,
  }),
  GradesController.getGradeLogs
);
