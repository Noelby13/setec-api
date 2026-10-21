import { pool } from '../../db/pool';
import { UserWithRole } from '../auth/auth.dao';
import { SelfProfileInput } from '../auth/auth.schema';

export interface AssignableRole { id: string; nombre: string; descripcion: string | null; permisos: string[] }
export type UserChanges = SelfProfileInput & { rolId?: string; activo?: boolean };

export class UsersDao {
  static async roles(): Promise<AssignableRole[]> {
    const result = await pool.query<AssignableRole>(`SELECT r.id, r.nombre, r.descripcion,
      COALESCE(array_agg(p.codigo ORDER BY p.codigo) FILTER (WHERE p.codigo IS NOT NULL), ARRAY[]::varchar[]) AS permisos
      FROM roles r LEFT JOIN roles_permisos rp ON rp.rol_id = r.id
      LEFT JOIN permisos p ON p.id = rp.permiso_id GROUP BY r.id ORDER BY r.nombre`);
    return result.rows;
  }

  static async list(search: string, page: number, limit: number): Promise<{ items: UserWithRole[]; total: number }> {
    // SELECT explicit public fields; password hashes never enter the list response.
    const predicate = `($1 = '' OR u.email ILIKE $2 OR u.username ILIKE $2 OR u.nombres ILIKE $2 OR u.apellidos ILIKE $2)`;
    const args = [search, `%${search.replace(/[\\%_]/g, '\\$&')}%`];
    const result = await pool.query<UserWithRole>(`SELECT u.id, u.username, u.email, u.nombres, u.apellidos,
      u.telefono, u.avatar_url, u.rol_id, r.nombre AS rol_nombre, u.activo, u.email_verificado, u.created_at, u.updated_at
      FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE ${predicate}
      ORDER BY u.created_at DESC, u.id LIMIT $3 OFFSET $4`, [...args, limit, (page - 1) * limit]);
    const count = await pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM usuarios u WHERE ${predicate}`, args);
    return { items: result.rows, total: Number(count.rows[0].total) };
  }

  static async update(id: string, expectedRoleId: string, changes: UserChanges): Promise<boolean> {
    const values: unknown[] = [id, expectedRoleId];
    const columns: Record<string, string> = { email: 'email', username: 'username', nombres: 'nombres', apellidos: 'apellidos', telefono: 'telefono', rolId: 'rol_id', activo: 'activo' };
    const assignments = Object.entries(columns).filter(([key]) => (changes as Record<string, unknown>)[key] !== undefined)
      .map(([key, column]) => { values.push((changes as Record<string, unknown>)[key]); return `${column} = $${values.length}`; });
    if (changes.email !== undefined) assignments.push('email_verificado = FALSE');
    const result = await pool.query(`UPDATE usuarios SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $1 AND rol_id = $2 RETURNING id`, values);
    return result.rows.length === 1;
  }
}
