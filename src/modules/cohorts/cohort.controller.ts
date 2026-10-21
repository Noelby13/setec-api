import { Request, Response, NextFunction } from 'express';
import { CohortService } from './cohort.service';
import {
  CreateCohorteInput,
  UpdateCohorteInput,
  ProgramarComponenteInput,
  UpdateProgramacionInput,
  CohorteQueryInput,
} from './cohort.schema';
import { getRelativeUploadPath } from '../../middlewares/upload.middleware';

export class CohortController {
  // ==========================================
  // COHORTES DE APERTURA
  // ==========================================

  /**
   * List cohorts with optional filters.
   * GET /api/cohorts
   */
  static async listCohortes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as CohorteQueryInput;
      const cohorts = await CohortService.listCohortes({
        programa_id: query.programa_id,
        sede_id: query.sede_id,
        modalidad: query.modalidad,
        estado_cohorte: query.estado_cohorte,
        search: query.search,
      });

      res.status(200).json({
        success: true,
        count: cohorts.length,
        data: cohorts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get cohort details by ID.
   * GET /api/cohorts/:id
   */
  static async getCohorteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const cohort = await CohortService.getCohorteById(id);

      res.status(200).json({
        success: true,
        data: cohort,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new cohort.
   * POST /api/cohorts
   */
  static async createCohorte(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateCohorteInput;

      let excepcionCupoUrl: string | undefined = undefined;
      if (req.file) {
        excepcionCupoUrl = getRelativeUploadPath(req.file);
      }

      const cohort = await CohortService.createCohorte(body, excepcionCupoUrl);

      res.status(201).json({
        success: true,
        message: 'Cohorte de apertura planificada exitosamente',
        data: cohort,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a cohort.
   * PUT /api/cohorts/:id
   */
  static async updateCohorte(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateCohorteInput;

      let excepcionCupoUrl: string | undefined = undefined;
      if (req.file) {
        excepcionCupoUrl = getRelativeUploadPath(req.file);
      }

      const cohort = await CohortService.updateCohorte(id, body, excepcionCupoUrl);

      res.status(200).json({
        success: true,
        message: 'Cohorte de apertura actualizada exitosamente',
        data: cohort,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a cohort.
   * DELETE /api/cohorts/:id
   */
  static async deleteCohorte(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await CohortService.deleteCohorte(id);

      res.status(200).json({
        success: true,
        message: 'Cohorte eliminada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PROGRAMACIÓN MODULAR DE DOCENTES POR COHORTE
  // ==========================================

  /**
   * List course module scheduling for a cohort.
   * GET /api/cohorts/:id/componentes
   */
  static async listProgramacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohorteId = req.params.id as string;
      const programacion = await CohortService.listProgramacionByCohorte(cohorteId);

      res.status(200).json({
        success: true,
        data: programacion,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Program a curriculum component with assigned professor, dates, and classroom.
   * POST /api/cohorts/:id/componentes
   */
  static async programarComponente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohorteId = req.params.id as string;
      const body = req.body as ProgramarComponenteInput;

      const programacion = await CohortService.programarComponente(cohorteId, body);

      res.status(201).json({
        success: true,
        message: 'Docente y módulo programados exitosamente en la cohorte',
        data: programacion,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update component scheduling in a cohort.
   * PUT /api/cohorts/:id/componentes/:componenteId
   */
  static async updateProgramacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohorteId = req.params.id as string;
      const componenteId = req.params.componenteId as string;
      const body = req.body as UpdateProgramacionInput;

      const programacion = await CohortService.updateProgramacion(cohorteId, componenteId, body);

      res.status(200).json({
        success: true,
        message: 'Programación del módulo actualizada exitosamente',
        data: programacion,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove component scheduling from a cohort.
   * DELETE /api/cohorts/:id/componentes/:componenteId
   */
  static async deleteProgramacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohorteId = req.params.id as string;
      const componenteId = req.params.componenteId as string;

      await CohortService.deleteProgramacion(cohorteId, componenteId);

      res.status(200).json({
        success: true,
        message: 'Programación del módulo eliminada exitosamente de la cohorte',
      });
    } catch (error) {
      next(error);
    }
  }
}
