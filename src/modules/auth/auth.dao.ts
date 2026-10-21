import { pool, DbClient } from '../../db/pool';

export interface UserWithRole {
  id: string;
  username: string | null;
  email: string;
  password_hash: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  avatar_url: string | null;
  rol_id: string;
  rol_nombre: string;
  activo: boolean;
  email_verificado: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserRecord {
  id: string;
  username: string | null;
  email: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  avatar_url: string | null;
  rol_id: string;
  activo: boolean;
  email_verificado: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  username?: string | null;
  email: string;
  password_hash: string;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
  avatar_url?: string | null;
  rol_id: string;
  activo?: boolean;
  email_verificado?: boolean;
}

export interface SessionRecord {
  id: string;
  usuario_id: string;
  direccion_ip: string | null;
  user_agent: string | null;
  payload: string | null;
  refresh_token_hash: string;
  is_token_revocado: boolean;
  creacion_token: Date;
  expiracion_token: Date;
  ultima_actividad: Date;
}

export interface CreateSessionData {
  usuario_id: string;
  direccion_ip?: string | null;
  user_agent?: string | null;
  payload?: string | null;
  refresh_token_hash: string;
  expiracion_token: Date;
}

export class AuthDao {
  static async findRoleByName(nombre: string, db: DbClient = pool): Promise<{ id: string; nombre: string } | null> {
    const result = await db.query<{ id: string; nombre: string }>('SELECT id, nombre FROM roles WHERE nombre = $1', [nombre]);
    return result.rows[0] || null;
  }

  static async updateProfile(id: string, changes: { email?: string; username?: string; nombres?: string; apellidos?: string; telefono?: string }, db: DbClient = pool): Promise<void> {
    const allowed = ['email', 'username', 'nombres', 'apellidos', 'telefono'] as const;
    const entries = allowed.filter(key => changes[key] !== undefined);
    if (!entries.length) return;
    await db.query(`UPDATE usuarios SET ${entries.map((key, index) => `${key} = $${index + 2}`).join(', ')}, updated_at = NOW()
      ${changes.email !== undefined ? ', email_verificado = FALSE' : ''} WHERE id = $1`, [id, ...entries.map(key => changes[key])]);
  }

  /** Atomically claim a refresh session; concurrent rotations cannot both succeed. */
  static async consumeSession(id: string, db: DbClient = pool): Promise<boolean> {
    const result = await db.query(`UPDATE sesiones SET is_token_revocado = TRUE, ultima_actividad = NOW()
      WHERE id = $1 AND is_token_revocado = FALSE AND expiracion_token > NOW() RETURNING id`, [id]);
    return result.rows.length === 1;
  }

  static async findActiveSessionById(id: string, userId: string, db: DbClient = pool): Promise<SessionRecord | null> {
    const result = await db.query<SessionRecord>(`SELECT * FROM sesiones WHERE id = $1 AND usuario_id = $2
      AND is_token_revocado = FALSE AND expiracion_token > NOW()`, [id, userId]);
    return result.rows[0] || null;
  }

