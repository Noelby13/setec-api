import {
  ProgramDao,
  ProgramRecord,
  ProgramDetailRecord,
  ProgramCatalogItem,
  ProgramRecommendationItem,
  ComponenteRecord,
  CreateProgramData,
  UpdateProgramData,
  CreateComponenteData,
  UpdateComponenteData,
  ProgramFilter,
  CatalogFilter,
} from './program.dao';
import {
  CreateProgramInput,
  UpdateProgramInput,
  CreateComponenteInput,
  UpdateComponenteInput,
} from './program.schema';
import { AppError } from '../../middlewares/error.middleware';
import { slugify } from '../../utils/slugify';
import { pool } from '../../db/pool';
import { SubtipoPrograma } from '../../types/enums';

export class ProgramService {
  // ==========================================
  // PROGRAMAS ACADÉMICOS
  // ==========================================

  /**
   * Create an academic program applying SETEC normative rules:
   * a) If es_ciencias_salud === true, aval_minsa_url is mandatory.
   * b) If subtipo is DOCTORADO_LICENCIATURA or DOCTORADO_MAESTRIA, force estructurado_por_cursos = false.
   * c) If subtipo === 'DOCTORADO_LICENCIATURA', require programa_salida_intermedia_id.
   */
  static async createProgram(
    input: CreateProgramInput,
    uploadedFiles?: {
      aval_minsa_url?: string;
      imagen_portada_url?: string;
      brochure_pdf_url?: string;
    }
  ): Promise<ProgramRecord> {
    const avalMinsaUrl = uploadedFiles?.aval_minsa_url || input.aval_minsa_url;
    const imagenPortadaUrl = uploadedFiles?.imagen_portada_url || input.imagen_portada_url;
    const brochurePdfUrl = uploadedFiles?.brochure_pdf_url || input.brochure_pdf_url;

    // Normative Rule a: Ciencias de la Salud requires MINSA endorsement (Art. SETEC)
    if (input.es_ciencias_salud && !avalMinsaUrl) {
      throw new AppError(
        'Los programas del área de Ciencias de la Salud requieren obligatoriamente el aval del Ministerio de Salud (aval_minsa_url o documento adjunto)',
        400
      );
    }

    // Determine estructurado_por_cursos
    let estructuradoPorCursos = input.estructurado_por_cursos ?? true;
    // Normative Rule b: Doctorates cannot be structured by standard courses (doctoral research tutoring)
    if (
      input.subtipo === SubtipoPrograma.DOCTORADO_LICENCIATURA ||
      input.subtipo === SubtipoPrograma.DOCTORADO_MAESTRIA
    ) {
      estructuradoPorCursos = false;
    }

    // Normative Rule c: Direct Doctorate from Bachelor's requires an intermediate exit degree (e.g. Master)
    if (input.subtipo === SubtipoPrograma.DOCTORADO_LICENCIATURA) {
      if (!input.programa_salida_intermedia_id) {
        throw new AppError(
          'El Doctorado con ingreso desde Licenciatura exige por normativa SETEC definir un programa de salida intermedia con titulación de maestría (programa_salida_intermedia_id)',
          400
        );
      }
    }

    // Validate existence of Area de Conocimiento
    const areaCheck = await pool.query(
      'SELECT id, activa FROM areas_conocimiento WHERE id = $1;',
      [input.area_conocimiento_id]
    );
    if (areaCheck.rows.length === 0) {
      throw new AppError('El área de conocimiento especificada no existe', 404);
    }
    if (!areaCheck.rows[0].activa) {
      throw new AppError('El área de conocimiento especificada se encuentra inactiva', 400);
    }

    // Validate intermediate exit program if supplied
    if (input.programa_salida_intermedia_id) {
      const exitProg = await pool.query(
        'SELECT id, nombre FROM programas_academicos WHERE id = $1;',
        [input.programa_salida_intermedia_id]
      );
      if (exitProg.rows.length === 0) {
        throw new AppError('El programa de salida intermedia especificado no existe', 404);
      }
    }

    // Validate accredited destination program if supplied
    if (input.programa_destino_acreditable_id) {
      const destProg = await pool.query(
        'SELECT id, nombre FROM programas_academicos WHERE id = $1;',
        [input.programa_destino_acreditable_id]
      );
      if (destProg.rows.length === 0) {
        throw new AppError('El programa destino acreditable especificado no existe', 404);
      }
    }

    // Check unique internal code
    const existingCode = await ProgramDao.findByCodigoInterno(input.codigo_interno);
    if (existingCode) {
      throw new AppError(
        `Ya existe un programa académico registrado con el código interno "${input.codigo_interno.toUpperCase()}"`,
        409
      );
    }

    // Generate and ensure unique slug
    let finalSlug = input.slug ? slugify(input.slug) : slugify(input.nombre);
    const existingSlug = await ProgramDao.findBySlug(finalSlug);
    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
    }

