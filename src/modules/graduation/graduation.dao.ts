import { pool, DbClient } from '../../db/pool';
import {
  NivelIdiomaMcer,
  TipoDocumentoFinal,
  TipoPublicacionCientifica,
  AlcancePublicacion,
} from '../../types/enums';

export interface ExpedienteGraduacionRecord {
  id: string;
  inscripcion_id: string;
  idioma_acreditado: string | null;
  nivel_idioma_alcanzado: NivelIdiomaMcer;
  institucion_aval_idioma: string | null;
  certificado_idioma_url: string | null;
  idioma_validado: boolean;
  modalidad_graduacion_tipo: string | null;
  titulo_trabajo_graduacion: string | null;
  acta_defensa_url: string | null;
  aplico_salida_intermedia: boolean;
  titulo_intermedio_emitido_url: string | null;
  tipo_documento_final: TipoDocumentoFinal;
  codigo_registro_titulo_emitido: string | null;
  documento_final_url: string | null;
  fecha_emision: string | null;
  emitido_por_usuario_id: string | null;
}

export interface PublicacionCientificaRecord {
  id: string;
  expediente_graduacion_id: string;
  tipo_publicacion: TipoPublicacionCientifica;
  titulo_publicacion: string;
  nombre_revista_o_medio: string;
  es_revista_indexada: boolean;
  tiene_revision_pares: boolean;
  alcance: AlcancePublicacion | null;
  url_o_doi: string;
  evidencia_pdf_url: string;
  validado_coordinacion: boolean;
}

