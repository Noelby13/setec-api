import { pool, DbClient, withTransaction } from '../../db/pool';

export interface ProgramRecord {
  id: string;
  codigo_interno: string;
  codigo_dictamen_setec: string | null;
  fecha_aprobacion_setec: string | null;
  nombre: string;
  slug: string;
  categoria: string;
  subtipo: string;
  area_conocimiento_id: string;
  resumen_corto_web: string | null;
  descripcion_comercial: string | null;
  imagen_portada_url: string | null;
  video_promo_url: string | null;
  brochure_pdf_url: string | null;
  precio_total_referencia: number | string;
  descuento_porcentaje: number;
  visible_en_web: boolean;
  es_ciencias_salud: boolean;
  aval_minsa_url: string | null;
  duracion_meses: number | string | null;
  horas_totales: number;
  creditos_totales: number;
  creditos_investigacion: number;
  permite_continuidad_doctorado: boolean;
  programa_salida_intermedia_id: string | null;
  programa_destino_acreditable_id: string | null;
  es_acreditable_a_posgrado: boolean;
  estructurado_por_cursos: boolean;
  requiere_titulo_grado_rn: boolean;
  requiere_titulo_profesional: boolean;
  permite_menores_edad: boolean;
  idioma_egreso_requerido: string;
  num_publicaciones_requeridas: number;
  requiere_revista_indexada: boolean;
  requiere_pares_evaluadores: boolean;
  titulo_o_certificado_otorgado: string;
  abreviatura_grado: string | null;
  estado_vigencia: string;
  created_at: string;
}

export interface TagInfo {
  id: string;
  nombre: string;
  slug: string;
}

export interface AreaInfo {
  id: string;
  nombre: string;
  slug: string;
  icono_url: string | null;
}

export interface ComponenteRecord {
  id: string;
  programa_id: string;
  codigo: string;
  nombre: string;
  descripcion_temario: string | null;
  orden_bloque: number;
  horas: number;
  creditos: number;
  es_investigacion: boolean;
  es_modalidad_graduacion: boolean;
  es_practica_profesional: boolean;
  costo_base_asignatura: number | string;
  url_silabo_pdf: string | null;
}

export interface ProgramDetailRecord extends ProgramRecord {
  area_conocimiento?: AreaInfo;
  tags?: TagInfo[];
  componentes?: ComponenteRecord[];
}

export interface CreateProgramData {
  codigo_interno: string;
  codigo_dictamen_setec?: string | null;
  fecha_aprobacion_setec?: string | null;
  nombre: string;
  slug: string;
  categoria: string;
  subtipo: string;
  area_conocimiento_id: string;
  resumen_corto_web?: string | null;
  descripcion_comercial?: string | null;
  imagen_portada_url?: string | null;
  video_promo_url?: string | null;
  brochure_pdf_url?: string | null;
  precio_total_referencia?: number;
  descuento_porcentaje?: number;
  visible_en_web?: boolean;
  es_ciencias_salud?: boolean;
  aval_minsa_url?: string | null;
  duracion_meses?: number | null;
  horas_totales: number;
  creditos_totales?: number;
  creditos_investigacion?: number;
  permite_continuidad_doctorado?: boolean;
  programa_salida_intermedia_id?: string | null;
  programa_destino_acreditable_id?: string | null;
  es_acreditable_a_posgrado?: boolean;
  estructurado_por_cursos?: boolean;
  requiere_titulo_grado_rn?: boolean;
  requiere_titulo_profesional?: boolean;
  permite_menores_edad?: boolean;
  idioma_egreso_requerido?: string;
  num_publicaciones_requeridas?: number;
  requiere_revista_indexada?: boolean;
  requiere_pares_evaluadores?: boolean;
  titulo_o_certificado_otorgado: string;
  abreviatura_grado?: string | null;
  estado_vigencia?: string;
}

export interface UpdateProgramData extends Partial<CreateProgramData> {}

