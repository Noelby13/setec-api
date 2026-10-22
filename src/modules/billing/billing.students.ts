import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { withTransaction } from "../../db/pool";
import { AppError } from "../../middlewares/error.middleware";
import { hasAnyPermission } from "../../middlewares/ownership.middleware";

const positiveInteger = z.string().regex(/^[1-9]\d*$/).transform(Number)
  .refine(Number.isSafeInteger);
const querySchema = z.object({
  search: z.string().trim().max(120).default(""),
  page: positiveInteger.default(1),
  limit: positiveInteger.refine((value) => value <= 50).default(10),
});

/** Discover enrolled people without exposing their full academic profile. */
export async function discoverBillingStudents(req: Request, res: Response, next: NextFunction) {
  try {
    if (!hasAnyPermission(req, ["PAGO_VALIDAR", "INSCRIPCION_VALIDAR"])) {
      throw new AppError("Acceso administrativo requerido", 403);
    }
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw new AppError("Parámetros de búsqueda o paginación inválidos", 400);
    const { search, page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset)) throw new AppError("Paginación inválida", 400);
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    // EXISTS returns each person once even when several enrollment records match.
    const filter = `FROM personas_aspirantes a
      WHERE EXISTS (SELECT 1 FROM inscripciones i WHERE i.aspirante_id=a.id)
        AND (concat_ws(' ',a.nombres,a.apellidos) ILIKE $1
          OR a.numero_identificacion ILIKE $1
          OR EXISTS (SELECT 1 FROM inscripciones i
            WHERE i.aspirante_id=a.id AND i.codigo_expediente ILIKE $1))`;
    const result = await withTransaction(async (db) => {
      await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const total = Number((await db.query(`SELECT count(*)::int AS total ${filter}`, [pattern])).rows[0].total);
      const rows = (await db.query(
        `SELECT a.id,a.nombres,a.apellidos,a.tipo_identificacion,
          RIGHT(a.numero_identificacion,4) AS identificacion_terminacion
          ${filter} ORDER BY a.apellidos,a.nombres,a.id LIMIT $2 OFFSET $3`,
        [pattern, limit, offset],
      )).rows;
      const data = rows.map(({ id, nombres, apellidos, tipo_identificacion, identificacion_terminacion }) => ({
        id, nombres, apellidos, tipo_identificacion, identificacion_terminacion,
      }));
      return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
