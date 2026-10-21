import { Router } from 'express';
import { ProgramController } from './program.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { createUploadMiddleware } from '../../middlewares/upload.middleware';
import {
  createProgramSchema,
  updateProgramSchema,
  programIdParamSchema,
  programSlugParamSchema,
  aspiranteIdParamSchema,
  createComponenteSchema,
  updateComponenteSchema,
  componenteParamSchema,
  assignTagsSchema,
  catalogQuerySchema,
} from './program.schema';

export const programsRouter = Router();

// Configure file uploads for programs and curricula
const uploadProgramas = createUploadMiddleware('programas');
const programUploadFields = uploadProgramas.fields([
  { name: 'aval_minsa', maxCount: 1 },
  { name: 'imagen_portada', maxCount: 1 },
  { name: 'brochure_pdf', maxCount: 1 },
]);

const uploadSilabo = createUploadMiddleware('silabos');
const silaboUploadField = uploadSilabo.single('silabo_pdf');

// ==========================================
// PUBLIC ROUTES (Web Showcase / Catálogo Udemy / Recomendaciones)
// ==========================================

// Public catalog with area, tags, full curriculum, and open cohorts
programsRouter.get(
  '/catalog',
  validateSchema({ query: catalogQuerySchema }),
  ProgramController.getCatalog
);

// Recommendation Engine for an applicant
programsRouter.get(
  '/recommendations/:aspiranteId',
  validateSchema({ params: aspiranteIdParamSchema }),
  ProgramController.getRecommendations
);

// Find program by slug (public friendly URL)
programsRouter.get(
  '/slug/:slug',
  validateSchema({ params: programSlugParamSchema }),
  ProgramController.getProgramBySlug
);

// General list of programs
programsRouter.get('/', ProgramController.listPrograms);

// Program details by ID
programsRouter.get(
  '/:id',
  validateSchema({ params: programIdParamSchema }),
  ProgramController.getProgramById
);

// List curriculum components of a program
programsRouter.get(
  '/:id/componentes',
  validateSchema({ params: programIdParamSchema }),
  ProgramController.listComponentes
);

// ==========================================
// PROTECTED ROUTES (CATALOGO_GESTIONAR)
// ==========================================

// Create new academic program
programsRouter.post(
  '/',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  programUploadFields,
  validateSchema({ body: createProgramSchema }),
  ProgramController.createProgram
);

// Update academic program
programsRouter.put(
  '/:id',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  programUploadFields,
  validateSchema({ params: programIdParamSchema, body: updateProgramSchema }),
  ProgramController.updateProgram
);

// Delete academic program
programsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ params: programIdParamSchema }),
  ProgramController.deleteProgram
);

// Assign tags to academic program
programsRouter.post(
  '/:id/tags',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ params: programIdParamSchema, body: assignTagsSchema }),
  ProgramController.assignTags
);

// Add curriculum component to a program
programsRouter.post(
  '/:id/componentes',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  silaboUploadField,
  validateSchema({ params: programIdParamSchema, body: createComponenteSchema }),
  ProgramController.createComponente
);

// Update curriculum component
programsRouter.put(
  '/:id/componentes/:componenteId',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  silaboUploadField,
  validateSchema({ params: componenteParamSchema, body: updateComponenteSchema }),
  ProgramController.updateComponente
);

// Delete curriculum component
programsRouter.delete(
  '/:id/componentes/:componenteId',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ params: componenteParamSchema }),
  ProgramController.deleteComponente
);

export default programsRouter;
