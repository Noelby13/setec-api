import { pool, DbClient } from '../../db/pool';

export interface AspiranteRecord {
  id: string;
  usuario_id: string | null;
  tipo_identificacion: string;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  email: string;
  telefono: string;
  cedula_identidad_pdf_url: string | null;
  identidad_verificada: boolean;
  fecha_verificacion: string | null;
  verificado_por_usuario_id: string | null;
  tiene_discapacidad: boolean;
  descripcion_ajuste_razonable: string | null;
  tutor_nombre_completo: string | null;
  tutor_identificacion: string | null;
  tutor_documento_url: string | null;
  created_at: string;
}

export interface AspiranteDetailRecord extends AspiranteRecord {
  usuario_email?: string | null;
  verificador_nombres?: string | null;
  verificador_apellidos?: string | null;
  intereses?: ApplicantInterestRecord[];
  titulos?: TituloAcademicoRecord[];
}

export interface ApplicantInterestRecord {
  aspirante_id: string;
  area_conocimiento_id: string;
  area_nombre?: string;
  area_codigo?: string;
}

export interface TituloAcademicoRecord {
  id: string;
  aspirante_id: string;
  area_conocimiento_id: string | null;
  area_nombre?: string | null;
  nivel_titulo: string;
  denominacion_titulo: string;
  institucion_emisora: string;
  fecha_emision: string;
  inscrito_registro_nacional: boolean;
  codigo_registro_nacional: string | null;
  certificado_rn_url: string | null;
  titulo_pdf_url: string;
  porcentaje_creditos_investigacion: number | string | null;
  estado_validacion: string;
  observacion_rechazo: string | null;
  fecha_validacion: string | null;
  usuario_validador_id: string | null;
  validador_nombres?: string | null;
  validador_apellidos?: string | null;
}

export interface CreateApplicantProfileData {
  usuario_id?: string | null;
  tipo_identificacion: string;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  email: string;
  telefono: string;
  cedula_identidad_pdf_url?: string | null;
  tiene_discapacidad?: boolean;
  descripcion_ajuste_razonable?: string | null;
  tutor_nombre_completo?: string | null;
  tutor_identificacion?: string | null;
  tutor_documento_url?: string | null;
}

export interface UpdateApplicantProfileData {
  tipo_identificacion?: string;
  numero_identificacion?: string;
  nombres?: string;
  apellidos?: string;
  fecha_nacimiento?: string;
  email?: string;
  telefono?: string;
  cedula_identidad_pdf_url?: string | null;
  tiene_discapacidad?: boolean;
  descripcion_ajuste_razonable?: string | null;
  tutor_nombre_completo?: string | null;
  tutor_identificacion?: string | null;
  tutor_documento_url?: string | null;
}

export interface CreateAcademicDegreeData {
  aspirante_id: string;
  area_conocimiento_id?: string | null;
  nivel_titulo: string;
  denominacion_titulo: string;
  institucion_emisora: string;
  fecha_emision: string;
  inscrito_registro_nacional?: boolean;
  codigo_registro_nacional?: string | null;
  certificado_rn_url?: string | null;
  titulo_pdf_url: string;
  porcentaje_creditos_investigacion?: number | null;
}

export interface UpdateAcademicDegreeData {
  area_conocimiento_id?: string | null;
  nivel_titulo?: string;
  denominacion_titulo?: string;
  institucion_emisora?: string;
  fecha_emision?: string;
  inscrito_registro_nacional?: boolean;
  codigo_registro_nacional?: string | null;
  certificado_rn_url?: string | null;
  titulo_pdf_url?: string;
  porcentaje_creditos_investigacion?: number | null;
}

