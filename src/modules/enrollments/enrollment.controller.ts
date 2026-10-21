import { Request, Response, NextFunction } from 'express';
import {
  EnrollmentService,
  UploadedEnrollmentFiles,
  UploadedPaymentFiles,
  UploadedConvalidationFiles,
} from './enrollment.service';
import {
  CreateEnrollmentInput,
  ValidateDocumentsInput,
  CreatePaymentInput,
  ValidatePaymentInput,
  CreateConvalidationInput,
  DictamenConvalidationInput,
  ListEnrollmentsQueryInput,
} from './enrollment.schema';
import { getRelativeUploadPath } from '../../middlewares/upload.middleware';
import { AppError } from '../../middlewares/error.middleware';

export class EnrollmentController {
  // ==========================================
  // INSCRIPCIONES
  // ==========================================

  /**
   * Register a new enrollment.
   * POST /api/enrollments
   */
  static async createEnrollment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateEnrollmentInput;

      // Extract uploaded ponencia file if provided
      const uploadedFiles: UploadedEnrollmentFiles = {};
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = req.file as Express.Multer.File | undefined;

      const ponenciaFile =
        file || files?.['archivo_ponencia']?.[0] || files?.['archivo_ponencia_url']?.[0];
      if (ponenciaFile) {
        uploadedFiles.archivo_ponencia_url = getRelativeUploadPath(ponenciaFile);
      }

      const currentUserId = req.user?.id;
      const result = await EnrollmentService.createEnrollment(body, uploadedFiles, currentUserId);

      res.status(201).json({
        success: true,
        message: 'Inscripción registrada exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Administrative Document and Quorum Validation.
   * PATCH /api/enrollments/:id/validate-documents
   */
  static async validateDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as ValidateDocumentsInput;

      const result = await EnrollmentService.validateDocuments(id, body);

      res.status(200).json({
        success: true,
        message: body.aprobado
          ? 'Documentos validados y estado de inscripción actualizado exitosamente'
          : 'Documentación observada registrada exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List enrollments with filters and pagination.
   * GET /api/enrollments
   */
  static async listEnrollments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListEnrollmentsQueryInput;
      const result = await EnrollmentService.listEnrollments(query);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get enrollments for the currently authenticated student.
   * GET /api/enrollments/me
   */
  static async getMyEnrollments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const result = await EnrollmentService.getMyEnrollments(req.user.id);

      res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed enrollment by ID (including payments and convalidations).
   * GET /api/enrollments/:id
   */
  static async getEnrollmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await EnrollmentService.getEnrollmentById(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PAGOS Y CAJA
  // ==========================================

  /**
   * Register a payment voucher or cash receipt for an enrollment.
   * POST /api/enrollments/:id/payments
   */
  static async registerPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as CreatePaymentInput;

      // Extract uploaded baucher file
      const uploadedFiles: UploadedPaymentFiles = {};
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = req.file as Express.Multer.File | undefined;

      const baucherFile =
        file ||
        files?.['comprobante_baucher']?.[0] ||
        files?.['comprobante_baucher_url']?.[0] ||
        files?.['baucher']?.[0];

      if (baucherFile) {
        uploadedFiles.comprobante_baucher_url = getRelativeUploadPath(baucherFile);
      }

      const result = await EnrollmentService.registerPayment(id, body, uploadedFiles);

      res.status(201).json({
        success: true,
        message: 'Comprobante de pago registrado exitosamente en revisión',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cashier / Admin approves or rejects a registered payment.
   * PATCH /api/enrollments/payments/:paymentId/validate
   */
  static async validatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentId = req.params.paymentId as string;
      const body = req.body as ValidatePaymentInput;

      if (!req.user?.id) {
        throw new AppError('Usuario autenticado no identificado', 401);
      }

      const result = await EnrollmentService.validatePayment(paymentId, body, req.user.id);

      res.status(200).json({
        success: true,
        message:
          body.estado === 'APROBADO'
            ? 'Pago aprobado y matrícula formalizada exitosamente'
            : 'Pago rechazado exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payments for a specific enrollment.
   * GET /api/enrollments/:id/payments
   */
  static async getPaymentsByEnrollment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const payments = await EnrollmentService.getPaymentsByEnrollment(id);

      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CONVALIDACIONES
  // ==========================================

  /**
   * Request convalidation / credit recognition for an enrollment.
   * POST /api/enrollments/:id/convalidations
   */
  static async requestConvalidation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as CreateConvalidationInput;

      // Extract uploaded certificate file
      const uploadedFiles: UploadedConvalidationFiles = {};
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = req.file as Express.Multer.File | undefined;

      const certFile =
        file ||
        files?.['certificado_origen']?.[0] ||
        files?.['certificado_origen_url']?.[0];

      if (certFile) {
        uploadedFiles.certificado_origen_url = getRelativeUploadPath(certFile);
      }

      const result = await EnrollmentService.requestConvalidation(id, body, uploadedFiles);

      res.status(201).json({
        success: true,
        message: 'Solicitud de convalidación registrada exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Coordinator emits resolution on a convalidation request.
   * PATCH /api/enrollments/convalidations/:convalidationId/dictamen
   */
  static async dictamenConvalidation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const convalidationId = req.params.convalidationId as string;
      const body = req.body as DictamenConvalidationInput;

      if (!req.user?.id) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const result = await EnrollmentService.dictamenConvalidation(
        convalidationId,
        body,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: `Solicitud de convalidación ${body.estado_dictamen.toLowerCase()} exitosamente`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get convalidations for a specific enrollment.
   * GET /api/enrollments/:id/convalidations
   */
  static async getConvalidationsByEnrollment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const convalidations = await EnrollmentService.getConvalidationsByEnrollment(id);

      res.status(200).json({
        success: true,
        data: convalidations,
      });
    } catch (error) {
      next(error);
    }
  }
}
