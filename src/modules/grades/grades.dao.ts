import { pool, DbClient } from '../../db/pool';
import { EscalaCualitativaSnepa } from '../../types/enums';

export interface LoteImportacionRecord {
  id: string;
  programacion_componente_id: string;
  subido_por_usuario_id: string;
  archivo_excel_url: string;
  total_registros_procesados: number;
  observaciones: string | null;
  created_at: Date;
}

export interface MatriculaComponenteRecord {
  id: string;
  inscripcion_id: string;
  programacion_componente_id: string;
  componente_id: string;
  lote_importacion_id: string | null;
  es_convalidada: boolean;
  calificacion_cuantitativa: number | null;
  valoracion_cualitativa: EscalaCualitativaSnepa | null;
  observacion_acompanamiento_pedagogico: string | null;
  autoevaluacion_completada: boolean;
  coevaluacion_completada: boolean;
  aprobado: boolean;
  es_modificada_manualmente: boolean;
  registrado_por_usuario_id: string | null;
  fecha_registro: Date;
}

export interface NotaSnepaLogRecord {
  id: string;
  matricula_componente_id: string;
  nota_anterior: number | null;
  nota_nueva: number | null;
  cualitativa_anterior: EscalaCualitativaSnepa | null;
  cualitativa_nueva: EscalaCualitativaSnepa | null;
  motivo_modificacion: string;
  modificado_por_usuario_id: string;
  fecha_modificacion: Date;
}

