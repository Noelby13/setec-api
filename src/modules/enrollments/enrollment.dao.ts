import { pool, DbClient } from '../../db/pool';

export interface InscripcionRecord {
  id: string;
  codigo_expediente: string;
  aspirante_id: string;
  cohorte_id: string;
  titulo_presentado_id: string | null;
  estado: string;
  observaciones_administracion: string | null;
  rol_participacion: string;
  titulo_ponencia: string | null;
  resumen_ponencia: string | null;
  archivo_ponencia_url: string | null;
  es_reingreso_cambio_plan: boolean;
  inscripcion_origen_id: string | null;
  requiere_nivelacion_investigativa: boolean;
  acepta_compromiso_idioma_y_publicacion: boolean;
  fecha_inscripcion: string;
  fecha_aprobacion_documental: string | null;
  fecha_formalizacion_matricula: string | null;
}

export interface InscripcionDetailRecord extends InscripcionRecord {
  aspirante_nombres?: string;
  aspirante_apellidos?: string;
  aspirante_identificacion?: string;
  aspirante_tipo_identificacion?: string;
  aspirante_email?: string;
  aspirante_telefono?: string;
  aspirante_usuario_id?: string | null;
  cohorte_codigo?: string;
  numero_edicion?: number;
  cohorte_modalidad?: string;
  precio_matricula?: number | string;
  precio_total_cohorte?: number | string;
  cupo_minimo?: number;
  cupo_maximo?: number;
  cupos_actuales_verificados?: number;
  cobro_habilitado?: boolean;
  estado_cohorte?: string;
  programa_id?: string;
  programa_nombre?: string;
  programa_codigo?: string;
  programa_categoria?: string;
  programa_subtipo?: string;
  requiere_titulo_grado_rn?: boolean;
  titulo_denominacion?: string | null;
  titulo_nivel?: string | null;
  titulo_institucion?: string | null;
  titulo_estado_validacion?: string | null;
}

export interface PagoInscripcionRecord {
  id: string;
  inscripcion_id: string;
  aspirante_id: string;
  metodo_pago: string;
  numero_referencia_o_recibo: string;
  banco_origen: string | null;
  comprobante_baucher_url: string | null;
  monto_subtotal: number | string;
  descuento_aplicado: number | string;
  total_pagado: number | string;
  concepto: string;
  estado: string;
  motivo_rechazo: string | null;
  fecha_pago_reportada: string;
  usuario_validador_caja_id: string | null;
  fecha_validacion_caja: string | null;
}

export interface SolicitudConvalidacionRecord {
  id: string;
  inscripcion_destino_id: string;
  componente_destino_id: string;
  componente_nombre?: string;
  componente_codigo?: string;
  componente_creditos?: number;
  origen_tipo: string;
  inscripcion_origen_ep_id: string | null;
  certificado_origen_url: string;
  creditos_reconocidos: number;
  justificacion_aporte_perfil: string;
  estado_dictamen: string;
  coordinador_dictaminador_id: string | null;
  coordinador_nombres?: string | null;
  coordinador_apellidos?: string | null;
  fecha_dictamen: string | null;
}

export interface CohorteWithProgramRecord {
  id: string;
  programa_id: string;
  sede_id: string;
  modalidad: string;
  codigo_cohorte: string;
  numero_edicion: number;
  coordinador_id: string;
  fecha_inicio_inscripcion: string;
  fecha_fin_inscripcion: string;
  fecha_inicio_clases: string;
  fecha_fin_clases: string;
  precio_matricula: number | string;
  precio_total_cohorte: number | string;
  descuento_porcentaje: number;
  cupo_minimo: number;
  cupo_maximo: number;
  cupos_actuales_verificados: number;
  cobro_habilitado: boolean;
  tiene_excepcion_cupo_setec: boolean;
  estado_cohorte: string;
  requiere_titulo_grado_rn: boolean;
  programa_nombre: string;
  programa_subtipo: string;
}

