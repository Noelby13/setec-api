import { Request, Response, NextFunction } from 'express';
import { InfrastructureService } from './infrastructure.service';
import {
  CreateSedeInput,
  UpdateSedeInput,
  CreateDocenteInput,
  UpdateDocenteInput,
} from './infrastructure.schema';
import { getRelativeUploadPath } from '../../middlewares/upload.middleware';

export class InfrastructureController {
  // ==========================================
  // SEDES UNIVERSITARIAS
  // ==========================================

  /**
   * List university campuses.
   * GET /api/infrastructure/sedes
   */
  static async listSedes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const onlyActive = req.query.all !== 'true';
      const sedes = await InfrastructureService.listSedes(onlyActive);

      res.status(200).json({
        success: true,
        data: sedes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get campus details by ID.
   * GET /api/infrastructure/sedes/:id
   */
  static async getSedeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const sede = await InfrastructureService.getSedeById(id);

      res.status(200).json({
        success: true,
        data: sede,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new campus.
   * POST /api/infrastructure/sedes
   */
  static async createSede(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateSedeInput;
      const sede = await InfrastructureService.createSede(body);

      res.status(201).json({
        success: true,
        message: 'Sede universitaria registrada exitosamente',
        data: sede,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an existing campus.
   * PUT /api/infrastructure/sedes/:id
   */
  static async updateSede(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateSedeInput;
      const sede = await InfrastructureService.updateSede(id, body);

      res.status(200).json({
        success: true,
        message: 'Sede universitaria actualizada exitosamente',
        data: sede,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a campus.
   * DELETE /api/infrastructure/sedes/:id
   */
  static async deleteSede(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await InfrastructureService.deleteSede(id);

      res.status(200).json({
        success: true,
        message: 'Sede universitaria eliminada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PERSONAL ACADÉMICO / DOCENTES
  // ==========================================

  /**
   * List academic staff.
   * GET /api/infrastructure/docentes
   */
  static async listDocentes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const onlyActive = req.query.all !== 'true';
      const docentes = await InfrastructureService.listDocentes(onlyActive);

      res.status(200).json({
        success: true,
        data: docentes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get academic staff details by ID.
   * GET /api/infrastructure/docentes/:id
   */
  static async getDocenteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const docente = await InfrastructureService.getDocenteById(id);

      res.status(200).json({
        success: true,
        data: docente,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create an academic staff member with file uploads.
   * POST /api/infrastructure/docentes
   */
  static async createDocente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateDocenteInput;

      // Extract uploaded files from Multer
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const fotoFile = files?.['foto_perfil']?.[0];
      const cvFile = files?.['cv_pdf']?.[0];

      const uploadedFiles = {
        foto_perfil_url: fotoFile ? getRelativeUploadPath(fotoFile) : undefined,
        cv_url: cvFile ? getRelativeUploadPath(cvFile) : undefined,
      };

      const docente = await InfrastructureService.createDocente(body, uploadedFiles);

      res.status(201).json({
        success: true,
        message: 'Personal académico registrado exitosamente',
        data: docente,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an academic staff member with optional file uploads.
   * PUT /api/infrastructure/docentes/:id
   */
  static async updateDocente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateDocenteInput;

      // Extract uploaded files from Multer
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const fotoFile = files?.['foto_perfil']?.[0];
      const cvFile = files?.['cv_pdf']?.[0];

      const uploadedFiles = {
        foto_perfil_url: fotoFile ? getRelativeUploadPath(fotoFile) : undefined,
        cv_url: cvFile ? getRelativeUploadPath(cvFile) : undefined,
      };

      const docente = await InfrastructureService.updateDocente(id, body, uploadedFiles);

      res.status(200).json({
        success: true,
        message: 'Personal académico actualizado exitosamente',
        data: docente,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an academic staff member.
   * DELETE /api/infrastructure/docentes/:id
   */
  static async deleteDocente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await InfrastructureService.deleteDocente(id);

      res.status(200).json({
        success: true,
        message: 'Personal académico eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
}
