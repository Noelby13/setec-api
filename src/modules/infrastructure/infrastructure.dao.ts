import { pool, DbClient } from '../../db/pool';
import { TipoSede, MaximoGradoAcademico } from '../../types/enums';

// ==========================================
// INTERFACES: SEDES UNIVERSITARIAS
// ==========================================

export interface SedeIesRecord {
  id: string;
  codigo_sede: string;
  nombre: string;
  tipo_sede: TipoSede;
  resolucion_autorizacion_setec: string | null;
  direccion: string | null;
  activa: boolean;
  created_at: Date;
}

export interface CreateSedeData {
  codigo_sede: string;
  nombre: string;
  tipo_sede: TipoSede;
  resolucion_autorizacion_setec?: string | null;
  direccion?: string | null;
  activa?: boolean;
}

export interface UpdateSedeData {
  codigo_sede?: string;
  nombre?: string;
  tipo_sede?: TipoSede;
  resolucion_autorizacion_setec?: string | null;
  direccion?: string | null;
  activa?: boolean;
}

// ==========================================
// INTERFACES: PERSONAL ACADÉMICO / DOCENTES
// ==========================================

export interface DocenteRecord {
  id: string;
  usuario_id: string | null;
  identificacion: string;
  nombres: string;
  apellidos: string;
  maximo_grado_academico: MaximoGradoAcademico;
  biografia_comercial: string | null;
  foto_perfil_url: string | null;
  cv_url: string;
  activo: boolean;
  created_at: Date;
  usuario_email?: string | null;
  usuario_username?: string | null;
  rol_nombre?: string | null;
}

export interface CreateDocenteData {
  usuario_id?: string | null;
  identificacion: string;
  nombres: string;
  apellidos: string;
  maximo_grado_academico: MaximoGradoAcademico;
  biografia_comercial?: string | null;
  foto_perfil_url?: string | null;
  cv_url: string;
  activo?: boolean;
}

export interface UpdateDocenteData {
  usuario_id?: string | null;
  identificacion?: string;
  nombres?: string;
  apellidos?: string;
  maximo_grado_academico?: MaximoGradoAcademico;
  biografia_comercial?: string | null;
  foto_perfil_url?: string | null;
  cv_url?: string;
  activo?: boolean;
}

export class InfrastructureDao {
  // ==========================================
  // GESTIÓN DE SEDES IES
  // ==========================================

  /**
   * List all university campuses (sedes), optionally filtering only active ones.
   */
  static async listSedes(
    onlyActive = false,
    db: DbClient = pool
  ): Promise<SedeIesRecord[]> {
    const query = onlyActive
      ? `SELECT id, codigo_sede, nombre, tipo_sede, resolucion_autorizacion_setec, direccion, activa, created_at
         FROM sedes_ies
         WHERE activa = TRUE
         ORDER BY nombre ASC;`
      : `SELECT id, codigo_sede, nombre, tipo_sede, resolucion_autorizacion_setec, direccion, activa, created_at
         FROM sedes_ies
         ORDER BY nombre ASC;`;

    const result = await db.query<SedeIesRecord>(query);
    return result.rows;
  }

