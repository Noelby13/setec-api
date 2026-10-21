import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
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

const ACCESS_TOKEN_SECRET =
  process.env.JWT_SECRET || 'super_secret_jwt_access_token_key_snepa_setec_2026';

/**
 * Middleware that verifies the Bearer JWT access token and attaches req.user.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required: Missing or invalid authorization token', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;

    if (!decoded || !decoded.sub || !decoded.rol) {
      return next(new AppError('Invalid token payload', 401));
    }

    req.user = {
      id: decoded.sub as string,
      rol: decoded.rol as string,
      permisos: Array.isArray(decoded.permisos) ? (decoded.permisos as string[]) : [],
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token has expired', 401));
    }
    return next(new AppError('Invalid authentication token', 401));
  }
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