export interface CreateComponenteData {
  codigo: string;
  nombre: string;
  descripcion_temario?: string | null;
  orden_bloque?: number;
  horas: number;
  creditos?: number;
  es_investigacion?: boolean;
  es_modalidad_graduacion?: boolean;
  es_practica_profesional?: boolean;
  costo_base_asignatura?: number;
  url_silabo_pdf?: string | null;
}

export interface UpdateComponenteData extends Partial<CreateComponenteData> {}

export interface ProgramFilter {
  area_id?: string;
  categoria?: string;
  subtipo?: string;
  estado_vigencia?: string;
  visible_en_web?: boolean;
  search?: string;
}

export interface CatalogFilter {
  area_id?: string;
  categoria?: string;
  subtipo?: string;
  search?: string;
}

export interface ProgramCatalogItem extends ProgramRecord {
  area_conocimiento: AreaInfo;
  tags: TagInfo[];
  malla_curricular: ComponenteRecord[];
  cohortes_abiertas: Array<{
    id: string;
    codigo_cohorte: string;
    numero_edicion: number;
    modalidad: string;
    sede_id: string;
    sede_nombre: string;
    fecha_inicio_inscripcion: string;
    fecha_fin_inscripcion: string;
    fecha_inicio_clases: string;
    fecha_fin_clases: string;
    horario_general: string | null;
    precio_matricula: number;
    precio_total_cohorte: number;
    descuento_porcentaje: number;
    cupo_minimo: number;
    cupo_maximo: number;
    cupos_actuales_verificados: number;
    cobro_habilitado: boolean;
    estado_cohorte: string;
  }>;
}

export interface ProgramRecommendationItem extends ProgramRecord {
  area_nombre: string;
  area_slug: string;
  area_icono_url: string | null;
  score_relevancia: number;
  motivos_match: string[];
  tags: TagInfo[];
  total_cohortes_abiertas: number;
}

export class ProgramDao {
  // ==========================================
  // PROGRAMAS ACADÉMICOS CRUD
  // ==========================================

  /**
   * Insert a new academic program and optionally link tags in a transaction.
   */
  static async create(
    data: CreateProgramData,
    tagIds: string[] = [],
    db: DbClient = pool
  ): Promise<ProgramRecord> {
    const execute = async (client: DbClient) => {
      const query = `
        INSERT INTO programas_academicos (
          codigo_interno, codigo_dictamen_setec, fecha_aprobacion_setec,
          nombre, slug, categoria, subtipo, area_conocimiento_id,
          resumen_corto_web, descripcion_comercial, imagen_portada_url, video_promo_url, brochure_pdf_url,
          precio_total_referencia, descuento_porcentaje, visible_en_web,
          es_ciencias_salud, aval_minsa_url, duracion_meses, horas_totales, creditos_totales, creditos_investigacion,
          permite_continuidad_doctorado, programa_salida_intermedia_id, programa_destino_acreditable_id,
          es_acreditable_a_posgrado, estructurado_por_cursos,
          requiere_titulo_grado_rn, requiere_titulo_profesional, permite_menores_edad,
          idioma_egreso_requerido, num_publicaciones_requeridas, requiere_revista_indexada, requiere_pares_evaluadores,
          titulo_o_certificado_otorgado, abreviatura_grado, estado_vigencia
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20, $21, $22,
          $23, $24, $25,
          $26, $27,
          $28, $29, $30,
          $31, $32, $33, $34,
          $35, $36, $37
        )
        RETURNING *;
      `;

      const values = [
        data.codigo_interno,
        data.codigo_dictamen_setec || null,
        data.fecha_aprobacion_setec || null,
        data.nombre,
        data.slug,
        data.categoria,
        data.subtipo,
        data.area_conocimiento_id,
        data.resumen_corto_web || null,
        data.descripcion_comercial || null,
        data.imagen_portada_url || null,
        data.video_promo_url || null,
        data.brochure_pdf_url || null,
        data.precio_total_referencia ?? 0,
        data.descuento_porcentaje ?? 0,
        data.visible_en_web ?? false,
        data.es_ciencias_salud ?? false,
        data.aval_minsa_url || null,
        data.duracion_meses || null,
        data.horas_totales,
        data.creditos_totales ?? 0,
        data.creditos_investigacion ?? 0,
        data.permite_continuidad_doctorado ?? false,
        data.programa_salida_intermedia_id || null,
        data.programa_destino_acreditable_id || null,
        data.es_acreditable_a_posgrado ?? false,
        data.estructurado_por_cursos ?? true,
        data.requiere_titulo_grado_rn ?? false,
        data.requiere_titulo_profesional ?? false,
        data.permite_menores_edad ?? false,
        data.idioma_egreso_requerido || 'NINGUNO',
        data.num_publicaciones_requeridas ?? 0,
        data.requiere_revista_indexada ?? false,
        data.requiere_pares_evaluadores ?? false,
        data.titulo_o_certificado_otorgado,
        data.abreviatura_grado || null,
        data.estado_vigencia || 'ACTIVO',
      ];

      const res = await client.query<ProgramRecord>(query, values);
      const program = res.rows[0];

      if (tagIds && tagIds.length > 0) {
        await ProgramDao.assignTags(program.id, tagIds, client);
      }

      return program;
    };

    if ('connect' in db) {
      return withTransaction(execute);
    }
    return execute(db);
  }