  /**
   * Find a user by email or username, joining with roles.
   */
  static async findUserByEmailOrUsername(
    identifier: string,
    db: DbClient = pool
  ): Promise<UserWithRole | null> {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.password_hash,
        u.nombres,
        u.apellidos,
        u.telefono,
        u.avatar_url,
        u.rol_id,
        u.activo,
        u.email_verificado,
        u.created_at,
        u.updated_at,
        r.nombre AS rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE (LOWER(u.email) = LOWER($1) OR u.username = $1)
      LIMIT 1;
    `;
    const result = await db.query<UserWithRole>(query, [identifier]);
    return result.rows[0] || null;
  }

  /**
   * Find a user by ID, joining with roles.
   */
  static async findUserById(id: string, db: DbClient = pool): Promise<UserWithRole | null> {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.password_hash,
        u.nombres,
        u.apellidos,
        u.telefono,
        u.avatar_url,
        u.rol_id,
        u.activo,
        u.email_verificado,
        u.created_at,
        u.updated_at,
        r.nombre AS rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.id = $1
      LIMIT 1;
    `;
    const result = await db.query<UserWithRole>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Retrieve all permission codes assigned to a given role ID.
   */
  static async getPermissionsByRoleId(rolId: string, db: DbClient = pool): Promise<string[]> {
    const query = `
      SELECT p.codigo 
      FROM permisos p 
      JOIN roles_permisos rp ON p.id = rp.permiso_id 
      WHERE rp.rol_id = $1
    `;
    const result = await db.query<{ codigo: string }>(query, [rolId]);
    return result.rows.map((row) => row.codigo);
  }

  /**
   * Insert a new user record.
   */
  static async createUser(data: CreateUserData, db: DbClient = pool): Promise<UserRecord> {
    const query = `
      INSERT INTO usuarios (
        username,
        email,
        password_hash,
        nombres,
        apellidos,
        telefono,
        avatar_url,
        rol_id,
        activo,
        email_verificado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id,
        username,
        email,
        nombres,
        apellidos,
        telefono,
        avatar_url,
        rol_id,
        activo,
        email_verificado,
        created_at,
        updated_at;
    `;
    const values = [
      data.username || null,
      data.email.toLowerCase(),
      data.password_hash,
      data.nombres,
      data.apellidos,
      data.telefono || null,
      data.avatar_url || null,
      data.rol_id,
      data.activo ?? true,
      data.email_verificado ?? false,
    ];
    const result = await db.query<UserRecord>(query, values);
    return result.rows[0];
  }

  /**
   * Create a new session with hashed refresh token.
   */
  static async createSession(
    data: CreateSessionData,
    db: DbClient = pool
  ): Promise<SessionRecord> {
    const query = `
      INSERT INTO sesiones (
        usuario_id,
        direccion_ip,
        user_agent,
        payload,
        refresh_token_hash,
        is_token_revocado,
        creacion_token,
        expiracion_token,
        ultima_actividad
      ) VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), $6, NOW())
      RETURNING 
        id,
        usuario_id,
        direccion_ip,
        user_agent,
        payload,
        refresh_token_hash,
        is_token_revocado,
        creacion_token,
        expiracion_token,
        ultima_actividad;
    `;
    const values = [
      data.usuario_id,
      data.direccion_ip || null,
      data.user_agent || null,
      data.payload || null,
      data.refresh_token_hash,
      data.expiracion_token,
    ];
    const result = await db.query<SessionRecord>(query, values);
    return result.rows[0];
  }

  /**
   * Find an active, non-revoked session by refresh token hash.
   */
  static async findActiveSessionByTokenHash(
    refreshTokenHash: string,
    db: DbClient = pool
  ): Promise<SessionRecord | null> {
    const query = `
      SELECT 
        id,
        usuario_id,
        direccion_ip,
        user_agent,
        payload,
        refresh_token_hash,
        is_token_revocado,
        creacion_token,
        expiracion_token,
        ultima_actividad
      FROM sesiones
      WHERE refresh_token_hash = $1
        AND is_token_revocado = FALSE
        AND expiracion_token > NOW()
      ORDER BY creacion_token DESC
      LIMIT 1;
    `;
    const result = await db.query<SessionRecord>(query, [refreshTokenHash]);
    return result.rows[0] || null;
  }

  /**
   * Revoke a specific session by ID.
   */
  static async revokeSession(id: string, db: DbClient = pool): Promise<void> {
    const query = `
      UPDATE sesiones
      SET is_token_revocado = TRUE, ultima_actividad = NOW()
      WHERE id = $1;
    `;
    await db.query(query, [id]);
  }

  /**
   * Revoke session by refresh token hash.
   */
  static async revokeSessionByHash(
    refreshTokenHash: string,
    db: DbClient = pool
  ): Promise<void> {
    const query = `
      UPDATE sesiones
      SET is_token_revocado = TRUE, ultima_actividad = NOW()
      WHERE refresh_token_hash = $1;
    `;
    await db.query(query, [refreshTokenHash]);
  }

  /**
   * Revoke all active sessions for a given user.
   */
  static async revokeAllUserSessions(usuarioId: string, db: DbClient = pool): Promise<void> {
    const query = `
      UPDATE sesiones
      SET is_token_revocado = TRUE, ultima_actividad = NOW()
      WHERE usuario_id = $1 AND is_token_revocado = FALSE;
    `;
    await db.query(query, [usuarioId]);
  }

  /**
   * Update last activity timestamp for a session.
   */
  static async updateSessionActivity(id: string, db: DbClient = pool): Promise<void> {
    const query = `
      UPDATE sesiones
      SET ultima_actividad = NOW()
      WHERE id = $1;
    `;
    await db.query(query, [id]);
  }
}
