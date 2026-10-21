import { Router } from 'express';
import { InfrastructureController } from './infrastructure.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { createUploadMiddleware } from '../../middlewares/upload.middleware';
import {
  createSedeSchema,
  updateSedeSchema,
  sedeIdParamSchema,
  createDocenteSchema,
  updateDocenteSchema,
  docenteIdParamSchema,
} from './infrastructure.schema';

export const infrastructureRouter = Router();

// Configure Multer for Academic Staff (Docentes)
const uploadDocentes = createUploadMiddleware('docentes');
const docenteUploadFields = uploadDocentes.fields([
  { name: 'foto_perfil', maxCount: 1 },
  { name: 'cv_pdf', maxCount: 1 },
]);

// ==========================================
// RUTAS: SEDES UNIVERSITARIAS (SETEC Art. 22-28)
// ==========================================

// Public routes for institutional and catalog showcase
infrastructureRouter.get('/sedes', InfrastructureController.listSedes);
infrastructureRouter.get(
  '/sedes/:id',
  validateSchema({ params: sedeIdParamSchema }),
  InfrastructureController.getSedeById
);

// Protected routes (SEDE_GESTIONAR)
infrastructureRouter.post(
  '/sedes',
  requireAuth,
  requirePermission('SEDE_GESTIONAR'),
  validateSchema({ body: createSedeSchema }),
  InfrastructureController.createSede
);

infrastructureRouter.put(
  '/sedes/:id',
  requireAuth,
  requirePermission('SEDE_GESTIONAR'),
  validateSchema({ params: sedeIdParamSchema, body: updateSedeSchema }),
  InfrastructureController.updateSede
);

infrastructureRouter.delete(
  '/sedes/:id',
  requireAuth,
  requirePermission('SEDE_GESTIONAR'),
  validateSchema({ params: sedeIdParamSchema }),
  InfrastructureController.deleteSede
);

// ==========================================
// RUTAS: PERSONAL ACADÉMICO / DOCENTES
// ==========================================

// Public routes for instructor profiles / marketplace showcase
infrastructureRouter.get('/docentes', InfrastructureController.listDocentes);
infrastructureRouter.get(
  '/docentes/:id',
  validateSchema({ params: docenteIdParamSchema }),
  InfrastructureController.getDocenteById
);

// Protected routes (DOCENTE_GESTIONAR)
infrastructureRouter.post(
  '/docentes',
  requireAuth,
  requirePermission('DOCENTE_GESTIONAR'),
  docenteUploadFields,
  validateSchema({ body: createDocenteSchema }),
  InfrastructureController.createDocente
);

infrastructureRouter.put(
  '/docentes/:id',
  requireAuth,
  requirePermission('DOCENTE_GESTIONAR'),
  docenteUploadFields,
  validateSchema({ params: docenteIdParamSchema, body: updateDocenteSchema }),
  InfrastructureController.updateDocente
);

infrastructureRouter.delete(
  '/docentes/:id',
  requireAuth,
  requirePermission('DOCENTE_GESTIONAR'),
  validateSchema({ params: docenteIdParamSchema }),
  InfrastructureController.deleteDocente
);

export default infrastructureRouter;