export class GraduationDAO {
  /**
   * Create graduation dossier for an academic enrollment.
   */
  static async createExpediente(
    data: {
      inscripcion_id: string;
      tipo_documento_final: TipoDocumentoFinal;
      idioma_acreditado?: string | null;
      nivel_idioma_alcanzado?: NivelIdiomaMcer;
      institucion_aval_idioma?: string | null;
      certificado_idioma_url?: string | null;
      modalidad_graduacion_tipo?: string | null;
      titulo_trabajo_graduacion?: string | null;
      acta_defensa_url?: string | null;
      aplico_salida_intermedia?: boolean;
      titulo_intermedio_emitido_url?: string | null;
    },
    db: DbClient = pool
  ): Promise<ExpedienteGraduacionRecord> {
    const query = `
      INSERT INTO expediente_graduacion_certificacion (
        inscripcion_id,
        tipo_documento_final,
        idioma_acreditado,
        nivel_idioma_alcanzado,
        institucion_aval_idioma,
        certificado_idioma_url,
        modalidad_graduacion_tipo,
        titulo_trabajo_graduacion,
        acta_defensa_url,
        aplico_salida_intermedia,
        titulo_intermedio_emitido_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      data.inscripcion_id,
      data.tipo_documento_final,
      data.idioma_acreditado || null,
      data.nivel_idioma_alcanzado || NivelIdiomaMcer.NINGUNO,
      data.institucion_aval_idioma || null,
      data.certificado_idioma_url || null,
      data.modalidad_graduacion_tipo || null,
      data.titulo_trabajo_graduacion || null,
      data.acta_defensa_url || null,
      data.aplico_salida_intermedia ?? false,
      data.titulo_intermedio_emitido_url || null,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get graduation dossier by primary key.
   */
  static async getExpedienteById(id: string, db: DbClient = pool): Promise<any | null> {
    const query = `
      SELECT 
        egc.*,
        i.codigo_expediente,
        i.estado AS inscripcion_estado,
        pa.nombres AS aspirante_nombres,
        pa.apellidos AS aspirante_apellidos,
        pa.numero_identificacion,
        pr.nombre AS programa_nombre,
        pr.subtipo AS programa_subtipo,
        ca.codigo_cohorte
      FROM expediente_graduacion_certificacion egc
      JOIN inscripciones i ON i.id = egc.inscripcion_id
      JOIN personas_aspirantes pa ON pa.id = i.aspirante_id
      JOIN cohortes_apertura ca ON ca.id = i.cohorte_id
      JOIN programas_academicos pr ON pr.id = ca.programa_id
      WHERE egc.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get graduation dossier by enrollment ID (inscripcion_id).
   */
  static async getExpedienteByInscripcionId(
    inscripcionId: string,
    db: DbClient = pool
  ): Promise<any | null> {
    const query = `
      SELECT 
        egc.*,
        i.codigo_expediente,
        i.estado AS inscripcion_estado,
        pa.nombres AS aspirante_nombres,
        pa.apellidos AS aspirante_apellidos,
        pa.numero_identificacion,
        pr.nombre AS programa_nombre,
        pr.subtipo AS programa_subtipo,
        ca.codigo_cohorte
      FROM expediente_graduacion_certificacion egc
      JOIN inscripciones i ON i.id = egc.inscripcion_id
      JOIN personas_aspirantes pa ON pa.id = i.aspirante_id
      JOIN cohortes_apertura ca ON ca.id = i.cohorte_id
      JOIN programas_academicos pr ON pr.id = ca.programa_id
      WHERE egc.inscripcion_id = $1
    `;
    const result = await db.query(query, [inscripcionId]);
    return result.rows[0] || null;
  }

  /**
   * Update graduation dossier fields.
   */
  static async updateExpediente(
    id: string,
    data: {
      idioma_acreditado?: string | null;
      nivel_idioma_alcanzado?: NivelIdiomaMcer;
      institucion_aval_idioma?: string | null;
      certificado_idioma_url?: string | null;
      idioma_validado?: boolean;
      modalidad_graduacion_tipo?: string | null;
      titulo_trabajo_graduacion?: string | null;
      acta_defensa_url?: string | null;
      aplico_salida_intermedia?: boolean;
      titulo_intermedio_emitido_url?: string | null;
      tipo_documento_final?: TipoDocumentoFinal;
    },
    db: DbClient = pool
  ): Promise<ExpedienteGraduacionRecord | null> {
    const query = `
      UPDATE expediente_graduacion_certificacion
      SET idioma_acreditado = COALESCE($1, idioma_acreditado),
          nivel_idioma_alcanzado = COALESCE($2, nivel_idioma_alcanzado),
          institucion_aval_idioma = COALESCE($3, institucion_aval_idioma),
          certificado_idioma_url = COALESCE($4, certificado_idioma_url),
          idioma_validado = COALESCE($5, idioma_validado),
          modalidad_graduacion_tipo = COALESCE($6, modalidad_graduacion_tipo),
          titulo_trabajo_graduacion = COALESCE($7, titulo_trabajo_graduacion),
          acta_defensa_url = COALESCE($8, acta_defensa_url),
          aplico_salida_intermedia = COALESCE($9, aplico_salida_intermedia),
          titulo_intermedio_emitido_url = COALESCE($10, titulo_intermedio_emitido_url),
          tipo_documento_final = COALESCE($11, tipo_documento_final)
      WHERE id = $12
      RETURNING *
    `;
    const values = [
      data.idioma_acreditado !== undefined ? data.idioma_acreditado : null,
      data.nivel_idioma_alcanzado || null,
      data.institucion_aval_idioma !== undefined ? data.institucion_aval_idioma : null,
      data.certificado_idioma_url !== undefined ? data.certificado_idioma_url : null,
      data.idioma_validado !== undefined ? data.idioma_validado : null,
      data.modalidad_graduacion_tipo !== undefined ? data.modalidad_graduacion_tipo : null,
      data.titulo_trabajo_graduacion !== undefined ? data.titulo_trabajo_graduacion : null,
      data.acta_defensa_url !== undefined ? data.acta_defensa_url : null,
      data.aplico_salida_intermedia !== undefined ? data.aplico_salida_intermedia : null,
      data.titulo_intermedio_emitido_url !== undefined ? data.titulo_intermedio_emitido_url : null,
      data.tipo_documento_final || null,
      id,
    ];
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Retrieves complete contextual requirements for graduation verification.
   */
  static async getGraduationRequirementsContext(
    expedienteId: string,
    db: DbClient = pool
  ): Promise<any | null> {
    const query = `
      SELECT 
        egc.*,
        i.id AS inscripcion_id,
        i.codigo_expediente,
        i.estado AS inscripcion_estado,
        pa.id AS aspirante_id,
        pa.usuario_id AS aspirante_usuario_id,
        pa.nombres AS aspirante_nombres,
        pa.apellidos AS aspirante_apellidos,
        pa.numero_identificacion,
        pr.id AS programa_id,
        pr.nombre AS programa_nombre,
        pr.categoria AS programa_categoria,
        pr.subtipo AS programa_subtipo,
        pr.idioma_egreso_requerido,
        pr.num_publicaciones_requeridas,
        pr.requiere_revista_indexada,
        pr.requiere_pares_evaluadores,
        pr.titulo_o_certificado_otorgado,
        ca.id AS cohorte_id,
        ca.codigo_cohorte
      FROM expediente_graduacion_certificacion egc
      JOIN inscripciones i ON i.id = egc.inscripcion_id
      JOIN personas_aspirantes pa ON pa.id = i.aspirante_id
      JOIN cohortes_apertura ca ON ca.id = i.cohorte_id
      JOIN programas_academicos pr ON pr.id = ca.programa_id
      WHERE egc.id = $1
      FOR UPDATE OF egc
    `;
    const result = await db.query(query, [expedienteId]);
    return result.rows[0] || null;
  }

  /**
   * Insert student scientific publication into publicaciones_cientificas_estudiante.
   */
  static async createPublicacionCientifica(
    data: {
      expediente_graduacion_id: string;
      tipo_publicacion: TipoPublicacionCientifica;
      titulo_publicacion: string;
      nombre_revista_o_medio: string;
      es_revista_indexada: boolean;
      tiene_revision_pares: boolean;
      alcance?: AlcancePublicacion | null;
      url_o_doi: string;
      evidencia_pdf_url: string;
      validado_coordinacion?: boolean;
    },
    db: DbClient = pool
  ): Promise<PublicacionCientificaRecord> {
    const query = `
      INSERT INTO publicaciones_cientificas_estudiante (
        expediente_graduacion_id,
        tipo_publicacion,
        titulo_publicacion,
        nombre_revista_o_medio,
        es_revista_indexada,
        tiene_revision_pares,
        alcance,
        url_o_doi,
        evidencia_pdf_url,
        validado_coordinacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      data.expediente_graduacion_id,
      data.tipo_publicacion,
      data.titulo_publicacion,
      data.nombre_revista_o_medio,
      data.es_revista_indexada,
      data.tiene_revision_pares,
      data.alcance || null,
      data.url_o_doi,
      data.evidencia_pdf_url,
      data.validado_coordinacion ?? false,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all publications for an expediente.
   */
  static async getPublicacionesByExpedienteId(
    expedienteId: string,
    db: DbClient = pool
  ): Promise<PublicacionCientificaRecord[]> {
    const query = `
      SELECT *
      FROM publicaciones_cientificas_estudiante
      WHERE expediente_graduacion_id = $1
      ORDER BY id ASC
    `;
    const result = await db.query(query, [expedienteId]);
    return result.rows;
  }

  /**
   * Get single publication by ID.
   */
  static async getPublicacionById(
    publicationId: string,
    db: DbClient = pool
  ): Promise<PublicacionCientificaRecord | null> {
    const query = `
      SELECT *
      FROM publicaciones_cientificas_estudiante
      WHERE id = $1
    `;
    const result = await db.query(query, [publicationId]);
    return result.rows[0] || null;
  }

  /**
   * Update publication validation status by coordination.
   */
  static async updatePublicacionValidacion(
    publicationId: string,
    validado: boolean,
    db: DbClient = pool
  ): Promise<PublicacionCientificaRecord | null> {
    const query = `
      UPDATE publicaciones_cientificas_estudiante
      SET validado_coordinacion = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [validado, publicationId]);
    return result.rows[0] || null;
  }

  /**
   * Count validated scientific publications meeting specific academic criteria.
   */
  static async countValidatedPublications(
    expedienteId: string,
    requiresIndexed: boolean,
    requiresPeerReview: boolean,
    db: DbClient = pool
  ): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM publicaciones_cientificas_estudiante
      WHERE expediente_graduacion_id = $1
        AND validado_coordinacion = TRUE
        AND ($2::boolean IS FALSE OR es_revista_indexada = TRUE)
        AND ($3::boolean IS FALSE OR tiene_revision_pares = TRUE)
    `;
    const result = await db.query(query, [expedienteId, requiresIndexed, requiresPeerReview]);
    return result.rows[0]?.count || 0;
  }

  /**
   * Update issuance fields on expediente_graduacion_certificacion.
   */
  static async issueExpedienteDocument(
    expedienteId: string,
    data: {
      codigo_registro_titulo_emitido: string;
      documento_final_url?: string | null;
      fecha_emision: string;
      emitido_por_usuario_id: string;
      tipo_documento_final?: TipoDocumentoFinal;
    },
    db: DbClient = pool
  ): Promise<ExpedienteGraduacionRecord | null> {
    const query = `
      UPDATE expediente_graduacion_certificacion
      SET codigo_registro_titulo_emitido = $1,
          documento_final_url = COALESCE($2, documento_final_url),
          fecha_emision = $3,
          emitido_por_usuario_id = $4,
          tipo_documento_final = COALESCE($5, tipo_documento_final)
      WHERE id = $6
      RETURNING *
    `;
    const values = [
      data.codigo_registro_titulo_emitido,
      data.documento_final_url || null,
      data.fecha_emision,
      data.emitido_por_usuario_id,
      data.tipo_documento_final || null,
      expedienteId,
    ];
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Update enrollment status in inscripciones table.
   */
  static async updateInscripcionEstado(
    inscripcionId: string,
    nuevoEstado: string,
    db: DbClient = pool
  ): Promise<void> {
    const query = `
      UPDATE inscripciones
      SET estado = $1::estado_inscripcion_enum
      WHERE id = $2
    `;
    await db.query(query, [nuevoEstado, inscripcionId]);
  }

  /**
   * Public QR or code verification of issued degrees and certificates.
   */
  static async findExpedienteByCodigoRegistro(
    codigoRegistro: string,
    db: DbClient = pool
  ): Promise<any | null> {
    const query = `
      SELECT 
        egc.id AS expediente_id,
        egc.codigo_registro_titulo_emitido,
        egc.tipo_documento_final,
        egc.documento_final_url,
        egc.fecha_emision,
        pa.nombres AS aspirante_nombres,
        pa.apellidos AS aspirante_apellidos,
        pa.numero_identificacion,
        pa.tipo_identificacion,
        pr.nombre AS programa_nombre,
        pr.subtipo AS programa_subtipo,
        pr.categoria AS programa_categoria,
        pr.titulo_o_certificado_otorgado,
        ca.codigo_cohorte,
        s.nombre AS nombre_sede
      FROM expediente_graduacion_certificacion egc
      JOIN inscripciones i ON i.id = egc.inscripcion_id
      JOIN personas_aspirantes pa ON pa.id = i.aspirante_id
      JOIN cohortes_apertura ca ON ca.id = i.cohorte_id
      JOIN sedes_ies s ON s.id = ca.sede_id
      JOIN programas_academicos pr ON pr.id = ca.programa_id
      WHERE egc.codigo_registro_titulo_emitido = $1
    `;
    const result = await db.query(query, [codigoRegistro]);
    return result.rows[0] || null;
  }
}