    const data: CreateProgramData = {
      ...input,
      slug: finalSlug,
      estructurado_por_cursos: estructuradoPorCursos,
      aval_minsa_url: avalMinsaUrl || null,
      imagen_portada_url: imagenPortadaUrl || null,
      brochure_pdf_url: brochurePdfUrl || null,
    };

    return ProgramDao.create(data, input.tag_ids || []);
  }

  /**
   * Get complete program details by UUID.
   */
  static async getProgramById(id: string): Promise<ProgramDetailRecord> {
    const program = await ProgramDao.findById(id);
    if (!program) {
      throw new AppError('Programa académico no encontrado', 404);
    }
    return program;
  }

  /**
   * Get complete program details by slug.
   */
  static async getProgramBySlug(slug: string): Promise<ProgramDetailRecord> {
    const program = await ProgramDao.findBySlug(slug);
    if (!program) {
      throw new AppError(`No se encontró ningún programa académico con el slug "${slug}"`, 404);
    }
    return program;
  }

  /**
   * List academic programs.
   */
  static async listPrograms(filter: ProgramFilter = {}): Promise<ProgramDetailRecord[]> {
    return ProgramDao.list(filter);
  }

  /**
   * Update an academic program enforcing SETEC rules.
   */
  static async updateProgram(
    id: string,
    input: UpdateProgramInput,
    uploadedFiles?: {
      aval_minsa_url?: string;
      imagen_portada_url?: string;
      brochure_pdf_url?: string;
    }
  ): Promise<ProgramRecord> {
    const current = await ProgramDao.findById(id);
    if (!current) {
      throw new AppError('Programa académico no encontrado', 404);
    }

    const isSalud = input.es_ciencias_salud !== undefined ? input.es_ciencias_salud : current.es_ciencias_salud;
    const avalMinsa = uploadedFiles?.aval_minsa_url || input.aval_minsa_url || current.aval_minsa_url;

    // Normative Rule a
    if (isSalud && !avalMinsa) {
      throw new AppError(
        'Los programas del área de Ciencias de la Salud requieren obligatoriamente el aval de MINSA (aval_minsa_url)',
        400
      );
    }

    const targetSubtipo = input.subtipo || current.subtipo;
    let estructuradoPorCursos =
      input.estructurado_por_cursos !== undefined
        ? input.estructurado_por_cursos
        : current.estructurado_por_cursos;

    // Normative Rule b
    if (
      targetSubtipo === SubtipoPrograma.DOCTORADO_LICENCIATURA ||
      targetSubtipo === SubtipoPrograma.DOCTORADO_MAESTRIA
    ) {
      estructuradoPorCursos = false;
    }

    // Normative Rule c
    if (targetSubtipo === SubtipoPrograma.DOCTORADO_LICENCIATURA) {
      const exitId =
        input.programa_salida_intermedia_id !== undefined
          ? input.programa_salida_intermedia_id
          : current.programa_salida_intermedia_id;
      if (!exitId) {
        throw new AppError(
          'El Doctorado con ingreso desde Licenciatura exige por normativa SETEC un programa de salida intermedia (programa_salida_intermedia_id)',
          400
        );
      }
    }

    // Check slug collision if changing
    if (input.slug && input.slug !== current.slug) {
      const slugCheck = await ProgramDao.findBySlug(input.slug);
      if (slugCheck && slugCheck.id !== id) {
        throw new AppError(`El slug "${input.slug}" ya está en uso por otro programa académico`, 409);
      }
    }

    // Check code collision if changing
    if (input.codigo_interno && input.codigo_interno !== current.codigo_interno) {
      const codeCheck = await ProgramDao.findByCodigoInterno(input.codigo_interno);
      if (codeCheck && codeCheck.id !== id) {
        throw new AppError(
          `El código interno "${input.codigo_interno.toUpperCase()}" ya está en uso por otro programa académico`,
          409
        );
      }
    }

    const data: UpdateProgramData = {
      ...input,
      estructurado_por_cursos: estructuradoPorCursos,
      ...(uploadedFiles?.aval_minsa_url ? { aval_minsa_url: uploadedFiles.aval_minsa_url } : {}),
      ...(uploadedFiles?.imagen_portada_url ? { imagen_portada_url: uploadedFiles.imagen_portada_url } : {}),
      ...(uploadedFiles?.brochure_pdf_url ? { brochure_pdf_url: uploadedFiles.brochure_pdf_url } : {}),
    };

    const updated = await ProgramDao.update(id, data, input.tag_ids);
    if (!updated) {
      throw new AppError('Error al actualizar el programa académico', 500);
    }
    return updated;
  }

  /**
   * Delete an academic program.
   */
  static async deleteProgram(id: string): Promise<void> {
    const program = await ProgramDao.findById(id);
    if (!program) {
      throw new AppError('Programa académico no encontrado', 404);
    }

    // Check if cohorts exist for this program
    const cohortsCheck = await pool.query(
      'SELECT COUNT(*)::int AS count FROM cohortes_apertura WHERE programa_id = $1;',
      [id]
    );
    if (cohortsCheck.rows[0].count > 0) {
      throw new AppError(
        'No se puede eliminar el programa académico porque cuenta con cohortes de apertura registradas',
        400
      );
    }

    await ProgramDao.delete(id);
  }

  /**
   * Assign tags to an academic program.
   */
  static async assignTags(programaId: string, tagIds: string[]): Promise<void> {
    const program = await ProgramDao.findById(programaId);
    if (!program) {
      throw new AppError('Programa académico no encontrado', 404);
    }
    await ProgramDao.assignTags(programaId, tagIds);
  }

  // ==========================================
  // COMPONENTES CURRICULARES (MALLA CURRICULAR)
  // ==========================================

  /**
   * Add a curricular component to a program.
   */
  static async createComponente(
    programaId: string,
    input: CreateComponenteInput,
    silaboPdfUrl?: string
  ): Promise<ComponenteRecord> {
    const program = await ProgramDao.findById(programaId);
    if (!program) {
      throw new AppError('Programa académico no encontrado', 404);
    }

    // Check if codigo already exists in this program
    const existing = await ProgramDao.getComponenteByCodigo(programaId, input.codigo);
    if (existing) {
      throw new AppError(
        `Ya existe una asignatura/módulo con el código "${input.codigo}" en este programa`,
        409
      );
    }

    const data: CreateComponenteData = {
      ...input,
      url_silabo_pdf: silaboPdfUrl || input.url_silabo_pdf || null,
    };

    return ProgramDao.createComponente(programaId, data);
  }

  /**
   * List curricular components for a program.
   */
  static async getComponentes(programaId: string): Promise<ComponenteRecord[]> {
    const program = await ProgramDao.findById(programaId);
    if (!program) {
      throw new AppError('Programa académico no encontrado', 404);
    }
    return ProgramDao.getComponentesByProgramaId(programaId);
  }

  /**
   * Update a curricular component.
   */
  static async updateComponente(
    programaId: string,
    componenteId: string,
    input: UpdateComponenteInput,
    silaboPdfUrl?: string
  ): Promise<ComponenteRecord> {
    const componente = await ProgramDao.getComponenteById(componenteId);
    if (!componente || componente.programa_id !== programaId) {
      throw new AppError('Componente curricular no encontrado en este programa académico', 404);
    }

    if (input.codigo && input.codigo !== componente.codigo) {
      const existing = await ProgramDao.getComponenteByCodigo(programaId, input.codigo);
      if (existing && existing.id !== componenteId) {
        throw new AppError(
          `El código "${input.codigo}" ya está asignado a otro módulo de este programa`,
          409
        );
      }
    }

    const data: UpdateComponenteData = {
      ...input,
      ...(silaboPdfUrl ? { url_silabo_pdf: silaboPdfUrl } : {}),
    };

    const updated = await ProgramDao.updateComponente(componenteId, data);
    if (!updated) {
      throw new AppError('Error al actualizar el componente curricular', 500);
    }
    return updated;
  }

  /**
   * Delete a curricular component.
   */
  static async deleteComponente(programaId: string, componenteId: string): Promise<void> {
    const componente = await ProgramDao.getComponenteById(componenteId);
    if (!componente || componente.programa_id !== programaId) {
      throw new AppError('Componente curricular no encontrado en este programa académico', 404);
    }

    // Check if component has cohort programming
    const progCheck = await pool.query(
      'SELECT COUNT(*)::int AS count FROM programacion_componentes_cohorte WHERE componente_id = $1;',
      [componenteId]
    );
    if (progCheck.rows[0].count > 0) {
      throw new AppError(
        'No se puede eliminar el componente curricular porque se encuentra programado en una o más cohortes',
        400
      );
    }

    await ProgramDao.deleteComponente(componenteId);
  }

  // ==========================================
  // CATÁLOGO PÚBLICO TIPO UDEMY
  // ==========================================

  /**
   * Public showcase catalog of active visible programs.
   */
  static async getCatalog(filter: CatalogFilter = {}): Promise<ProgramCatalogItem[]> {
    return ProgramDao.getCatalog(filter);
  }

  // ==========================================
  // MOTOR DE RECOMENDACIONES
  // ==========================================

  /**
   * Get intelligent recommendations for an aspirante based on their declared interests,
   * previous university degrees, and creditable programs.
   */
  static async getRecommendations(aspiranteId: string): Promise<ProgramRecommendationItem[]> {
    // Verify aspirante exists
    const aspiranteCheck = await pool.query(
      'SELECT id, nombres, apellidos FROM personas_aspirantes WHERE id = $1;',
      [aspiranteId]
    );
    if (aspiranteCheck.rows.length === 0) {
      throw new AppError('Aspirante no encontrado en el sistema', 404);
    }

    return ProgramDao.getRecommendationsForAspirante(aspiranteId);
  }
}
