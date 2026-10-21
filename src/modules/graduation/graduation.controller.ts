import { Request, Response, NextFunction } from 'express';
import { GraduationService, UploadedExpedienteFiles } from './graduation.service';
import {
  CreateExpedienteInput,
  UpdateExpedienteInput,
  CreatePublicationInput,
  ValidatePublicationInput,
  IssueDocumentInput,
} from './graduation.schema';
import { getRelativeUploadPath } from '../../middlewares/upload.middleware';
import { AppError } from '../../middlewares/error.middleware';

export class GraduationController {
  /**
   * Create or initialize a student graduation dossier.
   * POST /api/graduation/expediente
   */
  static async createExpediente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateExpedienteInput;
      const uploadedFiles: UploadedExpedienteFiles = {};
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = req.file as Express.Multer.File | undefined;

      const idiomaFile = file || files?.['certificado_idioma']?.[0] || files?.['certificado_idioma_url']?.[0];
      if (idiomaFile) uploadedFiles.certificado_idioma_url = getRelativeUploadPath(idiomaFile);

      const defensaFile = files?.['acta_defensa']?.[0] || files?.['acta_defensa_url']?.[0];
      if (defensaFile) uploadedFiles.acta_defensa_url = getRelativeUploadPath(defensaFile);

      const intermedioFile = files?.['titulo_intermedio']?.[0] || files?.['titulo_intermedio_emitido_url']?.[0];
      if (intermedioFile) uploadedFiles.titulo_intermedio_emitido_url = getRelativeUploadPath(intermedioFile);

      const result = await GraduationService.createExpediente(body, uploadedFiles);

      res.status(201).json({
        success: true,
        message: 'Expediente de graduación creado exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get graduation dossier by primary ID.
   * GET /api/graduation/expediente/:id
   */
  static async getExpedienteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await GraduationService.getExpedienteById(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get graduation dossier by student enrollment ID (inscripcion_id).
   * GET /api/graduation/enrollment/:inscripcionId
   */
  static async getExpedienteByInscripcionId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const inscripcionId = req.params.inscripcionId as string;
      const result = await GraduationService.getExpedienteByInscripcionId(inscripcionId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update graduation dossier.
   * PATCH /api/graduation/expediente/:id
   */
  static async updateExpediente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateExpedienteInput;
      const uploadedFiles: UploadedExpedienteFiles = {};
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = req.file as Express.Multer.File | undefined;

      const idiomaFile = file || files?.['certificado_idioma']?.[0] || files?.['certificado_idioma_url']?.[0];
      if (idiomaFile) uploadedFiles.certificado_idioma_url = getRelativeUploadPath(idiomaFile);

      const defensaFile = files?.['acta_defensa']?.[0] || files?.['acta_defensa_url']?.[0];
      if (defensaFile) uploadedFiles.acta_defensa_url = getRelativeUploadPath(defensaFile);

      const intermedioFile = files?.['titulo_intermedio']?.[0] || files?.['titulo_intermedio_emitido_url']?.[0];
      if (intermedioFile) uploadedFiles.titulo_intermedio_emitido_url = getRelativeUploadPath(intermedioFile);

      const result = await GraduationService.updateExpediente(id, body, uploadedFiles);

      res.status(200).json({
        success: true,
        message: 'Expediente de graduación actualizado exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register a new scientific publication for an academic dossier.
   * POST /api/graduation/expediente/:expedienteId/publications
   */
  static async addScientificPublication(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const expedienteId = req.params.expedienteId as string;
      const body = req.body as CreatePublicationInput;
      const file = req.file;

      if (!file) {
        throw new AppError('Debe adjuntar el archivo PDF de la publicación en el campo "evidencia_pdf"', 400);
      }

      const evidenciaPdfUrl = getRelativeUploadPath(file);
      const result = await GraduationService.addScientificPublication(
        expedienteId,
        body,
        evidenciaPdfUrl
      );

      res.status(201).json({
        success: true,
        message: 'Publicación científica registrada exitosamente en el expediente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all scientific publications registered for an academic dossier.
   * GET /api/graduation/expediente/:expedienteId/publications
   */
  static async getPublicationsByExpediente(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const expedienteId = req.params.expedienteId as string;
      const publications = await GraduationService.getPublicationsByExpediente(expedienteId);

      res.status(200).json({
        success: true,
        data: publications,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate or reject student scientific publication.
   * PATCH /api/graduation/publications/:publicationId/validate
   */
  static async validateScientificPublication(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const publicationId = req.params.publicationId as string;
      const { validado_coordinacion } = req.body as ValidatePublicationInput;

      const result = await GraduationService.validateScientificPublication(
        publicationId,
        validado_coordinacion
      );

      res.status(200).json({
        success: true,
        message: `Publicación científica ${validado_coordinacion ? 'validada' : 'observada/rechazada'} exitosamente`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Issue final degree or certificate after validating all academic requirements.
   * POST /api/graduation/expediente/:id/issue
   */
  static async issueGraduationDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as IssueDocumentInput;
      const file = req.file;
      const currentUserId = req.user!.id;

      let uploadedDocUrl: string | undefined = undefined;
      if (file) {
        uploadedDocUrl = getRelativeUploadPath(file);
      }

      const result = await GraduationService.issueGraduationDocument(
        id,
        body,
        uploadedDocUrl,
        currentUserId
      );

      res.status(200).json({
        success: true,
        message: `Título o certificado emitido exitosamente. Código de Registro: ${result.codigo_registro}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public QR or code verification of issued degrees and certificates.
   * GET /api/graduation/verify/:codigoRegistro
   */
  static async verifyGraduationCode(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const codigoRegistro = req.params.codigoRegistro as string;
      const result = await GraduationService.verifyGraduationCode(codigoRegistro);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
