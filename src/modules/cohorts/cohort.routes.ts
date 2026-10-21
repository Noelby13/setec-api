import { Router } from 'express';
import { CohortController } from './cohort.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { createUploadMiddleware } from '../../middlewares/upload.middleware';
import {
  createCohorteSchema,
  updateCohorteSchema,
  cohorteIdParamSchema,
  programarComponenteSchema,
  updateProgramacionSchema,
  programacionParamSchema,
  cohorteQuerySchema,
} from './cohort.schema';

export const cohortsRouter = Router();

// Upload middleware for cohort exception documents
const uploadCohortes = createUploadMiddleware('cohortes');
const excepcionCupoUpload = uploadCohortes.single('excepcion_cupo_pdf');

// ==========================================
// PUBLIC ROUTES
// ==========================================

// List cohorts with filters (by program, campus, modality, status)
cohortsRouter.get(
  '/',
  validateSchema({ query: cohorteQuerySchema }),
  CohortController.listCohortes
);

// Get cohort by ID with coordinator, campus, and modular schedule
cohortsRouter.get(
  '/:id',
  validateSchema({ params: cohorteIdParamSchema }),
  CohortController.getCohorteById
);

// List modular course scheduling for a cohort
cohortsRouter.get(
  '/:id/componentes',
  validateSchema({ params: cohorteIdParamSchema }),
  CohortController.listProgramacion
);

// ==========================================
// PROTECTED ROUTES (COHORTE_GESTIONAR)
// ==========================================

// Create new cohort (enforcing SETEC quota and health sciences rules)
cohortsRouter.post(
  '/',
  requireAuth,
  requirePermission('COHORTE_GESTIONAR'),
  excepcionCupoUpload,
  validateSchema({ body: createCohorteSchema }),
  CohortController.createCohorte
);

// Update cohort
cohortsRouter.put(
  '/:id',
  requireAuth,
  requirePermission('COHORTE_GESTIONAR'),
  excepcionCupoUpload,
  validateSchema({ params: cohorteIdParamSchema, body: updateCohorteSchema }),
  CohortController.updateCohorte
);

// Delete cohort
cohortsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('COHORTE_GESTIONAR'),
  validateSchema({ params: cohorteIdParamSchema }),
  CohortController.deleteCohorte
);

// Program a curriculum component in a cohort (assign teacher, dates, schedule, classroom)
cohortsRouter.post(
  '/:id/componentes',
  requireAuth,
  requirePermission('COHORTE_GESTIONAR'),
  validateSchema({ params: cohorteIdParamSchema, body: programarComponenteSchema }),
  CohortController.programarComponente
);

// Update component scheduling in a cohort
cohortsRouter.put(
  '/:id/componentes/:componenteId',
  requireAuth,
  requirePermission('COHORTE_GESTIONAR'),
  validateSchema({ params: programacionParamSchema, body: updateProgramacionSchema }),
  CohortController.updateProgramacion
);

// Delete component scheduling from a cohort
cohortsRouter.delete(
  '/:id/componentes/:componenteId',
  requireAuth,
  requirePermission('COHORTE_GESTIONAR'),
  validateSchema({ params: programacionParamSchema }),
  CohortController.deleteProgramacion
);

export default cohortsRouter;
