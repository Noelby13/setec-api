import { Request, Response, NextFunction } from 'express';
import { TaxonomyService } from './taxonomy.service';
import { CreateAreaInput, UpdateAreaInput, CreateTagInput, UpdateTagInput } from './taxonomy.schema';

export class TaxonomyController {
  // ==========================================
  // ÁREAS DE CONOCIMIENTO
  // ==========================================

  /**
   * List areas of knowledge.
   * Public endpoint for web catalog showcase.
   * GET /api/taxonomy/areas
   */
  static async listAreas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // By default list only active areas, allow ?all=true for administrative views
      const onlyActive = req.query.all !== 'true';
      const areas = await TaxonomyService.listAreas(onlyActive);

      res.status(200).json({
        success: true,
        data: areas,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get area of knowledge by ID.
   * GET /api/taxonomy/areas/:id
   */
  static async getAreaById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const area = await TaxonomyService.getAreaById(id);

      res.status(200).json({
        success: true,
        data: area,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new area of knowledge.
   * Protected: requireAuth, requirePermission('CATALOGO_GESTIONAR')
   * POST /api/taxonomy/areas
   */
  static async createArea(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateAreaInput;
      const area = await TaxonomyService.createArea(body);

      res.status(201).json({
        success: true,
        message: 'Área de conocimiento creada exitosamente',
        data: area,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an area of knowledge.
   * Protected: requireAuth, requirePermission('CATALOGO_GESTIONAR')
   * PUT /api/taxonomy/areas/:id
   */
  static async updateArea(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateAreaInput;
      const area = await TaxonomyService.updateArea(id, body);

      res.status(200).json({
        success: true,
        message: 'Área de conocimiento actualizada exitosamente',
        data: area,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an area of knowledge.
   * Protected: requireAuth, requirePermission('CATALOGO_GESTIONAR')
   * DELETE /api/taxonomy/areas/:id
   */
  static async deleteArea(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await TaxonomyService.deleteArea(id);

      res.status(200).json({
        success: true,
        message: 'Área de conocimiento eliminada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // TAGS ACADÉMICOS
  // ==========================================

  /**
   * List all academic tags.
   * Public endpoint for web showcase.
   * GET /api/taxonomy/tags
   */
  static async listTags(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tags = await TaxonomyService.listTags();

      res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get academic tag by ID.
   * GET /api/taxonomy/tags/:id
   */
  static async getTagById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const tag = await TaxonomyService.getTagById(id);

      res.status(200).json({
        success: true,
        data: tag,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new academic tag.
   * Protected: requireAuth, requirePermission('CATALOGO_GESTIONAR')
   * POST /api/taxonomy/tags
   */
  static async createTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateTagInput;
      const tag = await TaxonomyService.createTag(body);

      res.status(201).json({
        success: true,
        message: 'Tag académico creado exitosamente',
        data: tag,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an academic tag.
   * Protected: requireAuth, requirePermission('CATALOGO_GESTIONAR')
   * PUT /api/taxonomy/tags/:id
   */
  static async updateTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateTagInput;
      const tag = await TaxonomyService.updateTag(id, body);

      res.status(200).json({
        success: true,
        message: 'Tag académico actualizado exitosamente',
        data: tag,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an academic tag.
   * Protected: requireAuth, requirePermission('CATALOGO_GESTIONAR')
   * DELETE /api/taxonomy/tags/:id
   */
  static async deleteTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await TaxonomyService.deleteTag(id);

      res.status(200).json({
        success: true,
        message: 'Tag académico eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
}
