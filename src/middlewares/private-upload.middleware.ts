import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { AppError } from './error.middleware';
import { requireAuth } from './auth.middleware';
import { hasAnyPermission } from './ownership.middleware';
import { getRelativeUploadPath } from './upload.middleware';

const documentOwnersQuery = `
  SELECT a.usuario_id, 'INSCRIPCION_VALIDAR' AS permiso FROM personas_aspirantes a
    WHERE $1 IN (a.cedula_identidad_pdf_url, a.tutor_documento_url)
  UNION ALL SELECT p.usuario_id, 'DOCENTE_GESTIONAR' FROM personal_academico p WHERE p.cv_url = $1
  UNION ALL SELECT a.usuario_id, 'INSCRIPCION_VALIDAR' FROM titulos_academicos_aspirante t
    JOIN personas_aspirantes a ON a.id = t.aspirante_id WHERE $1 IN (t.titulo_pdf_url, t.certificado_rn_url)
  UNION ALL SELECT a.usuario_id, 'TITULO_EMITIR' FROM expediente_graduacion_certificacion e
    JOIN inscripciones i ON i.id = e.inscripcion_id JOIN personas_aspirantes a ON a.id = i.aspirante_id
    WHERE $1 IN (e.certificado_idioma_url, e.acta_defensa_url, e.titulo_intermedio_emitido_url, e.documento_final_url)
  UNION ALL SELECT a.usuario_id, 'TITULO_EMITIR' FROM publicaciones_cientificas_estudiante p
    JOIN expediente_graduacion_certificacion e ON e.id = p.expediente_graduacion_id
    JOIN inscripciones i ON i.id = e.inscripcion_id JOIN personas_aspirantes a ON a.id = i.aspirante_id
    WHERE p.evidencia_pdf_url = $1
  UNION ALL SELECT a.usuario_id, 'PAGO_VALIDAR' FROM pagos_inscripcion p
    JOIN inscripciones i ON i.id = p.inscripcion_id JOIN personas_aspirantes a ON a.id = i.aspirante_id
    WHERE p.comprobante_baucher_url = $1
  UNION ALL SELECT a.usuario_id, 'INSCRIPCION_VALIDAR' FROM inscripciones i
    JOIN personas_aspirantes a ON a.id = i.aspirante_id WHERE i.archivo_ponencia_url = $1
  UNION ALL SELECT a.usuario_id, 'CONVALIDACION_DICTAMINAR' FROM solicitudes_convalidacion_acreditacion c
    JOIN inscripciones i ON i.id = c.inscripcion_destino_id JOIN personas_aspirantes a ON a.id = i.aspirante_id
    WHERE c.certificado_origen_url = $1`;

/** A caller-supplied URL is never proof that a private file belongs to that caller. */
export function requireOwnedFileReferences(fields: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
      if (req.file) files.push(req.file);
      const uploaded = new Set(files.map(getRelativeUploadPath));
      for (const field of fields) {
        const value = req.body?.[field];
        if (typeof value !== 'string' || !value.startsWith('/uploads/')) continue;
        if (uploaded.has(value)) continue;
        const result = await pool.query<{ usuario_id: string | null; permiso: string }>(documentOwnersQuery, [value]);
        if (!result.rows.some(row => row.usuario_id === req.user!.id || hasAnyPermission(req, [row.permiso]))) {
          throw new AppError('Cannot attach a private document belonging to another account', 403);
        }
      }
      next();
    } catch (error) { next(error); }
  };
}

export async function authorizePrivateUpload(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const segments = req.path.split('/').filter(Boolean);
    if (segments.length !== 2 || segments.some(s => s.includes('..') || s.includes('\\'))) {
      throw new AppError('Invalid document path', 400);
    }
    const category = segments[0];
    if (category === 'actas_excel') {
      if (!hasAnyPermission(req, ['NOTA_IMPORTAR', 'NOTA_MODIFICAR'])) throw new AppError('Access denied', 403);
      if (req.user.rol === 'DOCENTE') {
        const result = await pool.query(`SELECT 1 FROM lotes_importacion_notas l
          JOIN programacion_componentes_cohorte c ON c.id = l.programacion_componente_id
          JOIN personal_academico p ON p.id = c.docente_titular_id
          WHERE l.archivo_excel_url = $1 AND p.usuario_id = $2`, [`/uploads/${segments.join('/')}`, req.user.id]);
        if (!result.rows.length) throw new AppError('Access denied', 403);
      }
    } else if (category === 'cohortes') {
      if (!hasAnyPermission(req, ['COHORTE_GESTIONAR'])) throw new AppError('Access denied', 403);
    } else {
      const result = await pool.query<{ usuario_id: string | null; permiso: string }>(documentOwnersQuery, [`/uploads/${segments.join('/')}`]);
      if (!result.rows.some(row => row.usuario_id === req.user!.id || hasAnyPermission(req, [row.permiso]))) {
        throw new AppError('Document not found or access denied', 403);
      }
    }
    next();
  } catch (error) { next(error); }
}

/** Keep promotional assets public; all personal/academic attachments require live authorization. */
export function protectUploads(req: Request, res: Response, next: NextFunction): void {
  if (/^\/(programas|silabos)\/[^/]+$/.test(req.path)) return next();
  requireAuth(req, res, error => {
    if (error) return next(error);
    void authorizePrivateUpload(req, res, next);
  });
}
