import { z } from "zod";
import { receiptPdf } from "./billing.receipt";
import { pool, withTransaction } from "../../db/pool";
import { PaymentService } from "./billing.payments";
import { Router, Request, Response, NextFunction } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middlewares/auth.middleware";
import {
  requireRecordAccess,
  hasAnyPermission,
} from "../../middlewares/ownership.middleware";
import { validateSchema } from "../../middlewares/validate.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { BillingService } from "./billing.service";
import {
  acceptPlanSchema,
  activateSchema,
  assignPlanSchema,
  billingIdSchema,
  createPlanSchema,
  collectPaymentSchema,
  cancellationSchema,
  receiptIdSchema,
} from "./billing.schema";

export const billingRouter = Router();
billingRouter.use(requireAuth);
function handle(operation: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await operation(req) });
    } catch (error) {
      next(error);
    }
  };
}
billingRouter.get(
  "/cohorts/:id/plans",
  (req, _res, next) => {
    if (
      !hasAnyPermission(req, [
        "COHORTE_GESTIONAR",
        "INSCRIPCION_VALIDAR",
        "PAGO_VALIDAR",
      ])
    )
      return next(new AppError("Acceso administrativo requerido", 403));
    next();
  },
  validateSchema({ params: billingIdSchema }),
  handle((req) => BillingService.getPlans(req.params.id as string)),
);
billingRouter.post(
  "/cohorts/:id/plans",
  requirePermission("COHORTE_GESTIONAR"),
  validateSchema({ params: billingIdSchema, body: createPlanSchema }),
  handle((req) =>
    BillingService.createPlan(req.params.id as string, req.body, req.user!.id),
  ),
);
billingRouter.get(
  "/enrollments/:id/account",
  validateSchema({ params: billingIdSchema }),
  requireRecordAccess("enrollment", "id", [
    "INSCRIPCION_VALIDAR",
    "PAGO_VALIDAR",
  ]),
  handle((req) => BillingService.getAccount(req.params.id as string)),
);
billingRouter.post(
  "/enrollments/:id/plan",
  requirePermission("INSCRIPCION_VALIDAR"),
  validateSchema({ params: billingIdSchema, body: assignPlanSchema }),
  handle((req) =>
    BillingService.assignPlan(
      req.params.id as string,
      req.body.plan_id,
      req.user!.id,
    ),
  ),
);
billingRouter.post(
  "/enrollments/:id/accept",
  requirePermission("INSCRIPCION_VALIDAR"),
  validateSchema({ params: billingIdSchema, body: acceptPlanSchema }),
  handle((req) =>
    BillingService.acceptAgreement(
      req.params.id as string,
      req.body.plan_id,
      req.user!.id,
      req.body.motivo,
    ),
  ),
);
billingRouter.post(
  "/enrollments/:id/activate",
  requirePermission("INSCRIPCION_VALIDAR"),
  validateSchema({ params: billingIdSchema, body: activateSchema }),
  handle((req) =>
    BillingService.activate(
      req.params.id as string,
      req.user!.id,
      req.body.motivo,
    ),
  ),
);

billingRouter.post(
  "/enrollments/:id/payments",
  requirePermission("PAGO_VALIDAR"),
  validateSchema({ params: billingIdSchema, body: collectPaymentSchema }),
  handle((req) =>
    PaymentService.collect(req.params.id as string, req.body, req.user!.id),
  ),
);
billingRouter.post(
  "/enrollments/:id/payments/:paymentId/cancel",
  requirePermission("PAGO_ANULAR"),
  validateSchema({
    params: z.object({ id: z.string().uuid(), paymentId: z.string().uuid() }),
    body: cancellationSchema,
  }),
  handle((req) =>
    PaymentService.cancelPayment(
      req.params.id as string,
      req.params.paymentId as string,
      req.user!.id,
      req.body.motivo,
    ),
  ),
);
billingRouter.post(
  "/enrollments/:id/obligations/:obligationId/cancel",
  requirePermission("OBLIGACION_ANULAR"),
  validateSchema({
    params: z.object({
      id: z.string().uuid(),
      obligationId: z.string().uuid(),
    }),
    body: cancellationSchema,
  }),
  handle((req) =>
    PaymentService.cancelObligation(
      req.params.id as string,
      req.params.obligationId as string,
      req.user!.id,
      req.body.motivo,
    ),
  ),
);

