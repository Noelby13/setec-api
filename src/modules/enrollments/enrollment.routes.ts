import { Router } from 'express';
import { EnrollmentController } from './enrollment.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { createUploadMiddleware } from '../../middlewares/upload.middleware';
import {
  createEnrollmentSchema,
  validateDocumentsSchema,
  createPaymentSchema,
  validatePaymentSchema,
  createConvalidationSchema,
  dictamenConvalidationSchema,
  enrollmentIdParamSchema,
  paymentIdParamSchema,
  convalidationIdParamSchema,
  listEnrollmentsQuerySchema,
} from './enrollment.schema';

export const enrollmentRouter = Router();

// Configure Multer storage instances
const uploadPonencias = createUploadMiddleware('ponencias');
const uploadBauchers = createUploadMiddleware('bauchers');
const uploadConvalidaciones = createUploadMiddleware('convalidaciones');

const ponenciaUploadFields = uploadPonencias.fields([
  { name: 'archivo_ponencia', maxCount: 1 },
  { name: 'archivo_ponencia_url', maxCount: 1 },
]);

const baucherUploadFields = uploadBauchers.fields([
  { name: 'comprobante_baucher', maxCount: 1 },
  { name: 'comprobante_baucher_url', maxCount: 1 },
  { name: 'baucher', maxCount: 1 },
]);

const convalidacionUploadFields = uploadConvalidaciones.fields([
  { name: 'certificado_origen', maxCount: 1 },
  { name: 'certificado_origen_url', maxCount: 1 },
]);

// ==========================================
// STATIC / NESTED SUB-COLLECTION ROUTES
// (Must precede /:id to prevent collisions)
// ==========================================

// Get authenticated student's enrollments
enrollmentRouter.get('/me', requireAuth, EnrollmentController.getMyEnrollments);

// Cashier / Admin approves or rejects a registered payment
enrollmentRouter.patch(
  '/payments/:paymentId/validate',
  requireAuth,
  requirePermission('PAGO_VALIDAR'),
  validateSchema({
    params: paymentIdParamSchema,
    body: validatePaymentSchema,
  }),
  EnrollmentController.validatePayment
);

// Coordinator emits resolution (dictamen) on a convalidation request
enrollmentRouter.patch(
  '/convalidations/:convalidationId/dictamen',
  requireAuth,
  requirePermission('CONVALIDACION_DICTAMINAR'),
  validateSchema({
    params: convalidationIdParamSchema,
    body: dictamenConvalidationSchema,
  }),
  EnrollmentController.dictamenConvalidation
);

// ==========================================
// MAIN ENROLLMENTS ROUTES
// ==========================================

// List enrollments with filters and pagination (Admin/Coordinator/Cashier)
enrollmentRouter.get(
  '/',
  requireAuth,
  requirePermission('INSCRIPCION_VALIDAR'),
  validateSchema({ query: listEnrollmentsQuerySchema }),
  EnrollmentController.listEnrollments
);

// Register a new enrollment
enrollmentRouter.post(
  '/',
  requireAuth,
  ponenciaUploadFields,
  validateSchema({ body: createEnrollmentSchema }),
  EnrollmentController.createEnrollment
);

// Get detailed enrollment by ID
enrollmentRouter.get(
  '/:id',
  requireAuth,
  validateSchema({ params: enrollmentIdParamSchema }),
  EnrollmentController.getEnrollmentById
);

// Validate documents and execute automatic transactional quorum
enrollmentRouter.patch(
  '/:id/validate-documents',
  requireAuth,
  requirePermission('INSCRIPCION_VALIDAR'),
  validateSchema({
    params: enrollmentIdParamSchema,
    body: validateDocumentsSchema,
  }),
  EnrollmentController.validateDocuments
);

// ==========================================
// PAYMENTS UNDER ENROLLMENT
// ==========================================

// Register a payment voucher or receipt for an enrollment
enrollmentRouter.post(
  '/:id/payments',
  requireAuth,
  baucherUploadFields,
  validateSchema({
    params: enrollmentIdParamSchema,
    body: createPaymentSchema,
  }),
  EnrollmentController.registerPayment
);

// List payments of an enrollment
enrollmentRouter.get(
  '/:id/payments',
  requireAuth,
  validateSchema({ params: enrollmentIdParamSchema }),
  EnrollmentController.getPaymentsByEnrollment
);

// ==========================================
// CONVALIDATIONS UNDER ENROLLMENT
// ==========================================

// Request convalidation / credit recognition for an enrollment
enrollmentRouter.post(
  '/:id/convalidations',
  requireAuth,
  convalidacionUploadFields,
  validateSchema({
    params: enrollmentIdParamSchema,
    body: createConvalidationSchema,
  }),
  EnrollmentController.requestConvalidation
);

// List convalidations of an enrollment
enrollmentRouter.get(
  '/:id/convalidations',
  requireAuth,
  validateSchema({ params: enrollmentIdParamSchema }),
  EnrollmentController.getConvalidationsByEnrollment
);

export default enrollmentRouter;
