import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { AppError } from './error.middleware';

const ownershipQueries = {
  applicant: 'SELECT usuario_id FROM personas_aspirantes WHERE id = $1',
  degree: 'SELECT a.usuario_id FROM titulos_academicos_aspirante d JOIN personas_aspirantes a ON a.id = d.aspirante_id WHERE d.id = $1',
  enrollment: 'SELECT a.usuario_id FROM inscripciones i JOIN personas_aspirantes a ON a.id = i.aspirante_id WHERE i.id = $1',
  dossier: 'SELECT a.usuario_id FROM expediente_graduacion_certificacion e JOIN inscripciones i ON i.id = e.inscripcion_id JOIN personas_aspirantes a ON a.id = i.aspirante_id WHERE e.id = $1',
  publication: 'SELECT a.usuario_id FROM publicaciones_cientificas_estudiante p JOIN expediente_graduacion_certificacion e ON e.id = p.expediente_graduacion_id JOIN inscripciones i ON i.id = e.inscripcion_id JOIN personas_aspirantes a ON a.id = i.aspirante_id WHERE p.id = $1',
  grade: 'SELECT a.usuario_id, p.usuario_id AS docente_usuario_id FROM matricula_componentes_snepa m JOIN inscripciones i ON i.id = m.inscripcion_id JOIN personas_aspirantes a ON a.id = i.aspirante_id LEFT JOIN programacion_componentes_cohorte c ON c.id = m.programacion_componente_id LEFT JOIN personal_academico p ON p.id = c.docente_titular_id WHERE m.id = $1',
} as const;

export function hasAnyPermission(req: Request, permissions: string[]): boolean {
  return Boolean(req.user && (req.user.rol === 'SUPER_ADMIN' || permissions.some(p => req.user!.permisos.includes(p))));
}

/** Resource-specific permissions never grant access to unrelated academic records. */
export function requireRecordAccess(resource: keyof typeof ownershipQueries, parameter: string, permissions: string[] = []) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const id = req.params[parameter];
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new AppError('Invalid resource identifier', 400);
      }
      const effective = req.user.rol === 'DOCENTE' ? permissions.filter(p => !['NOTA_IMPORTAR', 'NOTA_MODIFICAR'].includes(p)) : permissions;
      if (!hasAnyPermission(req, effective)) {
        const result = await pool.query<{ usuario_id: string | null; docente_usuario_id?: string | null }>(ownershipQueries[resource], [id]);
        if (!result.rows[0]) throw new AppError('Resource not found', 404);
        const ownTeaching = resource === 'grade' && req.user.rol === 'DOCENTE' && result.rows[0].docente_usuario_id === req.user.id;
        if (result.rows[0].usuario_id !== req.user.id && !ownTeaching) throw new AppError('Access denied to this record', 403);
      }
      next();
    } catch (error) { next(error); }
  };
}

/** Bind self-service applicant creation to the authenticated account. */
export function requireSelfAssignment(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new AppError('Authentication required', 401));
  if (!hasAnyPermission(req, ['INSCRIPCION_VALIDAR'])) {
    if (req.body.usuario_id && req.body.usuario_id !== req.user.id) {
      return next(new AppError('Cannot create a profile for another account', 403));
    }
    req.body.usuario_id = req.user.id;
  }
  next();
}
