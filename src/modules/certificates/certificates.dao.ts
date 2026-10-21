import { pool, DbClient } from '../../db/pool';
import { AppError } from '../../middlewares/error.middleware';

export interface CertificateRecord {
  id: string; expediente_id: string; token_publico: string; titular_usuario_id: string | null;
  titular_nombre: string; programa_nombre: string; cohorte_codigo: string; tipo_documento: string;
  fecha_emision: string | Date; documento_url: string; documento_sha256: string;
  estado: 'VIGENTE' | 'REVOCADO'; fecha_revocacion: Date | null;
  motivo_revocacion: string | null; revocado_por_usuario_id: string | null;
}
export interface CertificateSource {
  id: string; inscripcion_id: string; codigo_registro_titulo_emitido: string | null;
  fecha_emision: string | Date | null; documento_final_url: string | null; tipo_documento_final: string;
  aspirante_usuario_id: string | null; aspirante_nombres: string; aspirante_apellidos: string;
  programa_nombre: string; codigo_cohorte: string;
}
export interface CertificateEvent { id: string; accion: string; fecha: Date; actor_id: string; motivo: string | null }
export type NewCertificate = Pick<CertificateRecord, 'expediente_id' | 'token_publico' | 'titular_usuario_id' | 'titular_nombre' | 'programa_nombre' | 'cohorte_codigo' | 'tipo_documento' | 'fecha_emision' | 'documento_url' | 'documento_sha256'> & { registrado_por_usuario_id: string };

export class CertificatesDao {
  static async available(db: DbClient = pool): Promise<boolean> {
    const result = await db.query<{ available: boolean }>(`SELECT
      to_regclass('public.certificados_registro') IS NOT NULL AND
      to_regclass('public.certificados_eventos') IS NOT NULL AS available`);
    return result.rows[0]?.available === true;
  }

  static async requireAvailable(db: DbClient = pool): Promise<void> {
    if (!await this.available(db)) throw new AppError('Certificate registry is unavailable; apply the certificate registry migration', 503);
  }

  static async byId(id: string, db: DbClient = pool): Promise<CertificateRecord | null> {
    const result = await db.query<CertificateRecord>('SELECT * FROM certificados_registro WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
  static async byToken(token: string, db: DbClient = pool): Promise<CertificateRecord | null> {
    const result = await db.query<CertificateRecord>('SELECT * FROM certificados_registro WHERE token_publico = $1', [token]);
    return result.rows[0] || null;
  }
  static async byExpediente(id: string, db: DbClient = pool): Promise<CertificateRecord | null> {
    const result = await db.query<CertificateRecord>('SELECT * FROM certificados_registro WHERE expediente_id = $1', [id]);
    return result.rows[0] || null;
  }
  static async byDocumentPath(storedUrl: string, db: DbClient = pool): Promise<CertificateRecord[]> {
    const result = await db.query<CertificateRecord>('SELECT * FROM certificados_registro WHERE documento_url = $1', [storedUrl]);
    return result.rows;
  }
  static async sourceForRegistration(id: string, db: DbClient): Promise<CertificateSource | null> {
    const result = await db.query<CertificateSource>(`SELECT e.*, a.usuario_id AS aspirante_usuario_id,
      a.nombres AS aspirante_nombres, a.apellidos AS aspirante_apellidos,
      p.nombre AS programa_nombre, c.codigo_cohorte
      FROM expediente_graduacion_certificacion e JOIN inscripciones i ON i.id = e.inscripcion_id
      JOIN personas_aspirantes a ON a.id = i.aspirante_id JOIN cohortes_apertura c ON c.id = i.cohorte_id
      JOIN programas_academicos p ON p.id = c.programa_id WHERE e.id = $1 FOR UPDATE OF e`, [id]);
    return result.rows[0] || null;
  }
  static async create(data: NewCertificate, db: DbClient): Promise<CertificateRecord> {
    const result = await db.query<CertificateRecord>(`INSERT INTO certificados_registro
      (expediente_id, token_publico, titular_usuario_id, titular_nombre, programa_nombre, cohorte_codigo,
       tipo_documento, fecha_emision, documento_url, documento_sha256, registrado_por_usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [data.expediente_id, data.token_publico,
      data.titular_usuario_id, data.titular_nombre, data.programa_nombre, data.cohorte_codigo,
      data.tipo_documento, data.fecha_emision, data.documento_url, data.documento_sha256, data.registrado_por_usuario_id]);
    return result.rows[0];
  }
  static async addEvent(id: string, action: 'EMITIDO' | 'REGISTRADO' | 'REVOCADO', actor: string, reason: string | null, db: DbClient): Promise<void> {
    await db.query('INSERT INTO certificados_eventos (certificado_id, accion, actor_id, motivo) VALUES ($1,$2,$3,$4)', [id, action, actor, reason]);
  }
  static async revoke(id: string, actor: string, reason: string, db: DbClient): Promise<CertificateRecord | null> {
    const result = await db.query<CertificateRecord>(`UPDATE certificados_registro SET estado = 'REVOCADO',
      fecha_revocacion = NOW(), motivo_revocacion = $2, revocado_por_usuario_id = $3
      WHERE id = $1 AND estado = 'VIGENTE' RETURNING *`, [id, reason, actor]);
    return result.rows[0] || null;
  }
  static async events(id: string): Promise<CertificateEvent[]> {
    const result = await pool.query<CertificateEvent>('SELECT id, accion, fecha, actor_id, motivo FROM certificados_eventos WHERE certificado_id = $1 ORDER BY fecha, id', [id]);
    return result.rows;
  }
  static async list(filters: { ownerId?: string; search?: string; estado?: string; page: number; limit: number }): Promise<{ records: CertificateRecord[]; total: number }> {
    const predicate = `($1::uuid IS NULL OR titular_usuario_id = $1) AND ($2::text IS NULL OR estado = $2)
      AND ($3 = '' OR titular_nombre ILIKE $4 OR programa_nombre ILIKE $4 OR cohorte_codigo ILIKE $4)`;
    const search = filters.search || '';
    const values = [filters.ownerId || null, filters.estado || null, search, `%${search.replace(/[\\%_]/g, '\\$&')}%`];
    const result = await pool.query<CertificateRecord>(`SELECT * FROM certificados_registro WHERE ${predicate}
      ORDER BY fecha_emision DESC, id LIMIT $5 OFFSET $6`, [...values, filters.limit, (filters.page - 1) * filters.limit]);
    const count = await pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM certificados_registro WHERE ${predicate}`, values);
    return { records: result.rows, total: Number(count.rows[0].total) };
  }
}