export interface ListApplicantsFilters {
  identidad_verificada?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export class ApplicantDao {
  // ==========================================
  // PERSONAS ASPIRANTES (PERFIL)
  // ==========================================

  /**
   * Create an applicant profile linked 1:1 with a user.
   */
  static async createProfile(
    data: CreateApplicantProfileData,
    db: DbClient = pool
  ): Promise<AspiranteRecord> {
    const query = `
      INSERT INTO personas_aspirantes (
        usuario_id,
        tipo_identificacion,
        numero_identificacion,
        nombres,
        apellidos,
        fecha_nacimiento,
        email,
        telefono,
        cedula_identidad_pdf_url,
        tiene_discapacidad,
        descripcion_ajuste_razonable,
        tutor_nombre_completo,
        tutor_identificacion,
        tutor_documento_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const values = [
      data.usuario_id || null,
      data.tipo_identificacion,
      data.numero_identificacion,
      data.nombres,
      data.apellidos,
      data.fecha_nacimiento,
      data.email,
      data.telefono,
      data.cedula_identidad_pdf_url || null,
      data.tiene_discapacidad ?? false,
      data.descripcion_ajuste_razonable || null,
      data.tutor_nombre_completo || null,
      data.tutor_identificacion || null,
      data.tutor_documento_url || null,
    ];

    const result = await db.query<AspiranteRecord>(query, values);
    return result.rows[0];
  }

  /**
   * Update an applicant profile with pure parameterized SQL.
   */
  static async updateProfile(
    id: string,
    data: UpdateApplicantProfileData,
    db: DbClient = pool
  ): Promise<AspiranteRecord | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.tipo_identificacion !== undefined) {
      setClauses.push(`tipo_identificacion = $${paramIndex++}`);
      values.push(data.tipo_identificacion);
    }
    if (data.numero_identificacion !== undefined) {
      setClauses.push(`numero_identificacion = $${paramIndex++}`);
      values.push(data.numero_identificacion);
    }
    if (data.nombres !== undefined) {
      setClauses.push(`nombres = $${paramIndex++}`);
      values.push(data.nombres);
    }
    if (data.apellidos !== undefined) {
      setClauses.push(`apellidos = $${paramIndex++}`);
      values.push(data.apellidos);
    }
    if (data.fecha_nacimiento !== undefined) {
      setClauses.push(`fecha_nacimiento = $${paramIndex++}`);
      values.push(data.fecha_nacimiento);
    }
    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }
    if (data.telefono !== undefined) {
      setClauses.push(`telefono = $${paramIndex++}`);
      values.push(data.telefono);
    }
    if (data.cedula_identidad_pdf_url !== undefined) {
      setClauses.push(`cedula_identidad_pdf_url = $${paramIndex++}`);
      values.push(data.cedula_identidad_pdf_url);
    }
    if (data.tiene_discapacidad !== undefined) {
      setClauses.push(`tiene_discapacidad = $${paramIndex++}`);
      values.push(data.tiene_discapacidad);
    }
    if (data.descripcion_ajuste_razonable !== undefined) {
      setClauses.push(`descripcion_ajuste_razonable = $${paramIndex++}`);
      values.push(data.descripcion_ajuste_razonable);
    }
    if (data.tutor_nombre_completo !== undefined) {
      setClauses.push(`tutor_nombre_completo = $${paramIndex++}`);
      values.push(data.tutor_nombre_completo);
    }
    if (data.tutor_identificacion !== undefined) {
      setClauses.push(`tutor_identificacion = $${paramIndex++}`);
      values.push(data.tutor_identificacion);
    }
    if (data.tutor_documento_url !== undefined) {
      setClauses.push(`tutor_documento_url = $${paramIndex++}`);
      values.push(data.tutor_documento_url);
    }

    if (setClauses.length === 0) {
      return this.getProfileById(id, db);
    }

    values.push(id);
    const query = `
      UPDATE personas_aspirantes
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await db.query<AspiranteRecord>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Get applicant profile by ID with user and validator metadata.
   */
  static async getProfileById(
    id: string,
    db: DbClient = pool
  ): Promise<AspiranteDetailRecord | null> {
    const query = `
      SELECT 
        pa.*,
        u.email as usuario_email,
        uv.nombres as verificador_nombres,
        uv.apellidos as verificador_apellidos
      FROM personas_aspirantes pa
      LEFT JOIN usuarios u ON pa.usuario_id = u.id
      LEFT JOIN usuarios uv ON pa.verificado_por_usuario_id = uv.id
      WHERE pa.id = $1;
    `;

    const result = await db.query<AspiranteDetailRecord>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get applicant profile by user ID.
   */
  static async getProfileByUsuarioId(
    usuarioId: string,
    db: DbClient = pool
  ): Promise<AspiranteDetailRecord | null> {
    const query = `
      SELECT 
        pa.*,
        u.email as usuario_email,
        uv.nombres as verificador_nombres,
        uv.apellidos as verificador_apellidos
      FROM personas_aspirantes pa
      LEFT JOIN usuarios u ON pa.usuario_id = u.id
      LEFT JOIN usuarios uv ON pa.verificado_por_usuario_id = uv.id
      WHERE pa.usuario_id = $1;
    `;

    const result = await db.query<AspiranteDetailRecord>(query, [usuarioId]);
    return result.rows[0] || null;
  }

  /**
   * Check if identification number already exists.
   */
  static async getProfileByNumeroIdentificacion(
    numeroIdentificacion: string,
    db: DbClient = pool
  ): Promise<AspiranteRecord | null> {
    const query = `
      SELECT * FROM personas_aspirantes 
      WHERE numero_identificacion = $1;
    `;
    const result = await db.query<AspiranteRecord>(query, [numeroIdentificacion]);
    return result.rows[0] || null;
  }

  /**
   * Check if email already exists.
   */
  static async getProfileByEmail(
    email: string,
    db: DbClient = pool
  ): Promise<AspiranteRecord | null> {
    const query = `
      SELECT * FROM personas_aspirantes 
      WHERE LOWER(email) = LOWER($1);
    `;
    const result = await db.query<AspiranteRecord>(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * List applicant profiles with optional filters and pagination.
   */
  static async listProfiles(
    filters: ListApplicantsFilters = {},
    db: DbClient = pool
  ): Promise<AspiranteRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.identidad_verificada !== undefined) {
      conditions.push(`pa.identidad_verificada = $${paramIndex++}`);
      values.push(filters.identidad_verificada);
    }

    if (filters.search) {
      conditions.push(`(
        pa.nombres ILIKE $${paramIndex} OR
        pa.apellidos ILIKE $${paramIndex} OR
        pa.numero_identificacion ILIKE $${paramIndex} OR
        pa.email ILIKE $${paramIndex}
      )`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ? Math.min(filters.limit, 100) : 50;
    const offset = filters.offset || 0;

    values.push(limit, offset);
    const query = `
      SELECT 
        pa.*,
        u.email as usuario_email,
        uv.nombres as verificador_nombres,
        uv.apellidos as verificador_apellidos
      FROM personas_aspirantes pa
      LEFT JOIN usuarios u ON pa.usuario_id = u.id
      LEFT JOIN usuarios uv ON pa.verificado_por_usuario_id = uv.id
      ${whereClause}
      ORDER BY pa.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const result = await db.query<AspiranteRecord>(query, values);
    return result.rows;
  }

  /**
   * Mark administrative identity verification.
   * identidad_verificada = TRUE, fecha_verificacion = NOW(), verificado_por_usuario_id
   */
  static async verifyIdentity(
    id: string,
    verificadoPorUsuarioId: string,
    db: DbClient = pool
  ): Promise<AspiranteRecord | null> {
    const query = `
      UPDATE personas_aspirantes
      SET 
        identidad_verificada = TRUE,
        fecha_verificacion = NOW(),
        verificado_por_usuario_id = $2
      WHERE id = $1
      RETURNING *;
    `;

    const result = await db.query<AspiranteRecord>(query, [id, verificadoPorUsuarioId]);
    return result.rows[0] || null;
  }

  // ==========================================
  // INTERESES EN ÁREAS DE CONOCIMIENTO
  // ==========================================

  /**
   * Replace all interests for an applicant.
   */
  static async replaceInterests(
    aspiranteId: string,
    areaConocimientoIds: string[],
    db: DbClient = pool
  ): Promise<ApplicantInterestRecord[]> {
    // 1. Delete existing interests
    await db.query(
      'DELETE FROM aspirantes_intereses_areas WHERE aspirante_id = $1;',
      [aspiranteId]
    );

    // 2. Insert new interests if any provided
    if (areaConocimientoIds.length > 0) {
      const uniqueAreaIds = Array.from(new Set(areaConocimientoIds));
      const valueClauses = uniqueAreaIds
        .map((_, idx) => `($1, $${idx + 2})`)
        .join(', ');

      const insertQuery = `
        INSERT INTO aspirantes_intereses_areas (aspirante_id, area_conocimiento_id)
        VALUES ${valueClauses};
      `;

      await db.query(insertQuery, [aspiranteId, ...uniqueAreaIds]);
    }

    return this.getInterests(aspiranteId, db);
  }

  /**
   * Get all interests declared by an applicant.
   */
  static async getInterests(
    aspiranteId: string,
    db: DbClient = pool
  ): Promise<ApplicantInterestRecord[]> {
    const query = `
      SELECT 
        aia.aspirante_id,
        aia.area_conocimiento_id,
        ac.nombre as area_nombre,
        ac.codigo as area_codigo
      FROM aspirantes_intereses_areas aia
      JOIN areas_conocimiento ac ON aia.area_conocimiento_id = ac.id
      WHERE aia.aspirante_id = $1
      ORDER BY ac.nombre ASC;
    `;

    const result = await db.query<ApplicantInterestRecord>(query, [aspiranteId]);
    return result.rows;
  }

  // ==========================================
  // TÍTULOS ACADÉMICOS PREVIOS (CRUD & VALIDACIÓN)
  // ==========================================

  /**
   * Create an academic degree record for an applicant.
   */
  static async createAcademicDegree(
    data: CreateAcademicDegreeData,
    db: DbClient = pool
  ): Promise<TituloAcademicoRecord> {
    const query = `
      INSERT INTO titulos_academicos_aspirante (
        aspirante_id,
        area_conocimiento_id,
        nivel_titulo,
        denominacion_titulo,
        institucion_emisora,
        fecha_emision,
        inscrito_registro_nacional,
        codigo_registro_nacional,
        certificado_rn_url,
        titulo_pdf_url,
        porcentaje_creditos_investigacion,
        estado_validacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDIENTE')
      RETURNING *;
    `;

    const values = [
      data.aspirante_id,
      data.area_conocimiento_id || null,
      data.nivel_titulo,
      data.denominacion_titulo,
      data.institucion_emisora,
      data.fecha_emision,
      data.inscrito_registro_nacional ?? false,
      data.codigo_registro_nacional || null,
      data.certificado_rn_url || null,
      data.titulo_pdf_url,
      data.porcentaje_creditos_investigacion ?? null,
    ];

    const result = await db.query<TituloAcademicoRecord>(query, values);
    return result.rows[0];
  }

  /**
   * Get academic degree by ID with metadata.
   */
  static async getAcademicDegreeById(
    id: string,
    db: DbClient = pool
  ): Promise<TituloAcademicoRecord | null> {
    const query = `
      SELECT 
        t.*,
        ac.nombre as area_nombre,
        u.nombres as validador_nombres,
        u.apellidos as validador_apellidos
      FROM titulos_academicos_aspirante t
      LEFT JOIN areas_conocimiento ac ON t.area_conocimiento_id = ac.id
      LEFT JOIN usuarios u ON t.usuario_validador_id = u.id
      WHERE t.id = $1;
    `;

    const result = await db.query<TituloAcademicoRecord>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * List all academic degrees of an applicant.
   */
  static async listAcademicDegreesByAspirante(
    aspiranteId: string,
    db: DbClient = pool
  ): Promise<TituloAcademicoRecord[]> {
    const query = `
      SELECT 
        t.*,
        ac.nombre as area_nombre,
        u.nombres as validador_nombres,
        u.apellidos as validador_apellidos
      FROM titulos_academicos_aspirante t
      LEFT JOIN areas_conocimiento ac ON t.area_conocimiento_id = ac.id
      LEFT JOIN usuarios u ON t.usuario_validador_id = u.id
      WHERE t.aspirante_id = $1
      ORDER BY t.fecha_emision DESC;
    `;

    const result = await db.query<TituloAcademicoRecord>(query, [aspiranteId]);
    return result.rows;
  }

  /**
   * Update an academic degree.
   */
  static async updateAcademicDegree(
    id: string,
    data: UpdateAcademicDegreeData,
    db: DbClient = pool
  ): Promise<TituloAcademicoRecord | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.area_conocimiento_id !== undefined) {
      setClauses.push(`area_conocimiento_id = $${paramIndex++}`);
      values.push(data.area_conocimiento_id);
    }
    if (data.nivel_titulo !== undefined) {
      setClauses.push(`nivel_titulo = $${paramIndex++}`);
      values.push(data.nivel_titulo);
    }
    if (data.denominacion_titulo !== undefined) {
      setClauses.push(`denominacion_titulo = $${paramIndex++}`);
      values.push(data.denominacion_titulo);
    }
    if (data.institucion_emisora !== undefined) {
      setClauses.push(`institucion_emisora = $${paramIndex++}`);
      values.push(data.institucion_emisora);
    }
    if (data.fecha_emision !== undefined) {
      setClauses.push(`fecha_emision = $${paramIndex++}`);
      values.push(data.fecha_emision);
    }
    if (data.inscrito_registro_nacional !== undefined) {
      setClauses.push(`inscrito_registro_nacional = $${paramIndex++}`);
      values.push(data.inscrito_registro_nacional);
    }
    if (data.codigo_registro_nacional !== undefined) {
      setClauses.push(`codigo_registro_nacional = $${paramIndex++}`);
      values.push(data.codigo_registro_nacional);
    }
    if (data.certificado_rn_url !== undefined) {
      setClauses.push(`certificado_rn_url = $${paramIndex++}`);
      values.push(data.certificado_rn_url);
    }
    if (data.titulo_pdf_url !== undefined) {
      setClauses.push(`titulo_pdf_url = $${paramIndex++}`);
      values.push(data.titulo_pdf_url);
    }
    if (data.porcentaje_creditos_investigacion !== undefined) {
      setClauses.push(`porcentaje_creditos_investigacion = $${paramIndex++}`);
      values.push(data.porcentaje_creditos_investigacion);
    }

    if (setClauses.length === 0) {
      return this.getAcademicDegreeById(id, db);
    }

    values.push(id);
    const query = `
      UPDATE titulos_academicos_aspirante
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await db.query<TituloAcademicoRecord>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete an academic degree.
   */
  static async deleteAcademicDegree(
    id: string,
    db: DbClient = pool
  ): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM titulos_academicos_aspirante WHERE id = $1;',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Administration validation of academic degree.
   * estado_validacion: 'PENDIENTE' | 'VALIDADO' | 'RECHAZADO'
   * observacion_rechazo, fecha_validacion = NOW(), usuario_validador_id
   */
  static async validateAcademicDegree(
    id: string,
    estado: string,
    observacionRechazo: string | null,
    usuarioValidadorId: string,
    db: DbClient = pool
  ): Promise<TituloAcademicoRecord | null> {
    const query = `
      UPDATE titulos_academicos_aspirante
      SET 
        estado_validacion = $2,
        observacion_rechazo = $3,
        fecha_validacion = NOW(),
        usuario_validador_id = $4
      WHERE id = $1
      RETURNING *;
    `;

    const values = [id, estado, observacionRechazo, usuarioValidadorId];
    const result = await db.query<TituloAcademicoRecord>(query, values);
    return result.rows[0] || null;
  }
}
