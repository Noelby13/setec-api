import { pool, DbClient, withTransaction } from '../../db/pool';

export interface CohorteRecord {
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
  horario_general: string | null;
  precio_matricula: number | string;
  precio_total_cohorte: number | string;
  descuento_porcentaje: number;
  cupo_minimo: number;
  cupo_maximo: number;
  cupos_actuales_verificados: number;
  cobro_habilitado: boolean;
  tiene_excepcion_cupo_setec: boolean;
  excepcion_cupo_setec_url: string | null;
  estado_cohorte: string;
  informe_evaluacion_cohorte_url: string | null;
  created_at: string;
}

export interface ProgramacionComponenteRecord {
  id: string;
  cohorte_id: string;
  componente_id: string;
  docente_titular_id: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horario: string | null;
  aula: string | null;
  codigo_aula_virtual_externa: string | null;
  actas_notas_cerradas: boolean;
}

export interface ProgramacionDetailRecord extends ProgramacionComponenteRecord {
  componente_codigo: string;
  componente_nombre: string;
  orden_bloque: number;
  horas: number;
  creditos: number;
  docente_nombres?: string | null;
  docente_apellidos?: string | null;
  docente_identificacion?: string | null;
  docente_maximo_grado?: string | null;
}

export interface CohorteDetailRecord extends CohorteRecord {
  programa_nombre: string;
  programa_codigo: string;
  programa_subtipo: string;
  es_ciencias_salud: boolean;
  sede_nombre: string;
  sede_codigo: string;
  coordinador_nombres: string;
  coordinador_apellidos: string;
  coordinador_identificacion: string;
  programacion?: ProgramacionDetailRecord[];
}

export interface CreateCohorteData {
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
  horario_general?: string | null;
  precio_matricula?: number;
  precio_total_cohorte: number;
  descuento_porcentaje?: number;
  cupo_minimo?: number;
  cupo_maximo?: number;
  tiene_excepcion_cupo_setec?: boolean;
  excepcion_cupo_setec_url?: string | null;
  estado_cohorte?: string;
}

export interface UpdateCohorteData extends Partial<CreateCohorteData> {
  cupos_actuales_verificados?: number;
  cobro_habilitado?: boolean;
  informe_evaluacion_cohorte_url?: string | null;
}

export interface ProgramarComponenteData {
  cohorte_id: string;
  componente_id: string;
  docente_titular_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  horario?: string | null;
  aula?: string | null;
  codigo_aula_virtual_externa?: string | null;
  actas_notas_cerradas?: boolean;
}

export interface UpdateProgramacionData {
  docente_titular_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  horario?: string | null;
  aula?: string | null;
  codigo_aula_virtual_externa?: string | null;
  actas_notas_cerradas?: boolean;
}

export interface CohorteFilter {
  programa_id?: string;
  sede_id?: string;
  modalidad?: string;
  estado_cohorte?: string;
  search?: string;
}

export class CohortDao {
  // ==========================================
  // COHORTES DE APERTURA (SQL PURO)
  // ==========================================

  /**
   * Insert a new academic cohort.
   */
  static async createCohorte(
    data: CreateCohorteData,
    db: DbClient = pool
  ): Promise<CohorteRecord> {
    const query = `
      INSERT INTO cohortes_apertura (
        programa_id, sede_id, modalidad, codigo_cohorte, numero_edicion, coordinador_id,
        fecha_inicio_inscripcion, fecha_fin_inscripcion, fecha_inicio_clases, fecha_fin_clases,
        horario_general, precio_matricula, precio_total_cohorte, descuento_porcentaje,
        cupo_minimo, cupo_maximo, cupos_actuales_verificados, cobro_habilitado,
        tiene_excepcion_cupo_setec, excepcion_cupo_setec_url, estado_cohorte
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21
      )
      RETURNING *;
    `;

    const values = [
      data.programa_id,
      data.sede_id,
      data.modalidad,
      data.codigo_cohorte,
      data.numero_edicion,
      data.coordinador_id,
      data.fecha_inicio_inscripcion,
      data.fecha_fin_inscripcion,
      data.fecha_inicio_clases,
      data.fecha_fin_clases,
      data.horario_general || null,
      data.precio_matricula ?? 0,
      data.precio_total_cohorte,
      data.descuento_porcentaje ?? 0,
      data.cupo_minimo ?? 15,
      data.cupo_maximo ?? 30,
      0, // cupos_actuales_verificados
      false, // cobro_habilitado
      data.tiene_excepcion_cupo_setec ?? false,
      data.excepcion_cupo_setec_url || null,
      data.estado_cohorte || 'PLANIFICADA',
    ];

    const res = await db.query<CohorteRecord>(query, values);
    return res.rows[0];
  }

