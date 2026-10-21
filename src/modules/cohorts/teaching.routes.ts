import { Router } from 'express';
import { pool } from '../../db/pool';
import { requireAuth } from '../../middlewares/auth.middleware';

export const teachingRouter = Router();
teachingRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT c.id, c.cohorte_id, c.componente_id,
      c.fecha_inicio, c.fecha_fin, c.horario, c.aula, c.actas_notas_cerradas,
      cc.nombre AS componente_nombre, cc.codigo AS componente_codigo,
      ca.codigo_cohorte, ca.estado_cohorte, pr.nombre AS programa_nombre
      FROM programacion_componentes_cohorte c
      JOIN personal_academico p ON p.id = c.docente_titular_id
      JOIN componentes_curriculares cc ON cc.id = c.componente_id
      JOIN cohortes_apertura ca ON ca.id = c.cohorte_id
      JOIN programas_academicos pr ON pr.id = ca.programa_id
      WHERE p.usuario_id = $1 ORDER BY c.fecha_inicio DESC NULLS LAST, c.id`, [req.user!.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});