  /**
   * Find a program by its UUID with area details and tags.
   */
  static async findById(id: string, db: DbClient = pool): Promise<ProgramDetailRecord | null> {
    const query = `
      SELECT 
        p.*,
        json_build_object(
          'id', a.id,
          'nombre', a.nombre,
          'slug', a.slug,
          'icono_url', a.icono_url
        ) AS area_conocimiento,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug))
            FROM programas_tags pt
            JOIN tags_academicos t ON pt.tag_id = t.id
            WHERE pt.programa_id = p.id
          ),
          '[]'::json
        ) AS tags,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', c.id,
                'codigo', c.codigo,
                'nombre', c.nombre,
                'descripcion_temario', c.descripcion_temario,
                'orden_bloque', c.orden_bloque,
                'horas', c.horas,
                'creditos', c.creditos,
                'es_investigacion', c.es_investigacion,
                'es_modalidad_graduacion', c.es_modalidad_graduacion,
                'es_practica_profesional', c.es_practica_profesional,
                'costo_base_asignatura', c.costo_base_asignatura,
                'url_silabo_pdf', c.url_silabo_pdf
              ) ORDER BY c.orden_bloque ASC, c.codigo ASC
            )
            FROM componentes_curriculares c
            WHERE c.programa_id = p.id
          ),
          '[]'::json
        ) AS componentes
      FROM programas_academicos p
      JOIN areas_conocimiento a ON p.area_conocimiento_id = a.id
      WHERE p.id = $1
      LIMIT 1;
    `;

    const res = await db.query<ProgramDetailRecord>(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Find a program by its public slug.
   */
  static async findBySlug(slug: string, db: DbClient = pool): Promise<ProgramDetailRecord | null> {
    const query = `
      SELECT 
        p.*,
        json_build_object(
          'id', a.id,
          'nombre', a.nombre,
          'slug', a.slug,
          'icono_url', a.icono_url
        ) AS area_conocimiento,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug))
            FROM programas_tags pt
            JOIN tags_academicos t ON pt.tag_id = t.id
            WHERE pt.programa_id = p.id
          ),
          '[]'::json
        ) AS tags,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', c.id,
                'codigo', c.codigo,
                'nombre', c.nombre,
                'descripcion_temario', c.descripcion_temario,
                'orden_bloque', c.orden_bloque,
                'horas', c.horas,
                'creditos', c.creditos,
                'es_investigacion', c.es_investigacion,
                'es_modalidad_graduacion', c.es_modalidad_graduacion,
                'es_practica_profesional', c.es_practica_profesional,
                'costo_base_asignatura', c.costo_base_asignatura,
                'url_silabo_pdf', c.url_silabo_pdf
              ) ORDER BY c.orden_bloque ASC, c.codigo ASC
            )
            FROM componentes_curriculares c
            WHERE c.programa_id = p.id
          ),
          '[]'::json
        ) AS componentes
      FROM programas_academicos p
      JOIN areas_conocimiento a ON p.area_conocimiento_id = a.id
      WHERE p.slug = $1
      LIMIT 1;
    `;

    const res = await db.query<ProgramDetailRecord>(query, [slug]);
    return res.rows[0] || null;
  }

  /**
   * Find program by internal code.
   */
  static async findByCodigoInterno(
    codigo: string,
    db: DbClient = pool
  ): Promise<ProgramRecord | null> {
    const query = `
      SELECT * FROM programas_academicos WHERE codigo_interno = $1 LIMIT 1;
    `;
    const res = await db.query<ProgramRecord>(query, [codigo]);
    return res.rows[0] || null;
  }

  /**
   * List programs with optional filtering.
   */
  static async list(
    filter: ProgramFilter = {},
    db: DbClient = pool
  ): Promise<ProgramDetailRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter.area_id) {
      conditions.push(`p.area_conocimiento_id = $${idx++}`);
      values.push(filter.area_id);
    }

    if (filter.categoria) {
      conditions.push(`p.categoria = $${idx++}`);
      values.push(filter.categoria);
    }

    if (filter.subtipo) {
      conditions.push(`p.subtipo = $${idx++}`);
      values.push(filter.subtipo);
    }

    if (filter.estado_vigencia) {
      conditions.push(`p.estado_vigencia = $${idx++}`);
      values.push(filter.estado_vigencia);
    }

    if (filter.visible_en_web !== undefined) {
      conditions.push(`p.visible_en_web = $${idx++}`);
      values.push(filter.visible_en_web);
    }

    if (filter.search) {
      conditions.push(`(p.nombre ILIKE $${idx} OR p.codigo_interno ILIKE $${idx} OR p.slug ILIKE $${idx})`);
      values.push(`%${filter.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        p.*,
        json_build_object(
          'id', a.id,
          'nombre', a.nombre,
          'slug', a.slug,
          'icono_url', a.icono_url
        ) AS area_conocimiento,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug))
            FROM programas_tags pt
            JOIN tags_academicos t ON pt.tag_id = t.id
            WHERE pt.programa_id = p.id
          ),
          '[]'::json
        ) AS tags
      FROM programas_academicos p
      JOIN areas_conocimiento a ON p.area_conocimiento_id = a.id
      ${whereClause}
      ORDER BY p.nombre ASC;
    `;

    const res = await db.query<ProgramDetailRecord>(query, values);
    return res.rows;
  }

  /**
   * Update an existing program and update tags if provided.
   */
  static async update(
    id: string,
    data: UpdateProgramData,
    tagIds?: string[],
    db: DbClient = pool
  ): Promise<ProgramRecord | null> {
    const execute = async (client: DbClient) => {
      const keys = Object.keys(data) as Array<keyof UpdateProgramData>;
      if (keys.length === 0 && tagIds === undefined) {
        return (await ProgramDao.findById(id, client)) as ProgramRecord | null;
      }

      let updatedRecord: ProgramRecord | null = null;

      if (keys.length > 0) {
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const key of keys) {
          setClauses.push(`${key} = $${idx++}`);
          values.push(data[key]);
        }

        values.push(id);
        const query = `
          UPDATE programas_academicos
          SET ${setClauses.join(', ')}
          WHERE id = $${idx}
          RETURNING *;
        `;

        const res = await client.query<ProgramRecord>(query, values);
        updatedRecord = res.rows[0] || null;
      } else {
        const res = await client.query<ProgramRecord>(
          'SELECT * FROM programas_academicos WHERE id = $1;',
          [id]
        );
        updatedRecord = res.rows[0] || null;
      }

      if (updatedRecord && tagIds !== undefined) {
        await ProgramDao.assignTags(id, tagIds, client);
      }

      return updatedRecord;
    };

    if ('connect' in db) {
      return withTransaction(execute);
    }
    return execute(db);
  }

  /**
   * Delete an academic program.
   */
  static async delete(id: string, db: DbClient = pool): Promise<boolean> {
    const execute = async (client: DbClient) => {
      // First delete associated tags
      await client.query('DELETE FROM programas_tags WHERE programa_id = $1;', [id]);
      // Delete curriculum components
      await client.query('DELETE FROM componentes_curriculares WHERE programa_id = $1;', [id]);
      // Delete program
      const res = await client.query('DELETE FROM programas_academicos WHERE id = $1 RETURNING id;', [id]);
      return (res.rowCount ?? 0) > 0;
    };

    if ('connect' in db) {
      return withTransaction(execute);
    }
    return execute(db);
  }

  // ==========================================
  // PROGRAMAS TAGS ASIGNACIÓN
  // ==========================================

  /**
   * Replace all tags assigned to a program inside a transaction.
   */
  static async assignTags(
    programaId: string,
    tagIds: string[],
    db: DbClient = pool
  ): Promise<void> {
    const execute = async (client: DbClient) => {
      await client.query('DELETE FROM programas_tags WHERE programa_id = $1;', [programaId]);

      if (tagIds.length > 0) {
        const uniqueTagIds = Array.from(new Set(tagIds));
        const values: any[] = [];
        const valuePlaceholders = uniqueTagIds
          .map((tagId, index) => {
            const p1 = index * 2 + 1;
            const p2 = index * 2 + 2;
            values.push(programaId, tagId);
            return `($${p1}, $${p2})`;
          })
          .join(', ');

        const insertQuery = `
          INSERT INTO programas_tags (programa_id, tag_id)
          VALUES ${valuePlaceholders}
          ON CONFLICT DO NOTHING;
        `;
        await client.query(insertQuery, values);
      }
    };

    if ('connect' in db) {
      return withTransaction(execute);
    }
    return execute(db);
  }

  /**
   * Get tags assigned to a program.
   */
  static async getTags(programaId: string, db: DbClient = pool): Promise<TagInfo[]> {
    const query = `
      SELECT t.id, t.nombre, t.slug
      FROM tags_academicos t
      JOIN programas_tags pt ON pt.tag_id = t.id
      WHERE pt.programa_id = $1
      ORDER BY t.nombre ASC;
    `;
    const res = await db.query<TagInfo>(query, [programaId]);
    return res.rows;
  }

  // ==========================================
  // COMPONENTES CURRICULARES (MALLA CURRICULAR)
  // ==========================================

  /**
   * Insert a new curricular component into a program.
   */
  static async createComponente(
    programaId: string,
    data: CreateComponenteData,
    db: DbClient = pool
  ): Promise<ComponenteRecord> {
    const query = `
      INSERT INTO componentes_curriculares (
        programa_id, codigo, nombre, descripcion_temario,
        orden_bloque, horas, creditos,
        es_investigacion, es_modalidad_graduacion, es_practica_profesional,
        costo_base_asignatura, url_silabo_pdf
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12
      )
      RETURNING *;
    `;

    const values = [
      programaId,
      data.codigo,
      data.nombre,
      data.descripcion_temario || null,
      data.orden_bloque ?? 1,
      data.horas,
      data.creditos ?? 0,
      data.es_investigacion ?? false,
      data.es_modalidad_graduacion ?? false,
      data.es_practica_profesional ?? false,
      data.costo_base_asignatura ?? 0,
      data.url_silabo_pdf || null,
    ];

    const res = await db.query<ComponenteRecord>(query, values);
    return res.rows[0];
  }

  /**
   * List curricular components for a program ordered by orden_bloque ASC.
   */
  static async getComponentesByProgramaId(
    programaId: string,
    db: DbClient = pool
  ): Promise<ComponenteRecord[]> {
    const query = `
      SELECT *
      FROM componentes_curriculares
      WHERE programa_id = $1
      ORDER BY orden_bloque ASC, codigo ASC;
    `;
    const res = await db.query<ComponenteRecord>(query, [programaId]);
    return res.rows;
  }

  /**
   * Find a single curricular component by ID.
   */
  static async getComponenteById(
    id: string,
    db: DbClient = pool
  ): Promise<ComponenteRecord | null> {
    const query = `
      SELECT * FROM componentes_curriculares WHERE id = $1 LIMIT 1;
    `;
    const res = await db.query<ComponenteRecord>(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Find component by program ID and unique course code.
   */
  static async getComponenteByCodigo(
    programaId: string,
    codigo: string,
    db: DbClient = pool
  ): Promise<ComponenteRecord | null> {
    const query = `
      SELECT * FROM componentes_curriculares 
      WHERE programa_id = $1 AND codigo = $2 
      LIMIT 1;
    `;
    const res = await db.query<ComponenteRecord>(query, [programaId, codigo]);
    return res.rows[0] || null;
  }

  /**
   * Update a curricular component.
   */
  static async updateComponente(
    id: string,
    data: UpdateComponenteData,
    db: DbClient = pool
  ): Promise<ComponenteRecord | null> {
    const keys = Object.keys(data) as Array<keyof UpdateComponenteData>;
    if (keys.length === 0) {
      return ProgramDao.getComponenteById(id, db);
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of keys) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }

    values.push(id);
    const query = `
      UPDATE componentes_curriculares
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const res = await db.query<ComponenteRecord>(query, values);
    return res.rows[0] || null;
  }

  /**
   * Delete a curricular component.
   */
  static async deleteComponente(id: string, db: DbClient = pool): Promise<boolean> {
    const query = 'DELETE FROM componentes_curriculares WHERE id = $1 RETURNING id;';
    const res = await db.query(query, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ==========================================
  // CATÁLOGO PÚBLICO TIPO UDEMY
  // ==========================================

  /**
   * Public catalog query (Udemy showcase style)
   * Filters: visible_en_web = TRUE AND estado_vigencia = 'ACTIVO'
   * Returns: Area de conocimiento, tags, malla curricular y cohortes con inscripción abierta.
   */
  static async getCatalog(
    filter: CatalogFilter = {},
    db: DbClient = pool
  ): Promise<ProgramCatalogItem[]> {
    const conditions: string[] = [
      'p.visible_en_web = TRUE',
      "p.estado_vigencia = 'ACTIVO'",
    ];
    const values: any[] = [];
    let idx = 1;

    if (filter.area_id) {
      conditions.push(`p.area_conocimiento_id = $${idx++}`);
      values.push(filter.area_id);
    }

    if (filter.categoria) {
      conditions.push(`p.categoria = $${idx++}`);
      values.push(filter.categoria);
    }

    if (filter.subtipo) {
      conditions.push(`p.subtipo = $${idx++}`);
      values.push(filter.subtipo);
    }

    if (filter.search) {
      conditions.push(`(p.nombre ILIKE $${idx} OR p.resumen_corto_web ILIKE $${idx} OR p.slug ILIKE $${idx})`);
      values.push(`%${filter.search}%`);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT
        p.id,
        p.codigo_interno,
        p.codigo_dictamen_setec,
        p.fecha_aprobacion_setec,
        p.nombre,
        p.slug,
        p.categoria,
        p.subtipo,
        p.area_conocimiento_id,
        p.resumen_corto_web,
        p.descripcion_comercial,
        p.imagen_portada_url,
        p.video_promo_url,
        p.brochure_pdf_url,
        p.precio_total_referencia,
        p.descuento_porcentaje,
        p.visible_en_web,
        p.es_ciencias_salud,
        p.duracion_meses,
        p.horas_totales,
        p.creditos_totales,
        p.creditos_investigacion,
        p.permite_continuidad_doctorado,
        p.programa_salida_intermedia_id,
        p.programa_destino_acreditable_id,
        p.es_acreditable_a_posgrado,
        p.estructurado_por_cursos,
        p.requiere_titulo_grado_rn,
        p.requiere_titulo_profesional,
        p.permite_menores_edad,
        p.idioma_egreso_requerido,
        p.num_publicaciones_requeridas,
        p.requiere_revista_indexada,
        p.requiere_pares_evaluadores,
        p.titulo_o_certificado_otorgado,
        p.abreviatura_grado,
        p.estado_vigencia,
        p.created_at,
        json_build_object(
          'id', a.id,
          'nombre', a.nombre,
          'slug', a.slug,
          'icono_url', a.icono_url
        ) AS area_conocimiento,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug))
            FROM programas_tags pt
            JOIN tags_academicos t ON pt.tag_id = t.id
            WHERE pt.programa_id = p.id
          ),
          '[]'::json
        ) AS tags,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', c.id,
                'codigo', c.codigo,
                'nombre', c.nombre,
                'descripcion_temario', c.descripcion_temario,
                'orden_bloque', c.orden_bloque,
                'horas', c.horas,
                'creditos', c.creditos,
                'es_investigacion', c.es_investigacion,
                'es_modalidad_graduacion', c.es_modalidad_graduacion,
                'es_practica_profesional', c.es_practica_profesional,
                'costo_base_asignatura', c.costo_base_asignatura,
                'url_silabo_pdf', c.url_silabo_pdf
              ) ORDER BY c.orden_bloque ASC, c.codigo ASC
            )
            FROM componentes_curriculares c
            WHERE c.programa_id = p.id
          ),
          '[]'::json
        ) AS malla_curricular,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', coh.id,
                'codigo_cohorte', coh.codigo_cohorte,
                'numero_edicion', coh.numero_edicion,
                'modalidad', coh.modalidad,
                'sede_id', coh.sede_id,
                'sede_nombre', s.nombre,
                'fecha_inicio_inscripcion', coh.fecha_inicio_inscripcion,
                'fecha_fin_inscripcion', coh.fecha_fin_inscripcion,
                'fecha_inicio_clases', coh.fecha_inicio_clases,
                'fecha_fin_clases', coh.fecha_fin_clases,
                'horario_general', coh.horario_general,
                'precio_matricula', coh.precio_matricula,
                'precio_total_cohorte', coh.precio_total_cohorte,
                'descuento_porcentaje', coh.descuento_porcentaje,
                'cupo_minimo', coh.cupo_minimo,
                'cupo_maximo', coh.cupo_maximo,
                'cupos_actuales_verificados', coh.cupos_actuales_verificados,
                'cobro_habilitado', coh.cobro_habilitado,
                'estado_cohorte', coh.estado_cohorte
              ) ORDER BY coh.fecha_inicio_clases ASC
            )
            FROM cohortes_apertura coh
            JOIN sedes_ies s ON coh.sede_id = s.id
            WHERE coh.programa_id = p.id AND coh.estado_cohorte = 'INSCRIPCION_ABIERTA'
          ),
          '[]'::json
        ) AS cohortes_abiertas
      FROM programas_academicos p
      JOIN areas_conocimiento a ON p.area_conocimiento_id = a.id
      WHERE ${whereClause}
      ORDER BY p.nombre ASC;
    `;

    const res = await db.query<ProgramCatalogItem>(query, values);
    return res.rows;
  }

  // ==========================================
  // MOTOR DE RECOMENDACIONES SQL
  // ==========================================

  /**
   * Recommendation Engine Query.
   * Matches aspirante's interests (aspirantes_intereses_areas), previous degree areas
   * (titulos_academicos_aspirante.area_conocimiento_id), and accredited destination programs
   * (programas_academicos.programa_destino_acreditable_id).
   */
  static async getRecommendationsForAspirante(
    aspiranteId: string,
    db: DbClient = pool
  ): Promise<ProgramRecommendationItem[]> {
    const query = `
      WITH aspirante_interests AS (
        SELECT area_conocimiento_id 
        FROM aspirantes_intereses_areas 
        WHERE aspirante_id = $1
      ),
      aspirante_titulos_areas AS (
        SELECT DISTINCT area_conocimiento_id 
        FROM titulos_academicos_aspirante 
        WHERE aspirante_id = $1 AND area_conocimiento_id IS NOT NULL
      ),
      programas_destino_acreditables AS (
        -- Programas destino acreditables asociados a cursos o diplomados en los que se haya inscrito el aspirante
        SELECT DISTINCT pa.programa_destino_acreditable_id AS destino_id
        FROM inscripciones i
        JOIN cohortes_apertura ca ON i.cohorte_id = ca.id
        JOIN programas_academicos pa ON ca.programa_id = pa.id
        WHERE i.aspirante_id = $1 AND pa.programa_destino_acreditable_id IS NOT NULL
      ),
      scored_programs AS (
        SELECT 
          p.id,
          p.codigo_interno,
          p.codigo_dictamen_setec,
          p.fecha_aprobacion_setec,
          p.nombre,
          p.slug,
          p.categoria,
          p.subtipo,
          p.area_conocimiento_id,
          p.resumen_corto_web,
          p.descripcion_comercial,
          p.imagen_portada_url,
          p.video_promo_url,
          p.brochure_pdf_url,
          p.precio_total_referencia,
          p.descuento_porcentaje,
          p.visible_en_web,
          p.es_ciencias_salud,
          p.aval_minsa_url,
          p.duracion_meses,
          p.horas_totales,
          p.creditos_totales,
          p.creditos_investigacion,
          p.permite_continuidad_doctorado,
          p.programa_salida_intermedia_id,
          p.programa_destino_acreditable_id,
          p.es_acreditable_a_posgrado,
          p.estructurado_por_cursos,
          p.requiere_titulo_grado_rn,
          p.requiere_titulo_profesional,
          p.permite_menores_edad,
          p.idioma_egreso_requerido,
          p.num_publicaciones_requeridas,
          p.requiere_revista_indexada,
          p.requiere_pares_evaluadores,
          p.titulo_o_certificado_otorgado,
          p.abreviatura_grado,
          p.estado_vigencia,
          p.created_at,
          a.nombre AS area_nombre,
          a.slug AS area_slug,
          a.icono_url AS area_icono_url,
          (
            CASE WHEN p.id IN (SELECT destino_id FROM programas_destino_acreditables) THEN 50 ELSE 0 END +
            CASE WHEN p.area_conocimiento_id IN (SELECT area_conocimiento_id FROM aspirante_titulos_areas) THEN 35 ELSE 0 END +
            CASE WHEN p.area_conocimiento_id IN (SELECT area_conocimiento_id FROM aspirante_interests) THEN 25 ELSE 0 END +
            CASE WHEN p.es_acreditable_a_posgrado = TRUE THEN 10 ELSE 0 END
          ) AS score_relevancia,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN p.id IN (SELECT destino_id FROM programas_destino_acreditables) THEN 'CONTINUIDAD_ACREDITABLE' ELSE NULL END,
            CASE WHEN p.area_conocimiento_id IN (SELECT area_conocimiento_id FROM aspirante_titulos_areas) THEN 'AFINIDAD_TITULO_PREVIO' ELSE NULL END,
            CASE WHEN p.area_conocimiento_id IN (SELECT area_conocimiento_id FROM aspirante_interests) THEN 'INTERES_DECLARADO' ELSE NULL END,
            CASE WHEN p.es_acreditable_a_posgrado = TRUE THEN 'CONVALIDABLE_A_POSGRADO' ELSE NULL END
          ], NULL) AS motivos_match,
          COALESCE(
            (
              SELECT json_agg(json_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug))
              FROM programas_tags pt
              JOIN tags_academicos t ON pt.tag_id = t.id
              WHERE pt.programa_id = p.id
            ),
            '[]'::json
          ) AS tags,
          (
            SELECT COUNT(*)::int
            FROM cohortes_apertura coh
            WHERE coh.programa_id = p.id AND coh.estado_cohorte = 'INSCRIPCION_ABIERTA'
          ) AS total_cohortes_abiertas
        FROM programas_academicos p
        JOIN areas_conocimiento a ON p.area_conocimiento_id = a.id
        WHERE p.estado_vigencia = 'ACTIVO'
      )
      SELECT *
      FROM scored_programs
      WHERE score_relevancia > 0
      ORDER BY score_relevancia DESC, total_cohortes_abiertas DESC, nombre ASC;
    `;

    const res = await db.query<ProgramRecommendationItem>(query, [aspiranteId]);
    return res.rows;
  }
}
