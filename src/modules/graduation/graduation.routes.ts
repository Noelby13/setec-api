import { Router } from 'express';
import path from 'path';
import { z } from 'zod';
import { GraduationController } from './graduation.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { createUploadMiddleware } from '../../middlewares/upload.middleware';
import { AppError } from '../../middlewares/error.middleware';
import {
  expedienteIdParamSchema,
  inscripcionIdParamSchema,
  publicationIdParamSchema,
  verifyCodeParamSchema,
  createExpedienteSchema,
  updateExpedienteSchema,
  createPublicationSchema,
  validatePublicationSchema,
  issueDocumentSchema,
} from './graduation.schema';

export const graduationRouter = Router();

// Configure Multer storage in ./uploads/documentos/
const uploadDocumentos = createUploadMiddleware('documentos', {
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new AppError('Solo se permiten archivos en formato PDF (.pdf) en este módulo', 400));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

const expedienteUploadFields = uploadDocumentos.fields([
  { name: 'certificado_idioma', maxCount: 1 },
  { name: 'certificado_idioma_url', maxCount: 1 },
  { name: 'acta_defensa', maxCount: 1 },
  { name: 'acta_defensa_url', maxCount: 1 },
  { name: 'titulo_intermedio', maxCount: 1 },
  { name: 'titulo_intermedio_emitido_url', maxCount: 1 },
]);

// ==========================================
// PUBLIC QR / CODE VERIFICATION ENDPOINT
// (Must be public, accessible without JWT)
// ==========================================

/**
 * Public Verification of Academic Degrees and Certificates by QR / Code.
 * GET /api/graduation/verify/:codigoRegistro
 */
graduationRouter.get(
  '/verify/:codigoRegistro',
  validateSchema({
    params: verifyCodeParamSchema,
  }),
  GraduationController.verifyGraduationCode
);

// ==========================================
// PROTECTED GRADUATION DOSSIER ROUTES
// ==========================================

/**
 * Create or initialize student graduation dossier.
 * POST /api/graduation/expediente
 */
graduationRouter.post(
  '/expediente',
  requireAuth,
  requirePermission('TITULO_EMITIR'),
  expedienteUploadFields,
  validateSchema({
    body: createExpedienteSchema,
  }),
  GraduationController.createExpediente
);

/**
 * Get graduation dossier by primary ID.
 * GET /api/graduation/expediente/:id
 */
graduationRouter.get(
  '/expediente/:id',
  requireAuth,
  validateSchema({
    params: expedienteIdParamSchema,
  }),
  GraduationController.getExpedienteById
);

/**
 * Get graduation dossier by enrollment ID.
 * GET /api/graduation/enrollment/:inscripcionId
 */
graduationRouter.get(
  '/enrollment/:inscripcionId',
  requireAuth,
  validateSchema({
    params: inscripcionIdParamSchema,
  }),
  GraduationController.getExpedienteByInscripcionId
);

/**
 * Update graduation dossier.
 * PATCH /api/graduation/expediente/:id
 */
graduationRouter.patch(
  '/expediente/:id',
  requireAuth,
  requirePermission('TITULO_EMITIR'),
  expedienteUploadFields,
  validateSchema({
    params: expedienteIdParamSchema,
    body: updateExpedienteSchema,
  }),
  GraduationController.updateExpediente
);

// ==========================================
// SCIENTIFIC PUBLICATIONS ROUTES
// ==========================================

/**
 * Register a student scientific publication (essay or paper) with PDF evidence.
 * POST /api/graduation/expediente/:expedienteId/publications
 */
graduationRouter.post(
  '/expediente/:expedienteId/publications',
  requireAuth,
  uploadDocumentos.single('evidencia_pdf'),
  validateSchema({
    params: z.object({ expedienteId: z.string().uuid() }),
    body: createPublicationSchema,
  }),
  GraduationController.addScientificPublication
);

/**
 * List all scientific publications registered in a dossier.
 * GET /api/graduation/expediente/:expedienteId/publications
 */
graduationRouter.get(
  '/expediente/:expedienteId/publications',
  requireAuth,
  validateSchema({
    params: z.object({ expedienteId: z.string().uuid() }),
  }),
  GraduationController.getPublicationsByExpediente
);

/**
 * Validate or reject a scientific publication by academic coordination.
 * PATCH /api/graduation/publications/:publicationId/validate
 */
graduationRouter.patch(
  '/publications/:publicationId/validate',
  requireAuth,
  requirePermission('TITULO_EMITIR'),
  validateSchema({
    params: publicationIdParamSchema,
    body: validatePublicationSchema,
  }),
  GraduationController.validateScientificPublication
);

// ==========================================
// DEGREE / CERTIFICATE ISSUANCE ENDPOINT
// ==========================================

/**
 * Issue official degree or certificate after validating all requirements.
 * POST /api/graduation/expediente/:id/issue
 */
graduationRouter.post(
  '/expediente/:id/issue',
  requireAuth,
  requirePermission('TITULO_EMITIR'),
  uploadDocumentos.single('documento_final'),
  validateSchema({
    params: expedienteIdParamSchema,
    body: issueDocumentSchema,
  }),
  GraduationController.issueGraduationDocument
);
