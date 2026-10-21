import { requireOwnedFileReferences } from '../../middlewares/private-upload.middleware';
import { requireRecordAccess, requireSelfAssignment } from '../../middlewares/ownership.middleware';
import { Router } from 'express';
import { ApplicantController } from './applicant.controller';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { createUploadMiddleware } from '../../middlewares/upload.middleware';
import {
  createApplicantProfileSchema,
  updateApplicantProfileSchema,
  replaceInterestsSchema,
  createAcademicDegreeSchema,
  updateAcademicDegreeSchema,
  validateAcademicDegreeSchema,
  applicantIdParamSchema,
  degreeIdParamSchema,
  listApplicantsQuerySchema,
} from './applicant.schema';

export const applicantsRouter = Router();

// Configure Multer storage for documents in ./uploads/documentos/
const uploadDocumentos = createUploadMiddleware('documentos');

const profileUploadFields = uploadDocumentos.fields([
  { name: 'cedula_identidad_pdf', maxCount: 1 },
  { name: 'cedula_identidad_pdf_url', maxCount: 1 },
  { name: 'tutor_documento', maxCount: 1 },
  { name: 'tutor_documento_url', maxCount: 1 },
]);

const degreeUploadFields = uploadDocumentos.fields([
  { name: 'titulo_pdf', maxCount: 1 },
  { name: 'titulo_pdf_url', maxCount: 1 },
  { name: 'certificado_rn', maxCount: 1 },
  { name: 'certificado_rn_url', maxCount: 1 },
]);

// ==========================================
// CURRENT USER PROFILE ROUTES (/me)
// (Must precede /:id to prevent matching 'me' as UUID)
// ==========================================

// Get authenticated user's applicant profile
applicantsRouter.get(
  '/me',
  requireAuth,
  ApplicantController.getMyProfile
);

// Update authenticated user's applicant profile
applicantsRouter.put(
  '/me',
  requireAuth,
  profileUploadFields,
  requireOwnedFileReferences(['cedula_identidad_pdf_url', 'tutor_documento_url']),
  validateSchema({ body: updateApplicantProfileSchema }),
  ApplicantController.updateMyProfile
);

// ==========================================
// ACADEMIC DEGREES DIRECT BY DEGREE ID
// (Must precede /:id to prevent matching 'degrees' as UUID)
// ==========================================

// Get degree by degreeId
applicantsRouter.get(
  '/degrees/:degreeId',
  requireAuth,
  requireRecordAccess('degree', 'degreeId', ['INSCRIPCION_VALIDAR']),
  validateSchema({ params: degreeIdParamSchema }),
  ApplicantController.getAcademicDegreeById
);

// Update degree by degreeId
applicantsRouter.put(
  '/degrees/:degreeId',
  requireAuth,
  requireRecordAccess('degree', 'degreeId', ['INSCRIPCION_VALIDAR']),
  degreeUploadFields,
  requireOwnedFileReferences(['titulo_pdf_url', 'certificado_rn_url']),
  validateSchema({ params: degreeIdParamSchema, body: updateAcademicDegreeSchema }),
  ApplicantController.updateAcademicDegree
);

// Delete degree by degreeId
applicantsRouter.delete(
  '/degrees/:degreeId',
  requireAuth,
  requireRecordAccess('degree', 'degreeId', ['INSCRIPCION_VALIDAR']),
  validateSchema({ params: degreeIdParamSchema }),
  ApplicantController.deleteAcademicDegree
);

// Validate/Reject degree (Administrative)
applicantsRouter.patch(
  '/degrees/:degreeId/validate',
  requireAuth,
  requirePermission('INSCRIPCION_VALIDAR'),
  validateSchema({ params: degreeIdParamSchema, body: validateAcademicDegreeSchema }),
  ApplicantController.validateAcademicDegree
);

// ==========================================
// APPLICANTS MANAGEMENT ROUTES
// ==========================================

// List applicants (Administrative review)
applicantsRouter.get(
  '/',
  requireAuth,
  requirePermission('INSCRIPCION_VALIDAR'),
  validateSchema({ query: listApplicantsQuerySchema }),
  ApplicantController.listProfiles
);

// Create new applicant profile (Student registration or Admin on behalf)
applicantsRouter.post(
  '/',
  requireAuth,
  profileUploadFields,
  requireOwnedFileReferences(['cedula_identidad_pdf_url', 'tutor_documento_url']),
  validateSchema({ body: createApplicantProfileSchema }),
  requireSelfAssignment,
  ApplicantController.createProfile
);

// Get applicant profile by ID
applicantsRouter.get(
  '/:id',
  requireAuth,
  requireRecordAccess('applicant', 'id', ['INSCRIPCION_VALIDAR']),
  validateSchema({ params: applicantIdParamSchema }),
  ApplicantController.getProfileById
);

// Update applicant profile by ID
applicantsRouter.put(
  '/:id',
  requireAuth,
  requireRecordAccess('applicant', 'id', ['INSCRIPCION_VALIDAR']),
  profileUploadFields,
  requireOwnedFileReferences(['cedula_identidad_pdf_url', 'tutor_documento_url']),
  validateSchema({ params: applicantIdParamSchema, body: updateApplicantProfileSchema }),
  ApplicantController.updateProfile
);

// Administrative verification of applicant identity (Art. 86 SETEC)
applicantsRouter.patch(
  '/:id/verify-identity',
  requireAuth,
  requirePermission('INSCRIPCION_VALIDAR'),
  validateSchema({ params: applicantIdParamSchema }),
  ApplicantController.verifyIdentity
);

// Replace applicant's declared interests in knowledge areas
applicantsRouter.put(
  '/:id/interests',
  requireAuth,
  requireRecordAccess('applicant', 'id', ['INSCRIPCION_VALIDAR']),
  validateSchema({ params: applicantIdParamSchema, body: replaceInterestsSchema }),
  ApplicantController.replaceInterests
);

// Get applicant's declared interests
applicantsRouter.get(
  '/:id/interests',
  requireAuth,
  requireRecordAccess('applicant', 'id', ['INSCRIPCION_VALIDAR']),
  validateSchema({ params: applicantIdParamSchema }),
  ApplicantController.getInterests
);

// Register a previous academic degree for an applicant
applicantsRouter.post(
  '/:id/degrees',
  requireAuth,
  requireRecordAccess('applicant', 'id', ['INSCRIPCION_VALIDAR']),
  degreeUploadFields,
  requireOwnedFileReferences(['titulo_pdf_url', 'certificado_rn_url']),
  validateSchema({ params: applicantIdParamSchema, body: createAcademicDegreeSchema }),
  ApplicantController.createAcademicDegree
);

// List academic degrees of an applicant
applicantsRouter.get(
  '/:id/degrees',
  requireAuth,
  requireRecordAccess('applicant', 'id', ['INSCRIPCION_VALIDAR']),
  validateSchema({ params: applicantIdParamSchema }),
  ApplicantController.listAcademicDegrees
);

export default applicantsRouter;