export interface CreateInscripcionDbData {
  codigo_expediente: string;
  aspirante_id: string;
  cohorte_id: string;
  titulo_presentado_id: string | null;
  estado: string;
  observaciones_administracion?: string | null;
  rol_participacion: string;
  titulo_ponencia?: string | null;
  resumen_ponencia?: string | null;
  archivo_ponencia_url?: string | null;
  es_reingreso_cambio_plan: boolean;
  inscripcion_origen_id?: string | null;
  requiere_nivelacion_investigativa: boolean;
  acepta_compromiso_idioma_y_publicacion: boolean;
}

export interface CreatePagoDbData {
  inscripcion_id: string;
  aspirante_id: string;
  metodo_pago: string;
  numero_referencia_o_recibo: string;
  banco_origen?: string | null;
  comprobante_baucher_url?: string | null;
  monto_subtotal: number | string;
  descuento_aplicado: number | string;
  total_pagado: number | string;
  concepto: string;
  estado: string;
  fecha_pago_reportada?: string;
  clave_idempotencia?: string;
  solicitud_hash?: string;
}

export interface CreateConvalidacionDbData {
  inscripcion_destino_id: string;
  componente_destino_id: string;
  origen_tipo: string;
  inscripcion_origen_ep_id?: string | null;
  certificado_origen_url: string;
  creditos_reconocidos: number;
  justificacion_aporte_perfil: string;
}

