import { Request, Response, NextFunction } from 'express';
import {
  ApplicantService,
  UploadedProfileFiles,
  UploadedDegreeFiles,
} from './applicant.service';
import {
  CreateApplicantProfileInput,
  UpdateApplicantProfileInput,
  ReplaceInterestsInput,
  CreateAcademicDegreeInput,
  UpdateAcademicDegreeInput,
  ValidateAcademicDegreeInput,
  ListApplicantsQueryInput,
} from './applicant.schema';
import { getRelativeUploadPath } from '../../middlewares/upload.middleware';
import { AppError } from '../../middlewares/error.middleware';

export class ApplicantController {
  // ==========================================
  // PERFIL DE ASPIRANTE
  // ==========================================

  /**
   * Create a new applicant profile with document uploads.
   * POST /api/applicants
   */
  static async createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateApplicantProfileInput;

      // Extract uploaded files if provided via multipart/form-data
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFiles: UploadedProfileFiles = {};

      const cedulaFile =
        files?.['cedula_identidad_pdf']?.[0] || files?.['cedula_identidad_pdf_url']?.[0];
      if (cedulaFile) {
        uploadedFiles.cedula_identidad_pdf_url = getRelativeUploadPath(cedulaFile);
      }

      const tutorFile =
        files?.['tutor_documento']?.[0] || files?.['tutor_documento_url']?.[0];
      if (tutorFile) {
        uploadedFiles.tutor_documento_url = getRelativeUploadPath(tutorFile);
      }

      // If usuario_id is not explicitly provided in body, bind to authenticated user
      if (!body.usuario_id && req.user?.id) {
        body.usuario_id = req.user.id;
      }

      const profile = await ApplicantService.createProfile(body, uploadedFiles);