  /**
   * Find a cohort by UUID with full details, program info, campus info, coordinator and modules.
   */
  static async findCohorteById(
    id: string,
    db: DbClient = pool
  ): Promise<CohorteDetailRecord | null> {
    const query = `
      SELECT 
        c.*,
        p.nombre AS programa_nombre,
        p.codigo_interno AS programa_codigo,
        p.subtipo AS programa_subtipo,
        p.es_ciencias_salud,
        s.nombre AS sede_nombre,
        s.codigo_sede,
        doc.nombres AS coordinador_nombres,
        doc.apellidos AS coordinador_apellidos,
        doc.identificacion AS coordinador_identificacion,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pc.id,
                'cohorte_id', pc.cohorte_id,
                'componente_id', pc.componente_id,
                'componente_codigo', comp.codigo,
                'componente_nombre', comp.nombre,
                'orden_bloque', comp.orden_bloque,
                'horas', comp.horas,
                'creditos', comp.creditos,
                'docente_titular_id', pc.docente_titular_id,
                'docente_nombres', dt.nombres,
                'docente_apellidos', dt.apellidos,
                'docente_identificacion', dt.identificacion,
                'docente_maximo_grado', dt.maximo_grado_academico,
                'fecha_inicio', pc.fecha_inicio,
                'fecha_fin', pc.fecha_fin,
                'horario', pc.horario,
                'aula', pc.aula,
                'codigo_aula_virtual_externa', pc.codigo_aula_virtual_externa,
                'actas_notas_cerradas', pc.actas_notas_cerradas
              ) ORDER BY comp.orden_bloque ASC, comp.codigo ASC
            )
            FROM programacion_componentes_cohorte pc
            JOIN componentes_curriculares comp ON pc.componente_id = comp.id
            LEFT JOIN personal_academico dt ON pc.docente_titular_id = dt.id
            WHERE pc.cohorte_id = c.id
          ),
          '[]'::json
        ) AS programacion
      FROM cohortes_apertura c
      JOIN programas_academicos p ON c.programa_id = p.id
      JOIN sedes_ies s ON c.sede_id = s.id
      JOIN personal_academico doc ON c.coordinador_id = doc.id
      WHERE c.id = $1
      LIMIT 1;
    `;

    const res = await db.query<CohorteDetailRecord>(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Find cohort by its unique cohort code.
   */
  static async findCohorteByCodigo(
    codigo: string,
    db: DbClient = pool
  ): Promise<CohorteRecord | null> {
    const query = `
      SELECT * FROM cohortes_apertura WHERE codigo_cohorte = $1 LIMIT 1;
    `;
    const res = await db.query<CohorteRecord>(query, [codigo]);
    return res.rows[0] || null;
  }

  /**
   * List cohorts with optional filters.
   */
  static async listCohortes(
    filter: CohorteFilter = {},
    db: DbClient = pool
  ): Promise<CohorteDetailRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter.programa_id) {
      conditions.push(`c.programa_id = $${idx++}`);
      values.push(filter.programa_id);
    }

    if (filter.sede_id) {
      conditions.push(`c.sede_id = $${idx++}`);
      values.push(filter.sede_id);
    }

    if (filter.modalidad) {
      conditions.push(`c.modalidad = $${idx++}`);
      values.push(filter.modalidad);
    }

    if (filter.estado_cohorte) {
      conditions.push(`c.estado_cohorte = $${idx++}`);
      values.push(filter.estado_cohorte);
    }

    if (filter.search) {
      conditions.push(`(c.codigo_cohorte ILIKE $${idx} OR p.nombre ILIKE $${idx} OR s.nombre ILIKE $${idx})`);
      values.push(`%${filter.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        c.*,
        p.nombre AS programa_nombre,
        p.codigo_interno AS programa_codigo,
        p.subtipo AS programa_subtipo,
        p.es_ciencias_salud,
        s.nombre AS sede_nombre,
        s.codigo_sede,
        doc.nombres AS coordinador_nombres,
        doc.apellidos AS coordinador_apellidos,
        doc.identificacion AS coordinador_identificacion
      FROM cohortes_apertura c
      JOIN programas_academicos p ON c.programa_id = p.id
      JOIN sedes_ies s ON c.sede_id = s.id
      JOIN personal_academico doc ON c.coordinador_id = doc.id
      ${whereClause}
      ORDER BY c.fecha_inicio_clases DESC;
    `;

    const res = await db.query<CohorteDetailRecord>(query, values);
    return res.rows;
  }

  /**
   * Update a cohort record.
   */
  static async updateCohorte(
    id: string,
    data: UpdateCohorteData,
    db: DbClient = pool
  ): Promise<CohorteRecord | null> {
    const keys = Object.keys(data) as Array<keyof UpdateCohorteData>;
    if (keys.length === 0) {
      const res = await db.query<CohorteRecord>(
        'SELECT * FROM cohortes_apertura WHERE id = $1;',
        [id]
      );
      return res.rows[0] || null;
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
      UPDATE cohortes_apertura
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const res = await db.query<CohorteRecord>(query, values);
    return res.rows[0] || null;
  }

  /**
   * Delete a cohort and its programmed components.
   */
  static async deleteCohorte(id: string, db: DbClient = pool): Promise<boolean> {
    const execute = async (client: DbClient) => {
      await client.query('DELETE FROM programacion_componentes_cohorte WHERE cohorte_id = $1;', [id]);
      const res = await client.query('DELETE FROM cohortes_apertura WHERE id = $1 RETURNING id;', [id]);
      return (res.rowCount ?? 0) > 0;
    };

    if ('connect' in db) {
      return withTransaction(execute);
    }
    return execute(db);
  }

  // ==========================================
  // PROGRAMACIÓN DE COMPONENTES POR COHORTE (SQL PURO)
  // ==========================================

  /**
   * Assign a teacher, dates, schedule, and classroom to a curriculum component in a cohort.
   */
  static async programarComponente(
    data: ProgramarComponenteData,
    db: DbClient = pool
  ): Promise<ProgramacionComponenteRecord> {
    const query = `
      INSERT INTO programacion_componentes_cohorte (
        cohorte_id, componente_id, docente_titular_id,
        fecha_inicio, fecha_fin, horario, aula,
        codigo_aula_virtual_externa, actas_notas_cerradas
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9
      )
      ON CONFLICT (cohorte_id, componente_id) DO UPDATE SET
        docente_titular_id = EXCLUDED.docente_titular_id,
        fecha_inicio = EXCLUDED.fecha_inicio,
        fecha_fin = EXCLUDED.fecha_fin,
        horario = EXCLUDED.horario,
        aula = EXCLUDED.aula,
        codigo_aula_virtual_externa = EXCLUDED.codigo_aula_virtual_externa,
        actas_notas_cerradas = EXCLUDED.actas_notas_cerradas
      RETURNING *;
    `;

    const values = [
      data.cohorte_id,
      data.componente_id,
      data.docente_titular_id || null,
      data.fecha_inicio || null,
      data.fecha_fin || null,
      data.horario || null,
      data.aula || null,
      data.codigo_aula_virtual_externa || null,
      data.actas_notas_cerradas ?? false,
    ];

    const res = await db.query<ProgramacionComponenteRecord>(query, values);
    return res.rows[0];
  }

  /**
   * Find component scheduling by cohort ID and component ID.
   */
  static async findProgramacionByCohorteAndComponente(
    cohorteId: string,
    componenteId: string,
    db: DbClient = pool
  ): Promise<ProgramacionComponenteRecord | null> {
    const query = `
      SELECT * FROM programacion_componentes_cohorte
      WHERE cohorte_id = $1 AND componente_id = $2
      LIMIT 1;
    `;
    const res = await db.query<ProgramacionComponenteRecord>(query, [cohorteId, componenteId]);
    return res.rows[0] || null;
  }

  /**
   * List all programmed components for a cohort ordered by orden_bloque.
   */
  static async listProgramacionByCohorte(
    cohorteId: string,
    db: DbClient = pool
  ): Promise<ProgramacionDetailRecord[]> {
    const query = `
      SELECT 
        pc.id,
        pc.cohorte_id,
        pc.componente_id,
        comp.codigo AS componente_codigo,
        comp.nombre AS componente_nombre,
        comp.orden_bloque,
        comp.horas,
        comp.creditos,
        pc.docente_titular_id,
        dt.nombres AS docente_nombres,
        dt.apellidos AS docente_apellidos,
        dt.identificacion AS docente_identificacion,
        dt.maximo_grado_academico AS docente_maximo_grado,
        pc.fecha_inicio,
        pc.fecha_fin,
        pc.horario,
        pc.aula,
        pc.codigo_aula_virtual_externa,
        pc.actas_notas_cerradas
      FROM programacion_componentes_cohorte pc
      JOIN componentes_curriculares comp ON pc.componente_id = comp.id
      LEFT JOIN personal_academico dt ON pc.docente_titular_id = dt.id
      WHERE pc.cohorte_id = $1
      ORDER BY comp.orden_bloque ASC, comp.codigo ASC;
    `;

    const res = await db.query<ProgramacionDetailRecord>(query, [cohorteId]);
    return res.rows;
  }

  /**
   * Update component scheduling for a cohort.
   */
  static async updateProgramacion(
    cohorteId: string,
    componenteId: string,
    data: UpdateProgramacionData,
    db: DbClient = pool
  ): Promise<ProgramacionComponenteRecord | null> {
    const keys = Object.keys(data) as Array<keyof UpdateProgramacionData>;
    if (keys.length === 0) {
      return CohortDao.findProgramacionByCohorteAndComponente(cohorteId, componenteId, db);
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of keys) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }

    values.push(cohorteId, componenteId);
    const query = `
      UPDATE programacion_componentes_cohorte
      SET ${setClauses.join(', ')}
      WHERE cohorte_id = $${idx++} AND componente_id = $${idx}
      RETURNING *;
    `;

    const res = await db.query<ProgramacionComponenteRecord>(query, values);
    return res.rows[0] || null;
  }

  /**
   * Remove a component scheduling from a cohort.
   */
  static async deleteProgramacion(
    cohorteId: string,
    componenteId: string,
    db: DbClient = pool
  ): Promise<boolean> {
    const query = `
      DELETE FROM programacion_componentes_cohorte
      WHERE cohorte_id = $1 AND componente_id = $2
      RETURNING id;
    `;
    const res = await db.query(query, [cohorteId, componenteId]);
    return (res.rowCount ?? 0) > 0;
  }
}