export class GradesDAO {
  /**
   * Retrieve modular scheduling row with cohort and curricular component details.
   */
  static async getProgramacionComponenteById(
    id: string,
    db: DbClient = pool
  ): Promise<any | null> {
    const query = `
      SELECT 
        pcc.id,
        pcc.cohorte_id,
        pcc.componente_id,
        pcc.docente_titular_id,
        pcc.actas_notas_cerradas,
        pcc.fecha_inicio,
        pcc.fecha_fin,
        ca.codigo_cohorte,
        cc.nombre_modulo,
        cc.codigo_componente,
        cc.creditos_academicos
      FROM programacion_componentes_cohorte pcc
      JOIN cohortes_apertura ca ON ca.id = pcc.cohorte_id
      JOIN componentes_curriculares cc ON cc.id = pcc.componente_id
      WHERE pcc.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Insert a new batch import record for Excel upload.
   */
  static async createLoteImportacion(
    data: {
      programacion_componente_id: string;
      subido_por_usuario_id: string;
      archivo_excel_url: string;
      total_registros_procesados?: number;
      observaciones?: string | null;
    },
    db: DbClient = pool
  ): Promise<LoteImportacionRecord> {
    const query = `
      INSERT INTO lotes_importacion_notas (
        programacion_componente_id,
        subido_por_usuario_id,
        archivo_excel_url,
        total_registros_procesados,
        observaciones
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      data.programacion_componente_id,
      data.subido_por_usuario_id,
      data.archivo_excel_url,
      data.total_registros_procesados || 0,
      data.observaciones || null,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update the processed records count in lotes_importacion_notas.
   */
  static async updateLoteImportacionTotal(
    loteId: string,
    total: number,
    observaciones?: string | null,
    db: DbClient = pool
  ): Promise<LoteImportacionRecord | null> {
    const query = `
      UPDATE lotes_importacion_notas
      SET total_registros_procesados = $1,
          observaciones = COALESCE($2, observaciones)
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(query, [total, observaciones || null, loteId]);
    return result.rows[0] || null;
  }

  /**
   * Find enrollment by its unique administrative record code (codigo_expediente).
   */
  static async findInscripcionByCodigoExpediente(
    codigoExpediente: string,
    db: DbClient = pool
  ): Promise<any | null> {
    const query = `
      SELECT 
        i.id,
        i.codigo_expediente,
        i.aspirante_id,
        i.cohorte_id,
        i.estado,
        pa.nombres,
        pa.apellidos,
        pa.numero_identificacion
      FROM inscripciones i
      JOIN personas_aspirantes pa ON pa.id = i.aspirante_id
      WHERE i.codigo_expediente = $1
    `;
    const result = await db.query(query, [codigoExpediente]);
    return result.rows[0] || null;
  }

  /**
   * Upsert SNEPA course component grade.
   * ON CONFLICT (inscripcion_id, componente_id) DO UPDATE.
   */
  static async upsertMatriculaComponenteSnepa(
    data: {
      inscripcion_id: string;
      programacion_componente_id: string;
      componente_id: string;
      lote_importacion_id: string;
      calificacion_cuantitativa: number;
      valoracion_cualitativa: EscalaCualitativaSnepa;
      observacion_acompanamiento_pedagogico?: string | null;
      autoevaluacion_completada?: boolean;
      coevaluacion_completada?: boolean;
      aprobado: boolean;
      registrado_por_usuario_id: string;
    },
    db: DbClient = pool
  ): Promise<MatriculaComponenteRecord> {
    const query = `
      INSERT INTO matricula_componentes_snepa (
        inscripcion_id,
        programacion_componente_id,
        componente_id,
        lote_importacion_id,
        calificacion_cuantitativa,
        valoracion_cualitativa,
        observacion_acompanamiento_pedagogico,
        autoevaluacion_completada,
        coevaluacion_completada,
        aprobado,
        es_modificada_manualmente,
        registrado_por_usuario_id,
        fecha_registro
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, NOW())
      ON CONFLICT (inscripcion_id, componente_id) DO UPDATE SET
        programacion_componente_id = EXCLUDED.programacion_componente_id,
        lote_importacion_id = EXCLUDED.lote_importacion_id,
        calificacion_cuantitativa = EXCLUDED.calificacion_cuantitativa,
        valoracion_cualitativa = EXCLUDED.valoracion_cualitativa,
        observacion_acompanamiento_pedagogico = EXCLUDED.observacion_acompanamiento_pedagogico,
        autoevaluacion_completada = EXCLUDED.autoevaluacion_completada,
        coevaluacion_completada = EXCLUDED.coevaluacion_completada,
        aprobado = EXCLUDED.aprobado,
        registrado_por_usuario_id = EXCLUDED.registrado_por_usuario_id,
        fecha_registro = NOW()
      RETURNING *
    `;
    const values = [
      data.inscripcion_id,
      data.programacion_componente_id,
      data.componente_id,
      data.lote_importacion_id,
      data.calificacion_cuantitativa,
      data.valoracion_cualitativa,
      data.observacion_acompanamiento_pedagogico || null,
      data.autoevaluacion_completada ?? false,
      data.coevaluacion_completada ?? false,
      data.aprobado,
      data.registrado_por_usuario_id,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get single SNEPA grade record by primary key with student and component names.
   */
  static async getMatriculaComponenteById(
    id: string,
    db: DbClient = pool
  ): Promise<any | null> {
    const query = `
      SELECT 
        mcs.*,
        cc.nombre_modulo,
        cc.codigo_componente,
        i.codigo_expediente,
        pa.nombres AS aspirante_nombres,
        pa.apellidos AS aspirante_apellidos,
        pa.numero_identificacion,
        pcc.actas_notas_cerradas
      FROM matricula_componentes_snepa mcs
      JOIN componentes_curriculares cc ON cc.id = mcs.componente_id
      JOIN inscripciones i ON i.id = mcs.inscripcion_id
      JOIN personas_aspirantes pa ON pa.id = i.aspirante_id
      LEFT JOIN programacion_componentes_cohorte pcc ON pcc.id = mcs.programacion_componente_id
      WHERE mcs.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Update grade manually and mark es_modificada_manualmente = TRUE.
   */
  static async updateMatriculaComponenteManual(
    id: string,
    data: {
      calificacion_cuantitativa?: number;
      valoracion_cualitativa?: EscalaCualitativaSnepa;
      observacion_acompanamiento_pedagogico?: string | null;
      autoevaluacion_completada?: boolean;
      coevaluacion_completada?: boolean;
      aprobado?: boolean;
      modificado_por_usuario_id: string;
    },
    db: DbClient = pool
  ): Promise<MatriculaComponenteRecord | null> {
    const query = `
      UPDATE matricula_componentes_snepa
      SET calificacion_cuantitativa = COALESCE($1, calificacion_cuantitativa),
          valoracion_cualitativa = COALESCE($2, valoracion_cualitativa),
          observacion_acompanamiento_pedagogico = COALESCE($3, observacion_acompanamiento_pedagogico),
          autoevaluacion_completada = COALESCE($4, autoevaluacion_completada),
          coevaluacion_completada = COALESCE($5, coevaluacion_completada),
          aprobado = COALESCE($6, aprobado),
          es_modificada_manualmente = TRUE,
          registrado_por_usuario_id = $7,
          fecha_registro = NOW()
      WHERE id = $8
      RETURNING *
    `;
    const values = [
      data.calificacion_cuantitativa !== undefined ? data.calificacion_cuantitativa : null,
      data.valoracion_cualitativa || null,
      data.observacion_acompanamiento_pedagogico !== undefined ? data.observacion_acompanamiento_pedagogico : null,
      data.autoevaluacion_completada !== undefined ? data.autoevaluacion_completada : null,
      data.coevaluacion_completada !== undefined ? data.coevaluacion_completada : null,
      data.aprobado !== undefined ? data.aprobado : null,
      data.modificado_por_usuario_id,
      id,
    ];
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Insert audit log for manual grade modifications.
   */
  static async insertNotaSnepaLog(
    data: {
      matricula_componente_id: string;
      nota_anterior: number | null;
      nota_nueva: number | null;
      cualitativa_anterior: EscalaCualitativaSnepa | null;
      cualitativa_nueva: EscalaCualitativaSnepa | null;
      motivo_modificacion: string;
      modificado_por_usuario_id: string;
    },
    db: DbClient = pool
  ): Promise<NotaSnepaLogRecord> {
    const query = `
      INSERT INTO notas_snepa_logs (
        matricula_componente_id,
        nota_anterior,
        nota_nueva,
        cualitativa_anterior,
        cualitativa_nueva,
        motivo_modificacion,
        modificado_por_usuario_id,
        fecha_modificacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const values = [
      data.matricula_componente_id,
      data.nota_anterior,
      data.nota_nueva,
      data.cualitativa_anterior,
      data.cualitativa_nueva,
      data.motivo_modificacion,
      data.modificado_por_usuario_id,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all student grades for a given modular schedule (programacion_componentes_cohorte).
   */
  static async getGradesByComponent(
    programacionComponenteId: string,
    db: DbClient = pool
  ): Promise<any[]> {
    const query = `
      SELECT 
        mcs.*,
        i.codigo_expediente,
        pa.nombres,
        pa.apellidos,
        pa.numero_identificacion,
        u.email AS registrado_por_email
      FROM matricula_componentes_snepa mcs
      JOIN inscripciones i ON i.id = mcs.inscripcion_id
      JOIN personas_aspirantes pa ON pa.id = i.aspirante_id
      LEFT JOIN usuarios u ON u.id = mcs.registrado_por_usuario_id
      WHERE mcs.programacion_componente_id = $1
      ORDER BY pa.apellidos ASC, pa.nombres ASC
    `;
    const result = await db.query(query, [programacionComponenteId]);
    return result.rows;
  }

  /**
   * Get all curricular component grades for an enrollment (academic transcript / kardex).
   */
  static async getGradesByInscripcion(
    inscripcionId: string,
    db: DbClient = pool
  ): Promise<any[]> {
    const query = `
      SELECT 
        mcs.*,
        cc.nombre_modulo,
        cc.codigo_componente,
        cc.creditos_academicos,
        cc.orden_secuencia,
        pcc.fecha_inicio,
        pcc.fecha_fin
      FROM matricula_componentes_snepa mcs
      JOIN componentes_curriculares cc ON cc.id = mcs.componente_id
      LEFT JOIN programacion_componentes_cohorte pcc ON pcc.id = mcs.programacion_componente_id
      WHERE mcs.inscripcion_id = $1
      ORDER BY cc.orden_secuencia ASC, cc.nombre_modulo ASC
    `;
    const result = await db.query(query, [inscripcionId]);
    return result.rows;
  }

  /**
   * Get audit log history for a specific student grade component.
   */
  static async getGradeLogsByMatricula(
    matriculaComponenteId: string,
    db: DbClient = pool
  ): Promise<any[]> {
    const query = `
      SELECT 
        nl.*,
        u.email AS modificado_por_email,
        u.rol AS modificado_por_rol
      FROM notas_snepa_logs nl
      JOIN usuarios u ON u.id = nl.modificado_por_usuario_id
      WHERE nl.matricula_componente_id = $1
      ORDER BY nl.fecha_modificacion DESC
    `;
    const result = await db.query(query, [matriculaComponenteId]);
    return result.rows;
  }

  /**
   * List all batch import lots for a scheduled component.
   */
  static async getLotesByProgramacionComponente(
    programacionComponenteId: string,
    db: DbClient = pool
  ): Promise<any[]> {
    const query = `
      SELECT 
        li.*,
        u.email AS subido_por_email
      FROM lotes_importacion_notas li
      JOIN usuarios u ON u.id = li.subido_por_usuario_id
      WHERE li.programacion_componente_id = $1
      ORDER BY li.created_at DESC
    `;
    const result = await db.query(query, [programacionComponenteId]);
    return result.rows;
  }
}
