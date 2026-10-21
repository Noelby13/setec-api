import { Request, Response, NextFunction } from 'express';
import { ProgramService } from './program.service';
import {
  CreateProgramInput,
  UpdateProgramInput,
  CreateComponenteInput,
  UpdateComponenteInput,
  AssignTagsInput,
  CatalogQueryInput,
} from './program.schema';
import { getRelativeUploadPath } from '../../middlewares/upload.middleware';

export class ProgramController {
  // ==========================================
  // PROGRAMAS ACADÉMICOS
  // ==========================================

  /**
   * List academic programs with optional filters.
   * GET /api/programs
   */
  static async listPrograms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { area_id, categoria, subtipo, estado_vigencia, visible_en_web, search } = req.query;

      const programs = await ProgramService.listPrograms({
        area_id: area_id as string | undefined,
        categoria: categoria as string | undefined,
        subtipo: subtipo as string | undefined,
        estado_vigencia: estado_vigencia as string | undefined,
        visible_en_web: visible_en_web !== undefined ? visible_en_web === 'true' : undefined,
        search: search as string | undefined,
      });

      res.status(200).json({
        success: true,
        data: programs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get academic program details by ID.
   * GET /api/programs/:id
   */
  static async getProgramById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const program = await ProgramService.getProgramById(id);

      res.status(200).json({
        success: true,
        data: program,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get academic program details by URL slug.
   * GET /api/programs/slug/:slug
   */
  static async getProgramBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = req.params.slug as string;
      const program = await ProgramService.getProgramBySlug(slug);

      res.status(200).json({
        success: true,
        data: program,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new academic program with optional file attachments (SETEC validation).
   * POST /api/programs
   */
  static async createProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateProgramInput;

      // Extract uploaded files if any
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFiles: {
        aval_minsa_url?: string;
        imagen_portada_url?: string;
        brochure_pdf_url?: string;
      } = {};

      if (files?.['aval_minsa']?.[0]) {
        uploadedFiles.aval_minsa_url = getRelativeUploadPath(files['aval_minsa'][0]);
      }
      if (files?.['imagen_portada']?.[0]) {
        uploadedFiles.imagen_portada_url = getRelativeUploadPath(files['imagen_portada'][0]);
      }
      if (files?.['brochure_pdf']?.[0]) {
        uploadedFiles.brochure_pdf_url = getRelativeUploadPath(files['brochure_pdf'][0]);
      }

      const program = await ProgramService.createProgram(body, uploadedFiles);

      res.status(201).json({
        success: true,
        message: 'Programa académico creado exitosamente',
        data: program,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an academic program.
   * PUT /api/programs/:id
   */
  static async updateProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateProgramInput;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFiles: {
        aval_minsa_url?: string;
        imagen_portada_url?: string;
        brochure_pdf_url?: string;
      } = {};

      if (files?.['aval_minsa']?.[0]) {
        uploadedFiles.aval_minsa_url = getRelativeUploadPath(files['aval_minsa'][0]);
      }
      if (files?.['imagen_portada']?.[0]) {
        uploadedFiles.imagen_portada_url = getRelativeUploadPath(files['imagen_portada'][0]);
      }
      if (files?.['brochure_pdf']?.[0]) {
        uploadedFiles.brochure_pdf_url = getRelativeUploadPath(files['brochure_pdf'][0]);
      }

      const program = await ProgramService.updateProgram(id, body, uploadedFiles);

      res.status(200).json({
        success: true,
        message: 'Programa académico actualizado exitosamente',
        data: program,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an academic program.
   * DELETE /api/programs/:id
   */
  static async deleteProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await ProgramService.deleteProgram(id);

      res.status(200).json({
        success: true,
        message: 'Programa académico eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign tags to a program.
   * POST /api/programs/:id/tags
   */
  static async assignTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as AssignTagsInput;
      await ProgramService.assignTags(id, body.tag_ids);

      res.status(200).json({
        success: true,
        message: 'Etiquetas asignadas al programa exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // COMPONENTES CURRICULARES (MALLA CURRICULAR)
  // ==========================================

  /**
   * List curricular components of a program ordered by orden_bloque.
   * GET /api/programs/:id/componentes
   */
  static async listComponentes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programaId = req.params.id as string;
      const componentes = await ProgramService.getComponentes(programaId);

      res.status(200).json({
        success: true,
        data: componentes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a curricular component in a program.
   * POST /api/programs/:id/componentes
   */
  static async createComponente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programaId = req.params.id as string;
      const body = req.body as CreateComponenteInput;

      let silaboPdfUrl: string | undefined = undefined;
      if (req.file) {
        silaboPdfUrl = getRelativeUploadPath(req.file);
      }

      const componente = await ProgramService.createComponente(programaId, body, silaboPdfUrl);

      res.status(201).json({
        success: true,
        message: 'Componente curricular agregado exitosamente a la malla',
        data: componente,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a curricular component.
   * PUT /api/programs/:id/componentes/:componenteId
   */
  static async updateComponente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programaId = req.params.id as string;
      const componenteId = req.params.componenteId as string;
      const body = req.body as UpdateComponenteInput;

      let silaboPdfUrl: string | undefined = undefined;
      if (req.file) {
        silaboPdfUrl = getRelativeUploadPath(req.file);
      }

      const componente = await ProgramService.updateComponente(
        programaId,
        componenteId,
        body,
        silaboPdfUrl
      );

      res.status(200).json({
        success: true,
        message: 'Componente curricular actualizado exitosamente',
        data: componente,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a curricular component.
   * DELETE /api/programs/:id/componentes/:componenteId
   */
  static async deleteComponente(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programaId = req.params.id as string;
      const componenteId = req.params.componenteId as string;
      await ProgramService.deleteComponente(programaId, componenteId);

      res.status(200).json({
        success: true,
        message: 'Componente curricular eliminado exitosamente de la malla',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CATÁLOGO PÚBLICO TIPO UDEMY
  // ==========================================

  /**
   * Public catalog showcase endpoint.
   * Returns active, visible programs with area, tags, full curriculum, and open cohorts.
   * GET /api/programs/catalog
   */
  static async getCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as CatalogQueryInput;
      const catalog = await ProgramService.getCatalog(query);

      res.status(200).json({
        success: true,
        count: catalog.length,
        data: catalog,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MOTOR DE RECOMENDACIONES
  // ==========================================

  /**
   * Recommendation engine endpoint for a registered applicant.
   * GET /api/programs/recommendations/:aspiranteId
   */
  static async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const aspiranteId = req.params.aspiranteId as string;
      const recommendations = await ProgramService.getRecommendations(aspiranteId);

      res.status(200).json({
        success: true,
        count: recommendations.length,
        data: recommendations,
      });
    } catch (error) {
      next(error);
    }
  }
}
