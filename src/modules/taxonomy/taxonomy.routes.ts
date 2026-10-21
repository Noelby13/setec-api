import { Router } from 'express';
import { TaxonomyController } from './taxonomy.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import {
  createAreaSchema,
  updateAreaSchema,
  areaIdParamSchema,
  createTagSchema,
  updateTagSchema,
  tagIdParamSchema,
} from './taxonomy.schema';

export const taxonomyRouter = Router();

// ==========================================
// PUBLIC ROUTES (Web Showcase / Escaparate Web)
// ==========================================
taxonomyRouter.get('/areas', TaxonomyController.listAreas);
taxonomyRouter.get(
  '/areas/:id',
  validateSchema({ params: areaIdParamSchema }),
  TaxonomyController.getAreaById
);

taxonomyRouter.get('/tags', TaxonomyController.listTags);
taxonomyRouter.get(
  '/tags/:id',
  validateSchema({ params: tagIdParamSchema }),
  TaxonomyController.getTagById
);

// ==========================================
// PROTECTED ROUTES (SETEC CATALOG MANAGEMENT)
// ==========================================
taxonomyRouter.post(
  '/areas',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ body: createAreaSchema }),
  TaxonomyController.createArea
);

taxonomyRouter.put(
  '/areas/:id',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ params: areaIdParamSchema, body: updateAreaSchema }),
  TaxonomyController.updateArea
);

taxonomyRouter.delete(
  '/areas/:id',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ params: areaIdParamSchema }),
  TaxonomyController.deleteArea
);

taxonomyRouter.post(
  '/tags',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ body: createTagSchema }),
  TaxonomyController.createTag
);

taxonomyRouter.put(
  '/tags/:id',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ params: tagIdParamSchema, body: updateTagSchema }),
  TaxonomyController.updateTag
);

taxonomyRouter.delete(
  '/tags/:id',
  requireAuth,
  requirePermission('CATALOGO_GESTIONAR'),
  validateSchema({ params: tagIdParamSchema }),
  TaxonomyController.deleteTag
);

export default taxonomyRouter;