export interface ListEnrollmentsFilters {
  programa_id?: string;
  cohorte_id?: string;
  aspirante_id?: string;
  estado?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export class EnrollmentDao {
  // ==========================================
  // INSCRIPCIONES - CONSULTAS Y ESCRITURAS
  // ==========================================

  static async findById(id: string, db: DbClient = pool): Promise<InscripcionRecord | null> {
    const query = `
      SELECT *
      FROM inscripciones
      WHERE id = $1
    `;
    const result = await db.query<InscripcionRecord>(query, [id]);
    return result.rows[0] || null;
  }

  static async findByIdForUpdate(id: string, db: DbClient): Promise<InscripcionRecord | null> {
    const result = await db.query<InscripcionRecord>('SELECT * FROM inscripciones WHERE id = $1 FOR UPDATE', [id]);
    return result.rows[0] || null;
  }

  static async findPagoByIdForUpdate(id: string, db: DbClient): Promise<PagoInscripcionRecord | null> {
    const result = await db.query<PagoInscripcionRecord>('SELECT * FROM pagos_inscripcion WHERE id = $1 FOR UPDATE', [id]);
    return result.rows[0] || null;
  }

  static async findDetailedById(id: string, db: DbClient = pool): Promise<InscripcionDetailRecord | null> {
    const query = `
      SELECT 
        i.*,
        a.nombres AS aspirante_nombres,
        a.apellidos AS aspirante_apellidos,
        a.numero_identificacion AS aspirante_identificacion,
        a.tipo_identificacion AS aspirante_tipo_identificacion,
        a.email AS aspirante_email,
        a.telefono AS aspirante_telefono,
        a.usuario_id AS aspirante_usuario_id,
        c.codigo_cohorte AS cohorte_codigo,
        c.numero_edicion,
        c.modalidad AS cohorte_modalidad,
        c.precio_matricula,
        c.precio_total_cohorte,
        c.cupo_minimo,
        c.cupo_maximo,
        c.cupos_actuales_verificados,
        c.cobro_habilitado,
        c.estado_cohorte,
        p.id AS programa_id,
        p.nombre AS programa_nombre,
        p.codigo_interno AS programa_codigo,
        p.categoria AS programa_categoria,
        p.subtipo AS programa_subtipo,
        p.requiere_titulo_grado_rn,
        t.denominacion_titulo AS titulo_denominacion,
        t.nivel_titulo AS titulo_nivel,
        t.institucion_emisora AS titulo_institucion,
        t.estado_validacion AS titulo_estado_validacion
      FROM inscripciones i
      JOIN personas_aspirantes a ON i.aspirante_id = a.id
      JOIN cohortes_apertura c ON i.cohorte_id = c.id
      JOIN programas_academicos p ON c.programa_id = p.id
      LEFT JOIN titulos_academicos_aspirante t ON i.titulo_presentado_id = t.id
      WHERE i.id = $1
    `;
    const result = await db.query<InscripcionDetailRecord>(query, [id]);
    return result.rows[0] || null;
  }

  static async findByAspiranteAndCohorte(
    aspiranteId: string,
    cohorteId: string,
    db: DbClient = pool
  ): Promise<InscripcionRecord | null> {
    const query = `
      SELECT *
      FROM inscripciones
      WHERE aspirante_id = $1 AND cohorte_id = $2
    `;
    const result = await db.query<InscripcionRecord>(query, [aspiranteId, cohorteId]);
    return result.rows[0] || null;
  }

  static async findAspiranteByUserId(
    userId: string,
    db: DbClient = pool
  ): Promise<{ id: string } | null> {
    const query = `
      SELECT id
      FROM personas_aspirantes
      WHERE usuario_id = $1
    `;
    const result = await db.query<{ id: string }>(query, [userId]);
    return result.rows[0] || null;
  }

  static async getCohorteWithProgram(
    cohorteId: string,
    db: DbClient = pool
  ): Promise<CohorteWithProgramRecord | null> {
    const query = `
      SELECT 
        c.*,
        p.requiere_titulo_grado_rn,
        p.nombre AS programa_nombre,
        p.subtipo AS programa_subtipo
      FROM cohortes_apertura c
      JOIN programas_academicos p ON c.programa_id = p.id
      WHERE c.id = $1
    `;
    const result = await db.query<CohorteWithProgramRecord>(query, [cohorteId]);
    return result.rows[0] || null;
  }

  static async getCohorteWithProgramForUpdate(
    cohorteId: string,
    db: DbClient = pool
  ): Promise<CohorteWithProgramRecord | null> {
    const query = `
      SELECT 
        c.*,
        p.requiere_titulo_grado_rn,
        p.nombre AS programa_nombre,
        p.subtipo AS programa_subtipo
      FROM cohortes_apertura c
      JOIN programas_academicos p ON c.programa_id = p.id
      WHERE c.id = $1
      FOR UPDATE OF c
    `;
    const result = await db.query<CohorteWithProgramRecord>(query, [cohorteId]);
    return result.rows[0] || null;
  }

  static async countActiveEnrollmentsInCohorte(
    cohorteId: string,
    db: DbClient = pool
  ): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM inscripciones
      WHERE cohorte_id = $1 AND estado != 'RETIRADO'
    `;
    const result = await db.query<{ count: number }>(query, [cohorteId]);
    return result.rows[0]?.count || 0;
  }

  static async checkTituloBelongsToAspirante(
    tituloId: string,
    aspiranteId: string,
    db: DbClient = pool
  ): Promise<{ id: string; nivel_titulo: string; estado_validacion: string } | null> {
    const query = `
      SELECT id, nivel_titulo, estado_validacion
      FROM titulos_academicos_aspirante
      WHERE id = $1 AND aspirante_id = $2
    `;
    const result = await db.query<{ id: string; nivel_titulo: string; estado_validacion: string }>(
      query,
      [tituloId, aspiranteId]
    );
    return result.rows[0] || null;
  }

  static async createInscripcion(
    data: CreateInscripcionDbData,
    db: DbClient = pool
  ): Promise<InscripcionRecord> {
    const query = `
      INSERT INTO inscripciones (
        codigo_expediente,
        aspirante_id,
        cohorte_id,
        titulo_presentado_id,
        estado,
        observaciones_administracion,
        rol_participacion,
        titulo_ponencia,
        resumen_ponencia,
        archivo_ponencia_url,
        es_reingreso_cambio_plan,
        inscripcion_origen_id,
        requiere_nivelacion_investigativa,
        acepta_compromiso_idioma_y_publicacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const values = [
      data.codigo_expediente,
      data.aspirante_id,
      data.cohorte_id,
      data.titulo_presentado_id,
      data.estado,
      data.observaciones_administracion ?? null,
      data.rol_participacion,
      data.titulo_ponencia ?? null,
      data.resumen_ponencia ?? null,
      data.archivo_ponencia_url ?? null,
      data.es_reingreso_cambio_plan,
      data.inscripcion_origen_id ?? null,
      data.requiere_nivelacion_investigativa,
      data.acepta_compromiso_idioma_y_publicacion,
    ];
    const result = await db.query<InscripcionRecord>(query, values);
    return result.rows[0];
  }

  static async updateInscripcionEstado(
    id: string,
    estado: string,
    options?: {
      fechaAprobacionDocumental?: boolean;
      fechaFormalizacionMatricula?: boolean;
      observaciones?: string | null;
    },
    db: DbClient = pool
  ): Promise<InscripcionRecord | null> {
    let updateFields = 'estado = $2';
    const values: unknown[] = [id, estado];
    let paramIndex = 3;

    if (options?.fechaAprobacionDocumental) {
      updateFields += `, fecha_aprobacion_documental = NOW()`;
    }
    if (options?.fechaFormalizacionMatricula) {
      updateFields += `, fecha_formalizacion_matricula = NOW()`;
    }
    if (options?.observaciones !== undefined) {
      updateFields += `, observaciones_administracion = $${paramIndex}`;
      values.push(options.observaciones);
      paramIndex++;
    }

    const query = `
      UPDATE inscripciones
      SET ${updateFields}
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query<InscripcionRecord>(query, values);
    return result.rows[0] || null;
  }

  static async updateCohorteQuorum(
    cohorteId: string,
    cuposVerificados: number,
    cobroHabilitado: boolean,
    nuevoEstadoCohorte: string | null,
    db: DbClient = pool
  ): Promise<void> {
    if (nuevoEstadoCohorte) {
      const query = `
        UPDATE cohortes_apertura
        SET 
          cupos_actuales_verificados = $2,
          cobro_habilitado = $3,
          estado_cohorte = $4
        WHERE id = $1
      `;
      await db.query(query, [cohorteId, cuposVerificados, cobroHabilitado, nuevoEstadoCohorte]);
    } else {
      const query = `
        UPDATE cohortes_apertura
        SET 
          cupos_actuales_verificados = $2,
          cobro_habilitado = $3
        WHERE id = $1
      `;
      await db.query(query, [cohorteId, cuposVerificados, cobroHabilitado]);
    }
  }

  static async updateReservedToPendingPayment(
    cohorteId: string,
    db: DbClient = pool
  ): Promise<number> {
    const query = `
      UPDATE inscripciones
      SET estado = 'PENDIENTE_PAGO'
      WHERE cohorte_id = $1 AND estado = 'INSCRITO_RESERVADO'
    `;
    const result = await db.query(query, [cohorteId]);
    return result.rowCount || 0;
  }

  static async listInscripciones(
    filters: ListEnrollmentsFilters,
    db: DbClient = pool
  ): Promise<{ data: InscripcionDetailRecord[]; total: number }> {
    const whereClauses: string[] = ['1=1'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.cohorte_id) {
      whereClauses.push(`i.cohorte_id = $${paramIndex}`);
      values.push(filters.cohorte_id);
      paramIndex++;
    }

    if (filters.programa_id) {
      whereClauses.push(`EXISTS (SELECT 1 FROM cohortes_apertura pc WHERE pc.id = i.cohorte_id AND pc.programa_id = $${paramIndex})`);
      values.push(filters.programa_id);
      paramIndex++;
    }

    if (filters.aspirante_id) {
      whereClauses.push(`i.aspirante_id = $${paramIndex}`);
      values.push(filters.aspirante_id);
      paramIndex++;
    }

    if (filters.estado) {
      whereClauses.push(`i.estado = $${paramIndex}`);
      values.push(filters.estado);
      paramIndex++;
    }

    if (filters.search) {
      whereClauses.push(
        `(i.codigo_expediente ILIKE $${paramIndex} OR a.nombres ILIKE $${paramIndex} OR a.apellidos ILIKE $${paramIndex} OR a.numero_identificacion ILIKE $${paramIndex})`
      );
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereString = whereClauses.join(' AND ');

    // Total Count
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM inscripciones i
      JOIN personas_aspirantes a ON i.aspirante_id = a.id
      WHERE ${whereString}
    `;
    const countResult = await db.query<{ total: number }>(countQuery, values);
    const total = countResult.rows[0]?.total || 0;

    // Pagination
    const limit = filters.limit || 20;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT 
        i.*,
        a.nombres AS aspirante_nombres,
        a.apellidos AS aspirante_apellidos,
        a.numero_identificacion AS aspirante_identificacion,
        a.tipo_identificacion AS aspirante_tipo_identificacion,
        a.email AS aspirante_email,
        a.telefono AS aspirante_telefono,
        a.usuario_id AS aspirante_usuario_id,
        c.codigo_cohorte AS cohorte_codigo,
        c.numero_edicion,
        c.modalidad AS cohorte_modalidad,
        c.precio_matricula,
        c.precio_total_cohorte,
        c.cupo_minimo,
        c.cupo_maximo,
        c.cupos_actuales_verificados,
        c.cobro_habilitado,
        c.estado_cohorte,
        p.id AS programa_id,
        p.nombre AS programa_nombre,
        p.codigo_interno AS programa_codigo,
        p.categoria AS programa_categoria,
        p.subtipo AS programa_subtipo,
        p.requiere_titulo_grado_rn,
        t.denominacion_titulo AS titulo_denominacion,
        t.nivel_titulo AS titulo_nivel,
        t.institucion_emisora AS titulo_institucion,
        t.estado_validacion AS titulo_estado_validacion
      FROM inscripciones i
      JOIN personas_aspirantes a ON i.aspirante_id = a.id
      JOIN cohortes_apertura c ON i.cohorte_id = c.id
      JOIN programas_academicos p ON c.programa_id = p.id
      LEFT JOIN titulos_academicos_aspirante t ON i.titulo_presentado_id = t.id
      WHERE ${whereString}
      ORDER BY i.fecha_inscripcion DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(limit, offset);

    const dataResult = await db.query<InscripcionDetailRecord>(dataQuery, values);
    return { data: dataResult.rows, total };
  }

  // ==========================================
  // PAGOS Y CAJA (pagos_inscripcion)
  // ==========================================

  static async createPago(
    data: CreatePagoDbData,
    db: DbClient = pool
  ): Promise<PagoInscripcionRecord> {
    const query = `
      INSERT INTO pagos_inscripcion (
        inscripcion_id,
        aspirante_id,
        metodo_pago,
        numero_referencia_o_recibo,
        banco_origen,
        comprobante_baucher_url,
        monto_subtotal,
        descuento_aplicado,
        total_pagado,
        concepto,
        estado,
        fecha_pago_reportada, clave_idempotencia, solicitud_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()), $13, $14)
      RETURNING *
    `;
    const values = [
      data.inscripcion_id,
      data.aspirante_id,
      data.metodo_pago,
      data.numero_referencia_o_recibo,
      data.banco_origen ?? null,
      data.comprobante_baucher_url ?? null,
      data.monto_subtotal,
      data.descuento_aplicado,
      data.total_pagado,
      data.concepto,
      data.estado,
      data.fecha_pago_reportada ?? null,
      data.clave_idempotencia ?? null,
      data.solicitud_hash ?? null,
    ];
    const result = await db.query<PagoInscripcionRecord>(query, values);
    return result.rows[0];
  }

  static async findPagoById(
    paymentId: string,
    db: DbClient = pool
  ): Promise<PagoInscripcionRecord | null> {
    const query = `
      SELECT *
      FROM pagos_inscripcion
      WHERE id = $1
    `;
    const result = await db.query<PagoInscripcionRecord>(query, [paymentId]);
    return result.rows[0] || null;
  }

  static async findPagosByInscripcionId(
    inscripcionId: string,
    db: DbClient = pool
  ): Promise<PagoInscripcionRecord[]> {
    const query = `
      SELECT *
      FROM pagos_inscripcion
      WHERE inscripcion_id = $1
      ORDER BY fecha_pago_reportada DESC
    `;
    const result = await db.query<PagoInscripcionRecord>(query, [inscripcionId]);
    return result.rows;
  }

  static async updatePagoValidation(
    paymentId: string,
    estado: string,
    motivoRechazo: string | null,
    usuarioValidadorId: string,
    db: DbClient = pool
  ): Promise<PagoInscripcionRecord | null> {
    const query = `
      UPDATE pagos_inscripcion
      SET 
        estado = $2,
        motivo_rechazo = $3,
        usuario_validador_caja_id = $4,
        fecha_validacion_caja = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query<PagoInscripcionRecord>(query, [
      paymentId,
      estado,
      motivoRechazo,
      usuarioValidadorId,
    ]);
    return result.rows[0] || null;
  }

  // ==========================================
  // CONVALIDACIONES (solicitudes_convalidacion_acreditacion)
  // ==========================================

  static async createSolicitudConvalidacion(
    data: CreateConvalidacionDbData,
    db: DbClient = pool
  ): Promise<SolicitudConvalidacionRecord> {
    const query = `
      INSERT INTO solicitudes_convalidacion_acreditacion (
        inscripcion_destino_id,
        componente_destino_id,
        origen_tipo,
        inscripcion_origen_ep_id,
        certificado_origen_url,
        creditos_reconocidos,
        justificacion_aporte_perfil
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.inscripcion_destino_id,
      data.componente_destino_id,
      data.origen_tipo,
      data.inscripcion_origen_ep_id ?? null,
      data.certificado_origen_url,
      data.creditos_reconocidos,
      data.justificacion_aporte_perfil,
    ];
    const result = await db.query<SolicitudConvalidacionRecord>(query, values);
    return result.rows[0];
  }

  static async findSolicitudConvalidacionById(
    convalidationId: string,
    db: DbClient = pool
  ): Promise<SolicitudConvalidacionRecord | null> {
    const query = `
      SELECT 
        s.*,
        cc.nombre AS componente_nombre,
        cc.codigo AS componente_codigo,
        cc.creditos AS componente_creditos,
        pa.nombres AS coordinador_nombres,
        pa.apellidos AS coordinador_apellidos
      FROM solicitudes_convalidacion_acreditacion s
      JOIN componentes_curriculares cc ON s.componente_destino_id = cc.id
      LEFT JOIN personal_academico pa ON s.coordinador_dictaminador_id = pa.id
      WHERE s.id = $1
    `;
    const result = await db.query<SolicitudConvalidacionRecord>(query, [convalidationId]);
    return result.rows[0] || null;
  }

  static async findSolicitudesConvalidacionByInscripcionId(
    inscripcionId: string,
    db: DbClient = pool
  ): Promise<SolicitudConvalidacionRecord[]> {
    const query = `
      SELECT 
        s.*,
        cc.nombre AS componente_nombre,
        cc.codigo AS componente_codigo,
        cc.creditos AS componente_creditos,
        pa.nombres AS coordinador_nombres,
        pa.apellidos AS coordinador_apellidos
      FROM solicitudes_convalidacion_acreditacion s
      JOIN componentes_curriculares cc ON s.componente_destino_id = cc.id
      LEFT JOIN personal_academico pa ON s.coordinador_dictaminador_id = pa.id
      WHERE s.inscripcion_destino_id = $1
      ORDER BY s.id DESC
    `;
    const result = await db.query<SolicitudConvalidacionRecord>(query, [inscripcionId]);
    return result.rows;
  }

  static async updateDictamenConvalidacion(
    convalidationId: string,
    estadoDictamen: string,
    coordinadorId: string | null,
    db: DbClient = pool
  ): Promise<SolicitudConvalidacionRecord | null> {
    const query = `
      UPDATE solicitudes_convalidacion_acreditacion
      SET 
        estado_dictamen = $2,
        coordinador_dictaminador_id = $3,
        fecha_dictamen = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query<SolicitudConvalidacionRecord>(query, [
      convalidationId,
      estadoDictamen,
      coordinadorId,
    ]);
    return result.rows[0] || null;
  }

  static async findPersonalAcademicoByUserId(
    userId: string,
    db: DbClient = pool
  ): Promise<{ id: string } | null> {
    const query = `
      SELECT id
      FROM personal_academico
      WHERE usuario_id = $1
    `;
    const result = await db.query<{ id: string }>(query, [userId]);
    return result.rows[0] || null;
  }

  static async checkComponenteBelongsToCohorteProgram(
    componenteId: string,
    cohorteId: string,
    db: DbClient = pool
  ): Promise<{ id: string; creditos: number } | null> {
    const query = `
      SELECT cc.id, cc.creditos
      FROM componentes_curriculares cc
      JOIN cohortes_apertura ca ON ca.programa_id = cc.programa_id
      WHERE cc.id = $1 AND ca.id = $2
    `;
    const result = await db.query<{ id: string; creditos: number }>(query, [
      componenteId,
      cohorteId,
    ]);
    return result.rows[0] || null;
  }
}
