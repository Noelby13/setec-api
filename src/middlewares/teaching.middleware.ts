import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { AppError } from './error.middleware';

/** Import permission does not authorize a teacher to inspect another teacher's class. */
export async function requireTeachingAssignment(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (req.user.rol === 'DOCENTE') {
      const id = req.params.programacionComponenteId;
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError('Invalid class identifier', 400);
      const result = await pool.query<{ allowed: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM programacion_componentes_cohorte c
        JOIN personal_academico p ON p.id = c.docente_titular_id
        WHERE c.id = $1 AND p.usuario_id = $2) AS allowed`, [id, req.user.id]);
      if (!result.rows[0]?.allowed) throw new AppError('Access denied to another teacher\'s class', 403);
    }
    next();
  } catch (error) { next(error); }
}
