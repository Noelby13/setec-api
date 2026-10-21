import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { AuthDao } from '../modules/auth/auth.dao';
import { signingSecret } from '../modules/auth/auth.config';
import { AppError } from './error.middleware';

export interface AuthUserPayload {
  id: string;
  rol: string;
  permisos: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Middleware that verifies the Bearer JWT access token and attaches req.user.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required: Missing or invalid authorization token', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = signingSecret('access');
    let decoded: JwtPayload;
    try { decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload; }
    catch (error) {
      throw new AppError(error instanceof jwt.TokenExpiredError ? 'Token has expired' : 'Invalid authentication token', 401);
    }
    // Session binding is required. Access tokens issued before this release require a new login.
    if (typeof decoded?.sub !== 'string' || typeof decoded.sid !== 'string') {
      throw new AppError('Invalid token payload; please sign in again', 401);
    }
    const user = await AuthDao.findUserById(decoded.sub);
    if (!user?.activo) throw new AppError('Associated user account is not active', 401);
    if (!await AuthDao.findActiveSessionById(decoded.sid, user.id)) {
      throw new AppError('Session is invalid, expired, or has been revoked', 401);
    }
    req.user = { id: user.id, rol: user.rol_nombre, permisos: await AuthDao.getPermissionsByRoleId(user.rol_id) };
    next();
  } catch (error) { next(error); }
}

/**
 * Middleware that verifies if the authenticated user has a specific permission
 * or possesses the SUPER_ADMIN role.
 */
export function requirePermission(codigoPermiso: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required to verify permissions', 401));
    }

    // SUPER_ADMIN has master override on all permissions
    if (req.user.rol === 'SUPER_ADMIN') {
      return next();
    }

    if (req.user.permisos && req.user.permisos.includes(codigoPermiso)) {
      return next();
    }

    return next(
      new AppError(
        `Forbidden: Insufficient privileges. Required permission: '${codigoPermiso}'`,
        403
      )
    );
  };
}
