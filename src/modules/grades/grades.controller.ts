import { Request, Response, NextFunction } from 'express';
import { GradesService } from './grades.service';
import { ModifyGradeInput } from './grades.schema';
import { getRelativeUploadPath } from '../../middlewares/upload.middleware';
import { AppError } from '../../middlewares/error.middleware';

export class GradesController {
  /**
   * Import Grades via Excel (.xlsx) file.
   * POST /api/grades/import/:programacionComponenteId
   */
  static async importGradesExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programacionComponenteId = req.params.programacionComponenteId as string;
      const file = req.file;

      if (!file) {
        throw new AppError('Debe adjuntar un archivo Excel (.xlsx) en el campo "archivo_excel"', 400);
      }

      const relativeUrl = getRelativeUploadPath(file);
      const currentUserId = req.user!.id;
      const observaciones = req.body?.observaciones as string | undefined;

      const result = await GradesService.importGradesFromExcel(
        programacionComponenteId,
        file.path,
        relativeUrl,
        currentUserId,
        observaciones
      );

      res.status(201).json({
        success: true,
        message: `Acta de calificaciones procesada. Registros actualizados: ${result.total_registros_procesados}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manual Grade Modification with Mandatory Justification & Audit Trail.
   * PATCH /api/grades/:matriculaComponenteId
   */
  static async modifyGrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matriculaComponenteId = req.params.matriculaComponenteId as string;
      const body = req.body as ModifyGradeInput;
      const currentUserId = req.user!.id;

      const result = await GradesService.modifyGradeManually(
        matriculaComponenteId,
        body,
        currentUserId
      );

      res.status(200).json({
        success: true,
        message: 'Calificación modificada exitosamente y registrada en auditoría de notas',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all grades for a modular course schedule.
   * GET /api/grades/component/:programacionComponenteId
   */
  static async getGradesByComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programacionComponenteId = req.params.programacionComponenteId as string;
      const grades = await GradesService.getGradesByComponent(programacionComponenteId);

      res.status(200).json({
        success: true,
        data: grades,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get student transcript / kardex by enrollment ID.
   * GET /api/grades/student/:inscripcionId
   */
  static async getGradesByStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inscripcionId = req.params.inscripcionId as string;
      const grades = await GradesService.getGradesByInscripcion(inscripcionId);

      res.status(200).json({
        success: true,
        data: grades,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * View modification audit logs for a single grade.
   * GET /api/grades/:matriculaComponenteId/logs
   */
  static async getGradeLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matriculaComponenteId = req.params.matriculaComponenteId as string;
      const logs = await GradesService.getGradeLogs(matriculaComponenteId);

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all Excel import lots for a scheduled component.
   * GET /api/grades/lots/:programacionComponenteId
   */
  static async getImportLots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programacionComponenteId = req.params.programacionComponenteId as string;
      const lots = await GradesService.getImportLots(programacionComponenteId);

      res.status(200).json({
        success: true,
        data: lots,
      });
    } catch (error) {
      next(error);
    }
  }
}
