import bcrypt from 'bcrypt';
import { AuthUserPayload } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { AuthDao, UserWithRole } from '../auth/auth.dao';
import { UsersDao, AssignableRole, UserChanges } from './users.dao';
import { ManagedUserInput } from './users.schema';

export function publicUser(user: UserWithRole) {
  return {
    id: user.id, username: user.username, email: user.email, nombres: user.nombres,
    apellidos: user.apellidos, telefono: user.telefono, avatar_url: user.avatar_url,
    rol_id: user.rol_id, rol: user.rol_nombre, activo: user.activo,
    email_verificado: user.email_verificado, created_at: user.created_at,
  };
}

export class UsersService {
  private static permits(actor: AuthUserPayload, role: AssignableRole): boolean {
    return actor.rol === 'SUPER_ADMIN' || (role.nombre !== 'SUPER_ADMIN' && role.permisos.every(permission => actor.permisos.includes(permission)));
  }

  static async roles(actor: AuthUserPayload): Promise<AssignableRole[]> {
    return (await UsersDao.roles()).filter(role => this.permits(actor, role));
  }

  private static async permittedRole(actor: AuthUserPayload, roleId: string): Promise<AssignableRole> {
    const role = (await UsersDao.roles()).find(item => item.id === roleId);
    if (!role) throw new AppError('Role not found', 404);
    if (!this.permits(actor, role)) throw new AppError('You cannot assign or manage this role', 403);
    return role;
  }

  static async list(search: string, page: number, limit: number, role?: string) {
    const result = await UsersDao.list(search, page, limit, role);
    return { ...result, items: result.items.map(publicUser), page, limit };
  }

  static async create(actor: AuthUserPayload, input: ManagedUserInput) {
    const role = await this.permittedRole(actor, input.rolId);
    try {
      const created = await AuthDao.createUser({
        email: input.email, username: input.username, nombres: input.nombres,
        apellidos: input.apellidos, telefono: input.telefono,
        password_hash: await bcrypt.hash(input.password, 12), rol_id: role.id,
        activo: input.activo ?? true, email_verificado: false,
      });
      return publicUser({ ...created, rol_nombre: role.nombre } as UserWithRole);
    } catch (error) { return this.rethrowWrite(error); }
  }

  static async update(actor: AuthUserPayload, id: string, changes: UserChanges) {
    const target = await AuthDao.findUserById(id);
    if (!target) throw new AppError('User not found', 404);
    if (actor.id === id && (changes.rolId !== undefined || changes.activo !== undefined)) {
      throw new AppError('You cannot change your own role or account status', 403);
    }
    // Protect all super administrators through this API, including the last active administrator.
    // Administrative succession requires an explicit operational process outside this endpoint.
    if (target.rol_nombre === 'SUPER_ADMIN') throw new AppError('Super administrator accounts are protected; use the personal profile for your own details', 403);
    await this.permittedRole(actor, target.rol_id);
    if (changes.rolId !== undefined) await this.permittedRole(actor, changes.rolId);
    try {
      // Revoke before changing security fields; a revocation failure prevents the account write.
      if (changes.rolId !== undefined || changes.activo !== undefined) await AuthDao.revokeAllUserSessions(id);
      if (!await UsersDao.update(id, target.rol_id, changes)) throw new AppError('User role changed concurrently; reload and retry', 409);
      const updated = await AuthDao.findUserById(id);
      if (!updated) throw new AppError('User not found', 404);
      return publicUser(updated);
    } catch (error) { return this.rethrowWrite(error); }
  }

  private static rethrowWrite(error: unknown): never {
    if ((error as { code?: string }).code === '23505') throw new AppError('Email or username is already registered', 409);
    throw error;
  }
}