billingRouter.get(
  "/enrollments/:id/receipts/:receiptId.pdf",
  validateSchema({ params: receiptIdSchema }),
  requireRecordAccess("enrollment", "id", [
    "PAGO_VALIDAR",
    "INSCRIPCION_VALIDAR",
  ]),
  async (req, res, next) => {
    try {
      const receipt = (
        await pool.query(
          "SELECT * FROM comprobantes_internos WHERE id=$1 AND inscripcion_id=$2",
          [req.params.receiptId, req.params.id],
        )
      ).rows[0];
      if (!receipt)
        throw new AppError(
          "Comprobante no encontrado en esta inscripción",
          404,
        );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="comprobante-CI-${String(receipt.numero).padStart(8, "0")}.pdf"`,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.send(receiptPdf(receipt));
    } catch (error) {
      next(error);
    }
  },
);
billingRouter.get(
  "/enrollments/:id/audit",
  requirePermission("PAGO_VALIDAR"),
  validateSchema({ params: billingIdSchema }),
  handle(
    async (req) =>
      (
        await pool.query(
          "SELECT * FROM auditoria_economica WHERE inscripcion_id=$1 ORDER BY creado_en DESC,id LIMIT 200",
          [req.params.id],
        )
      ).rows,
  ),
);
billingRouter.get(
  "/dashboard",
  (req, _res, next) => {
    if (
      !hasAnyPermission(req, [
        "PAGO_VALIDAR",
        "INSCRIPCION_VALIDAR",
        "COHORTE_GESTIONAR",
      ])
    )
      return next(new AppError("Acceso administrativo requerido", 403));
    next();
  },
  handle(async () =>
    withTransaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const totals = (
        await db.query(
          `WITH balances AS (SELECT o.*,o.importe-COALESCE((SELECT SUM(a.importe) FROM aplicaciones_pago a JOIN pagos_inscripcion p ON p.id=a.pago_id WHERE a.obligacion_id=o.id AND p.estado='APROBADO'),0) AS saldo FROM obligaciones_pago o WHERE o.anulada_en IS NULL) SELECT COUNT(*) FILTER(WHERE saldo>0)::int AS obligaciones_pendientes,COALESCE(SUM(saldo),0)::text AS saldo_pendiente,COUNT(*) FILTER(WHERE saldo>0 AND fecha_vencimiento<(now() AT TIME ZONE 'America/Managua')::date)::int AS obligaciones_vencidas,COALESCE(SUM(saldo) FILTER(WHERE fecha_vencimiento<(now() AT TIME ZONE 'America/Managua')::date),0)::text AS saldo_vencido FROM balances`,
        )
      ).rows[0];
      const operations = (
        await db.query(
          `SELECT COUNT(*) FILTER(WHERE estado='APROBADO' AND (fecha_validacion_caja AT TIME ZONE 'America/Managua')::date=(now() AT TIME ZONE 'America/Managua')::date)::int AS cobros_hoy,COALESCE(SUM(total_pagado) FILTER(WHERE estado='APROBADO' AND (fecha_validacion_caja AT TIME ZONE 'America/Managua')::date=(now() AT TIME ZONE 'America/Managua')::date),0)::text AS importe_hoy,COUNT(*) FILTER(WHERE estado='PENDIENTE_REVISION')::int AS pagos_en_revision FROM pagos_inscripcion`,
        )
      ).rows[0];
      const recent = (
        await db.query(
          `SELECT p.id,p.inscripcion_id,p.total_pagado::text,p.estado,p.fecha_validacion_caja,a.nombres,a.apellidos,c.codigo_cohorte,g.nombre AS programa_nombre FROM pagos_inscripcion p JOIN inscripciones i ON i.id=p.inscripcion_id JOIN personas_aspirantes a ON a.id=i.aspirante_id JOIN cohortes_apertura c ON c.id=i.cohorte_id JOIN programas_academicos g ON g.id=c.programa_id ORDER BY COALESCE(p.fecha_validacion_caja,p.fecha_pago_reportada) DESC,p.id LIMIT 10`,
        )
      ).rows;
      const receipts = (
        await db.query(
          `SELECT id,numero::text,inscripcion_id,pago_id,emitido_en,anulado_en,datos->>'total' AS total FROM comprobantes_internos ORDER BY numero DESC LIMIT 10`,
        )
      ).rows;
      const missing = (
        await db.query(
          `SELECT count(*)::int AS total FROM inscripciones i JOIN cohortes_apertura c ON c.id=i.cohorte_id WHERE i.fecha_aprobacion_documental IS NOT NULL AND c.cobro_habilitado AND i.estado IN ('PENDIENTE_PAGO','PAGO_EN_REVISION','MATRICULADO_ACTIVO') AND NOT EXISTS(SELECT 1 FROM acuerdos_pago_inscripcion a WHERE a.inscripcion_id=i.id)`,
        )
      ).rows[0].total;
      return {
        ...totals,
        ...operations,
        cuentas_sin_acuerdo: missing,
        cobros_recientes: recent,
        comprobantes: receipts,
      };
    }),
  ),
);
