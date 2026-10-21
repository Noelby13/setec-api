import { TaxonomyDao, AreaConocimiento, TagAcademico } from './taxonomy.dao';
import { CreateAreaInput, UpdateAreaInput, CreateTagInput, UpdateTagInput } from './taxonomy.schema';
import { AppError } from '../../middlewares/error.middleware';
import { slugify } from '../../utils/slugify';

export class TaxonomyService {
  // ==========================================
  // ÁREAS DE CONOCIMIENTO
  // ==========================================

  /**
   * List areas of knowledge. Defaults to only active for public showcase.
   */
  static async listAreas(onlyActive = true): Promise<AreaConocimiento[]> {
    return TaxonomyDao.listAreas(onlyActive);
  }

  /**
   * Get an area by its UUID.
   */
  static async getAreaById(id: string): Promise<AreaConocimiento> {
    const area = await TaxonomyDao.findAreaById(id);
    if (!area) {
      throw new AppError('Área de conocimiento no encontrada', 404);
    }
    return area;
  }

  /**
   * Create a new area of knowledge with slug generation and duplicate checks.
   */
  static async createArea(input: CreateAreaInput): Promise<AreaConocimiento> {
    const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.nombre);

    // Check unique name
    const existingByName = await TaxonomyDao.findAreaByNombre(input.nombre);
    if (existingByName) {
      throw new AppError(`Ya existe un área de conocimiento con el nombre "${input.nombre}"`, 409);
    }

    // Check unique slug
    const existingBySlug = await TaxonomyDao.findAreaBySlug(slug);
    if (existingBySlug) {
      throw new AppError(`Ya existe un área de conocimiento con el slug "${slug}"`, 409);
    }

    return TaxonomyDao.createArea({
      nombre: input.nombre.trim(),
      slug,
      icono_url: input.icono_url?.trim() || null,
      activa: input.activa ?? true,
    });
  }

  /**
   * Update an existing area of knowledge.
   */
  static async updateArea(id: string, input: UpdateAreaInput): Promise<AreaConocimiento> {
    const currentArea = await TaxonomyDao.findAreaById(id);
    if (!currentArea) {
      throw new AppError('Área de conocimiento no encontrada', 404);
    }

    let slugToUpdate: string | undefined = undefined;
    if (input.slug !== undefined) {
      slugToUpdate = slugify(input.slug);
    } else if (input.nombre !== undefined && input.nombre !== currentArea.nombre) {
      slugToUpdate = slugify(input.nombre);
    }

    // Uniqueness checks if name changed
    if (input.nombre && input.nombre.toLowerCase() !== currentArea.nombre.toLowerCase()) {
      const existingByName = await TaxonomyDao.findAreaByNombre(input.nombre);
      if (existingByName && existingByName.id !== id) {
        throw new AppError(`Ya existe otra área de conocimiento con el nombre "${input.nombre}"`, 409);
      }
    }

    // Uniqueness check if slug changed
    if (slugToUpdate && slugToUpdate !== currentArea.slug) {
      const existingBySlug = await TaxonomyDao.findAreaBySlug(slugToUpdate);
      if (existingBySlug && existingBySlug.id !== id) {
        throw new AppError(`Ya existe otra área de conocimiento con el slug "${slugToUpdate}"`, 409);
      }
    }

    const updated = await TaxonomyDao.updateArea(id, {
      nombre: input.nombre?.trim(),
      slug: slugToUpdate,
      icono_url: input.icono_url !== undefined ? (input.icono_url?.trim() || null) : undefined,
      activa: input.activa,
    });

    if (!updated) {
      throw new AppError('No se pudo actualizar el área de conocimiento', 500);
    }

    return updated;
  }

  /**
   * Delete an area of knowledge by ID.
   */
  static async deleteArea(id: string): Promise<void> {
    const area = await TaxonomyDao.findAreaById(id);
    if (!area) {
      throw new AppError('Área de conocimiento no encontrada', 404);
    }

    try {
      const deleted = await TaxonomyDao.deleteArea(id);
      if (!deleted) {
        throw new AppError('No se pudo eliminar el área de conocimiento', 500);
      }
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new AppError(
          'No se puede eliminar el área porque está vinculada a programas académicos existentes',
          409
        );
      }
      throw error;
    }
  }

  // ==========================================
  // TAGS ACADÉMICOS
  // ==========================================

  /**
   * List all academic tags.
   */
  static async listTags(): Promise<TagAcademico[]> {
    return TaxonomyDao.listTags();
  }

  /**
   * Get an academic tag by ID.
   */
  static async getTagById(id: string): Promise<TagAcademico> {
    const tag = await TaxonomyDao.findTagById(id);
    if (!tag) {
      throw new AppError('Tag académico no encontrado', 404);
    }
    return tag;
  }

  /**
   * Create an academic tag.
   */
  static async createTag(input: CreateTagInput): Promise<TagAcademico> {
    const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.nombre);

    const existingByName = await TaxonomyDao.findTagByNombre(input.nombre);
    if (existingByName) {
      throw new AppError(`Ya existe un tag académico con el nombre "${input.nombre}"`, 409);
    }

    const existingBySlug = await TaxonomyDao.findTagBySlug(slug);
    if (existingBySlug) {
      throw new AppError(`Ya existe un tag académico con el slug "${slug}"`, 409);
    }

    return TaxonomyDao.createTag({
      nombre: input.nombre.trim(),
      slug,
    });
  }

  /**
   * Update an academic tag.
   */
  static async updateTag(id: string, input: UpdateTagInput): Promise<TagAcademico> {
    const currentTag = await TaxonomyDao.findTagById(id);
    if (!currentTag) {
      throw new AppError('Tag académico no encontrado', 404);
    }

    let slugToUpdate: string | undefined = undefined;
    if (input.slug !== undefined) {
      slugToUpdate = slugify(input.slug);
    } else if (input.nombre !== undefined && input.nombre !== currentTag.nombre) {
      slugToUpdate = slugify(input.nombre);
    }

    if (input.nombre && input.nombre.toLowerCase() !== currentTag.nombre.toLowerCase()) {
      const existingByName = await TaxonomyDao.findTagByNombre(input.nombre);
      if (existingByName && existingByName.id !== id) {
        throw new AppError(`Ya existe otro tag académico con el nombre "${input.nombre}"`, 409);
      }
    }

    if (slugToUpdate && slugToUpdate !== currentTag.slug) {
      const existingBySlug = await TaxonomyDao.findTagBySlug(slugToUpdate);
      if (existingBySlug && existingBySlug.id !== id) {
        throw new AppError(`Ya existe otro tag académico con el slug "${slugToUpdate}"`, 409);
      }
    }

    const updated = await TaxonomyDao.updateTag(id, {
      nombre: input.nombre?.trim(),
      slug: slugToUpdate,
    });

    if (!updated) {
      throw new AppError('No se pudo actualizar el tag académico', 500);
    }

    return updated;
  }

  /**
   * Delete an academic tag.
   */
  static async deleteTag(id: string): Promise<void> {
    const tag = await TaxonomyDao.findTagById(id);
    if (!tag) {
      throw new AppError('Tag académico no encontrado', 404);
    }

    try {
      const deleted = await TaxonomyDao.deleteTag(id);
      if (!deleted) {
        throw new AppError('No se pudo eliminar el tag académico', 500);
      }
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new AppError(
          'No se puede eliminar el tag porque está asignado a programas académicos existentes',
          409
        );
      }
      throw error;
    }
  }
}