  /**
   * Find a campus by its UUID.
   */
  static async findSedeById(id: string, db: DbClient = pool): Promise<SedeIesRecord | null> {
    const query = `
      SELECT id, codigo_sede, nombre, tipo_sede, resolucion_autorizacion_setec, direccion, activa, created_at
      FROM sedes_ies
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await db.query<SedeIesRecord>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find a campus by its unique SETEC/institutional code.
   */
  static async findSedeByCodigo(codigoSede: string, db: DbClient = pool): Promise<SedeIesRecord | null> {
    const query = `
      SELECT id, codigo_sede, nombre, tipo_sede, resolucion_autorizacion_setec, direccion, activa, created_at
      FROM sedes_ies
      WHERE UPPER(codigo_sede) = UPPER($1)
      LIMIT 1;
    `;
    const result = await db.query<SedeIesRecord>(query, [codigoSede]);
    return result.rows[0] || null;
  }

  /**
   * Insert a new university campus.
   */
  static async createSede(
    data: CreateSedeData,
    db: DbClient = pool
  ): Promise<SedeIesRecord> {
    const query = `
      INSERT INTO sedes_ies (
        codigo_sede,
        nombre,
        tipo_sede,
        resolucion_autorizacion_setec,
        direccion,
        activa
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, codigo_sede, nombre, tipo_sede, resolucion_autorizacion_setec, direccion, activa, created_at;
    `;
    const values = [
      data.codigo_sede.toUpperCase(),
      data.nombre,
      data.tipo_sede,
      data.resolucion_autorizacion_setec || null,
      data.direccion || null,
      data.activa ?? true,
    ];
    const result = await db.query<SedeIesRecord>(query, values);
    return result.rows[0];
  }

  /**
   * Dynamically update an existing campus.
   */
  static async updateSede(
    id: string,
    data: UpdateSedeData,
    db: DbClient = pool
  ): Promise<SedeIesRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.codigo_sede !== undefined) {
      fields.push(`codigo_sede = $${index++}`);
      values.push(data.codigo_sede.toUpperCase());
    }
    if (data.nombre !== undefined) {
      fields.push(`nombre = $${index++}`);
      values.push(data.nombre);
    }
    if (data.tipo_sede !== undefined) {
      fields.push(`tipo_sede = $${index++}`);
      values.push(data.tipo_sede);
    }
    if (data.resolucion_autorizacion_setec !== undefined) {
      fields.push(`resolucion_autorizacion_setec = $${index++}`);
      values.push(data.resolucion_autorizacion_setec);
    }
    if (data.direccion !== undefined) {
      fields.push(`direccion = $${index++}`);
      values.push(data.direccion);
    }
    if (data.activa !== undefined) {
      fields.push(`activa = $${index++}`);
      values.push(data.activa);
    }

    if (fields.length === 0) {
      return this.findSedeById(id, db);
    }

    values.push(id);
    const query = `
      UPDATE sedes_ies
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING id, codigo_sede, nombre, tipo_sede, resolucion_autorizacion_setec, direccion, activa, created_at;
    `;

    const result = await db.query<SedeIesRecord>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete a campus by ID.
   */
  static async deleteSede(id: string, db: DbClient = pool): Promise<boolean> {
    const query = `DELETE FROM sedes_ies WHERE id = $1 RETURNING id;`;
    const result = await db.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==========================================
  // GESTIÓN DE PERSONAL ACADÉMICO / DOCENTES
  // ==========================================

  /**
   * List academic staff, joining with user account information if linked.
   */
  static async listDocentes(
    onlyActive = false,
    db: DbClient = pool
  ): Promise<DocenteRecord[]> {
    const query = `
      SELECT 
        pa.id,
        pa.usuario_id,
        pa.identificacion,
        pa.nombres,
        pa.apellidos,
        pa.maximo_grado_academico,
        pa.biografia_comercial,
        pa.foto_perfil_url,
        pa.cv_url,
        pa.activo,
        pa.created_at,
        u.email AS usuario_email,
        u.username AS usuario_username,
        r.nombre AS rol_nombre
      FROM personal_academico pa
      LEFT JOIN usuarios u ON pa.usuario_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      ${onlyActive ? 'WHERE pa.activo = TRUE' : ''}
      ORDER BY pa.apellidos ASC, pa.nombres ASC;
    `;
    const result = await db.query<DocenteRecord>(query);
    return result.rows;
  }

  /**
   * Find an academic staff member by ID with full user account details.
   */
  static async findDocenteById(id: string, db: DbClient = pool): Promise<DocenteRecord | null> {
    const query = `
      SELECT 
        pa.id,
        pa.usuario_id,
        pa.identificacion,
        pa.nombres,
        pa.apellidos,
        pa.maximo_grado_academico,
        pa.biografia_comercial,
        pa.foto_perfil_url,
        pa.cv_url,
        pa.activo,
        pa.created_at,
        u.email AS usuario_email,
        u.username AS usuario_username,
        r.nombre AS rol_nombre
      FROM personal_academico pa
      LEFT JOIN usuarios u ON pa.usuario_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE pa.id = $1
      LIMIT 1;
    `;
    const result = await db.query<DocenteRecord>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find an academic staff member by official identification (cédula/pasaporte).
   */
  static async findDocenteByIdentificacion(
    identificacion: string,
    db: DbClient = pool
  ): Promise<DocenteRecord | null> {
    const query = `
      SELECT 
        pa.id,
        pa.usuario_id,
        pa.identificacion,
        pa.nombres,
        pa.apellidos,
        pa.maximo_grado_academico,
        pa.biografia_comercial,
        pa.foto_perfil_url,
        pa.cv_url,
        pa.activo,
        pa.created_at,
        u.email AS usuario_email,
        u.username AS usuario_username,
        r.nombre AS rol_nombre
      FROM personal_academico pa
      LEFT JOIN usuarios u ON pa.usuario_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE UPPER(pa.identificacion) = UPPER($1)
      LIMIT 1;
    `;
    const result = await db.query<DocenteRecord>(query, [identificacion]);
    return result.rows[0] || null;
  }

  /**
   * Find an academic staff member by linked user ID.
   */
  static async findDocenteByUsuarioId(
    usuarioId: string,
    db: DbClient = pool
  ): Promise<DocenteRecord | null> {
    const query = `
      SELECT 
        pa.id,
        pa.usuario_id,
        pa.identificacion,
        pa.nombres,
        pa.apellidos,
        pa.maximo_grado_academico,
        pa.biografia_comercial,
        pa.foto_perfil_url,
        pa.cv_url,
        pa.activo,
        pa.created_at,
        u.email AS usuario_email,
        u.username AS usuario_username,
        r.nombre AS rol_nombre
      FROM personal_academico pa
      LEFT JOIN usuarios u ON pa.usuario_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE pa.usuario_id = $1
      LIMIT 1;
    `;
    const result = await db.query<DocenteRecord>(query, [usuarioId]);
    return result.rows[0] || null;
  }

  /**
   * Insert a new academic staff member.
   */
  static async createDocente(
    data: CreateDocenteData,
    db: DbClient = pool
  ): Promise<DocenteRecord> {
    const query = `
      INSERT INTO personal_academico (
        usuario_id,
        identificacion,
        nombres,
        apellidos,
        maximo_grado_academico,
        biografia_comercial,
        foto_perfil_url,
        cv_url,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id,
        usuario_id,
        identificacion,
        nombres,
        apellidos,
        maximo_grado_academico,
        biografia_comercial,
        foto_perfil_url,
        cv_url,
        activo,
        created_at;
    `;
    const values = [
      data.usuario_id || null,
      data.identificacion.trim(),
      data.nombres.trim(),
      data.apellidos.trim(),
      data.maximo_grado_academico,
      data.biografia_comercial || null,
      data.foto_perfil_url || null,
      data.cv_url,
      data.activo ?? true,
    ];

    const result = await db.query<DocenteRecord>(query, values);
    return result.rows[0];
  }

  /**
   * Dynamically update an academic staff member.
   */
  static async updateDocente(
    id: string,
    data: UpdateDocenteData,
    db: DbClient = pool
  ): Promise<DocenteRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.usuario_id !== undefined) {
      fields.push(`usuario_id = $${index++}`);
      values.push(data.usuario_id || null);
    }
    if (data.identificacion !== undefined) {
      fields.push(`identificacion = $${index++}`);
      values.push(data.identificacion.trim());
    }
    if (data.nombres !== undefined) {
      fields.push(`nombres = $${index++}`);
      values.push(data.nombres.trim());
    }
    if (data.apellidos !== undefined) {
      fields.push(`apellidos = $${index++}`);
      values.push(data.apellidos.trim());
    }
    if (data.maximo_grado_academico !== undefined) {
      fields.push(`maximo_grado_academico = $${index++}`);
      values.push(data.maximo_grado_academico);
    }
    if (data.biografia_comercial !== undefined) {
      fields.push(`biografia_comercial = $${index++}`);
      values.push(data.biografia_comercial);
    }
    if (data.foto_perfil_url !== undefined) {
      fields.push(`foto_perfil_url = $${index++}`);
      values.push(data.foto_perfil_url);
    }
    if (data.cv_url !== undefined) {
      fields.push(`cv_url = $${index++}`);
      values.push(data.cv_url);
    }
    if (data.activo !== undefined) {
      fields.push(`activo = $${index++}`);
      values.push(data.activo);
    }

    if (fields.length === 0) {
      return this.findDocenteById(id, db);
    }

    values.push(id);
    const query = `
      UPDATE personal_academico
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING 
        id,
        usuario_id,
        identificacion,
        nombres,
        apellidos,
        maximo_grado_academico,
        biografia_comercial,
        foto_perfil_url,
        cv_url,
        activo,
        created_at;
    `;

    const result = await db.query<DocenteRecord>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete an academic staff member by ID.
   */
  static async deleteDocente(id: string, db: DbClient = pool): Promise<boolean> {
    const query = `DELETE FROM personal_academico WHERE id = $1 RETURNING id;`;
    const result = await db.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