      res.status(201).json({
        success: true,
        message: 'Perfil de aspirante registrado exitosamente',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update applicant profile.
   * PUT /api/applicants/:id
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateApplicantProfileInput;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFiles: UploadedProfileFiles = {};

      const cedulaFile =
        files?.['cedula_identidad_pdf']?.[0] || files?.['cedula_identidad_pdf_url']?.[0];
      if (cedulaFile) {
        uploadedFiles.cedula_identidad_pdf_url = getRelativeUploadPath(cedulaFile);
      }

      const tutorFile =
        files?.['tutor_documento']?.[0] || files?.['tutor_documento_url']?.[0];
      if (tutorFile) {
        uploadedFiles.tutor_documento_url = getRelativeUploadPath(tutorFile);
      }

      const updated = await ApplicantService.updateProfile(id, body, uploadedFiles);

      res.status(200).json({
        success: true,
        message: 'Perfil de aspirante actualizado exitosamente',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get currently authenticated user's applicant profile.
   * GET /api/applicants/me
   */
  static async getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profile = await ApplicantService.getProfileByUsuarioId(usuarioId);
      if (!profile) {
        throw new AppError('Aún no has completado tu perfil de aspirante', 404);
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update currently authenticated user's applicant profile.
   * PUT /api/applicants/me
   */
  static async updateMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const currentProfile = await ApplicantService.getProfileByUsuarioId(usuarioId);
      if (!currentProfile) {
        throw new AppError('Aún no has registrado tu perfil de aspirante', 404);
      }

      const body = req.body as UpdateApplicantProfileInput;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFiles: UploadedProfileFiles = {};

      const cedulaFile =
        files?.['cedula_identidad_pdf']?.[0] || files?.['cedula_identidad_pdf_url']?.[0];
      if (cedulaFile) {
        uploadedFiles.cedula_identidad_pdf_url = getRelativeUploadPath(cedulaFile);
      }

      const tutorFile =
        files?.['tutor_documento']?.[0] || files?.['tutor_documento_url']?.[0];
      if (tutorFile) {
        uploadedFiles.tutor_documento_url = getRelativeUploadPath(tutorFile);
      }

      const updated = await ApplicantService.updateProfile(currentProfile.id, body, uploadedFiles);

      res.status(200).json({
        success: true,
        message: 'Tu perfil de aspirante ha sido actualizado',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get applicant profile by ID.
   * GET /api/applicants/:id
   */
  static async getProfileById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const profile = await ApplicantService.getProfileById(id);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List applicant profiles with administrative filters.
   * GET /api/applicants
   */
  static async listProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as ListApplicantsQueryInput;
      const profiles = await ApplicantService.listProfiles({
        identidad_verificada: query.identidad_verificada,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });

      res.status(200).json({
        success: true,
        count: profiles.length,
        data: profiles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Administrative verification of identity (Art. 86 / Estudiante.isVerificado V2).
   * PATCH /api/applicants/:id/verify-identity
   */
  static async verifyIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const verificadoPorUsuarioId = req.user?.id;
      if (!verificadoPorUsuarioId) {
        throw new AppError('Usuario administrador no autenticado', 401);
      }

      const verified = await ApplicantService.verifyIdentity(id, verificadoPorUsuarioId);

      res.status(200).json({
        success: true,
        message: 'Identidad del aspirante verificada administrativamente',
        data: verified,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // INTERESES EN ÁREAS DE CONOCIMIENTO
  // ==========================================

  /**
   * Replace declared interests for an applicant.
   * PUT /api/applicants/:id/interests
   */
  static async replaceInterests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as ReplaceInterestsInput;

      const interests = await ApplicantService.replaceInterests(id, body.area_conocimiento_ids);

      res.status(200).json({
        success: true,
        message: 'Intereses del aspirante actualizados exitosamente',
        data: interests,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get declared interests of an applicant.
   * GET /api/applicants/:id/interests
   */
  static async getInterests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const interests = await ApplicantService.getInterests(id);

      res.status(200).json({
        success: true,
        data: interests,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // TÍTULOS ACADÉMICOS PREVIOS (CRUD & VALIDACIÓN)
  // ==========================================

  /**
   * Register a new academic degree for an applicant.
   * POST /api/applicants/:id/degrees
   */
  static async createAcademicDegree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const aspiranteId = req.params.id as string;
      const body = req.body as CreateAcademicDegreeInput;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFiles: UploadedDegreeFiles = {};

      const tituloFile =
        files?.['titulo_pdf']?.[0] || files?.['titulo_pdf_url']?.[0];
      if (tituloFile) {
        uploadedFiles.titulo_pdf_url = getRelativeUploadPath(tituloFile);
      }

      const rnFile =
        files?.['certificado_rn']?.[0] || files?.['certificado_rn_url']?.[0];
      if (rnFile) {
        uploadedFiles.certificado_rn_url = getRelativeUploadPath(rnFile);
      }

      const degree = await ApplicantService.createAcademicDegree(
        aspiranteId,
        body,
        uploadedFiles
      );

      res.status(201).json({
        success: true,
        message: 'Título académico registrado exitosamente',
        data: degree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all academic degrees of an applicant.
   * GET /api/applicants/:id/degrees
   */
  static async listAcademicDegrees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const aspiranteId = req.params.id as string;
      const degrees = await ApplicantService.listAcademicDegrees(aspiranteId);

      res.status(200).json({
        success: true,
        count: degrees.length,
        data: degrees,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get an academic degree by ID.
   * GET /api/applicants/degrees/:degreeId
   */
  static async getAcademicDegreeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const degreeId = req.params.degreeId as string;
      const degree = await ApplicantService.getAcademicDegreeById(degreeId);

      res.status(200).json({
        success: true,
        data: degree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an academic degree.
   * PUT /api/applicants/degrees/:degreeId
   */
  static async updateAcademicDegree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const degreeId = req.params.degreeId as string;
      const body = req.body as UpdateAcademicDegreeInput;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFiles: UploadedDegreeFiles = {};

      const tituloFile =
        files?.['titulo_pdf']?.[0] || files?.['titulo_pdf_url']?.[0];
      if (tituloFile) {
        uploadedFiles.titulo_pdf_url = getRelativeUploadPath(tituloFile);
      }

      const rnFile =
        files?.['certificado_rn']?.[0] || files?.['certificado_rn_url']?.[0];
      if (rnFile) {
        uploadedFiles.certificado_rn_url = getRelativeUploadPath(rnFile);
      }

      const updated = await ApplicantService.updateAcademicDegree(
        degreeId,
        body,
        uploadedFiles
      );

      res.status(200).json({
        success: true,
        message: 'Título académico actualizado exitosamente',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an academic degree.
   * DELETE /api/applicants/degrees/:degreeId
   */
  static async deleteAcademicDegree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const degreeId = req.params.degreeId as string;
      await ApplicantService.deleteAcademicDegree(degreeId);

      res.status(200).json({
        success: true,
        message: 'Título académico eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change administrative validation status of an academic degree.
   * PATCH /api/applicants/degrees/:degreeId/validate
   */
  static async validateAcademicDegree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const degreeId = req.params.degreeId as string;
      const body = req.body as ValidateAcademicDegreeInput;
      const usuarioValidadorId = req.user?.id;

      if (!usuarioValidadorId) {
        throw new AppError('Usuario validador no autenticado', 401);
      }

      const validated = await ApplicantService.validateAcademicDegree(
        degreeId,
        body,
        usuarioValidadorId
      );

      res.status(200).json({
        success: true,
        message: `Estado de validación del título actualizado a '${body.estado_validacion}'`,
        data: validated,
      });
    } catch (error) {
      next(error);
    }
  }
}
