import { createHash } from "node:crypto";
import { DbClient, withTransaction } from "../../db/pool";
import { AppError } from "../../middlewares/error.middleware";
import {
  EnrollmentDao,
  InscripcionRecord,
  CohorteWithProgramRecord,
  PagoInscripcionRecord,
} from "../enrollments/enrollment.dao";
import type { CreatePaymentInput } from "../enrollments/enrollment.schema";
import { BillingService } from "./billing.service";
import { cents, decimal, obligationState } from "./billing.money";
import { CollectPaymentInput, collectPaymentSchema } from "./billing.schema";

type Allocation = { obligacion_id: string; importe: string };
export class PaymentService {
  static async obligations(
    db: DbClient,
    id: string,
    excludePayment: string | null = null,
  ) {
    const result = await db.query(
      `SELECT o.*,to_char(o.fecha_vencimiento,'YYYY-MM-DD') AS fecha_vencimiento,to_char(now() AT TIME ZONE 'America/Managua','YYYY-MM-DD') AS hoy,COALESCE(s.pagado,0)::text AS pagado,COALESCE(s.en_revision,0)::text AS en_revision FROM obligaciones_pago o LEFT JOIN LATERAL (SELECT SUM(a.importe) FILTER(WHERE p.estado='APROBADO') AS pagado,SUM(a.importe) FILTER(WHERE p.estado='PENDIENTE_REVISION') AS en_revision FROM aplicaciones_pago a JOIN pagos_inscripcion p ON p.id=a.pago_id WHERE a.obligacion_id=o.id AND ($2::uuid IS NULL OR p.id<>$2)) s ON true WHERE o.inscripcion_id=$1 ORDER BY o.numero`,
      [id, excludePayment],
    );
    return result.rows.map((row) => ({
      ...row,
      pagado: decimal(cents(row.pagado)),
      en_revision: decimal(cents(row.en_revision)),
      saldo: row.anulada_en
        ? "0.00"
        : decimal(cents(row.importe) - cents(row.pagado)),
      disponible: row.anulada_en
        ? "0.00"
        : decimal(
            cents(row.importe) - cents(row.pagado) - cents(row.en_revision),
          ),
      estado: obligationState(
        row.importe,
        row.pagado,
        row.fecha_vencimiento,
        Boolean(row.anulada_en),
        row.hoy,
      ),
    }));
  }

  static selectApplications(
    rows: Awaited<ReturnType<typeof PaymentService.obligations>>,
    total: string,
    requested?: Allocation[],
  ): Allocation[] {
    let remaining = cents(total);
    if (remaining <= 0n)
      throw new AppError("El pago debe ser mayor que cero", 400);
    const selected: Allocation[] = [];
    if (requested) {
      if (
        new Set(requested.map((item) => item.obligacion_id)).size !==
        requested.length
      )
        throw new AppError("No repita una obligación en el mismo pago", 400);
      if (
        requested.reduce((sum, item) => sum + cents(item.importe), 0n) !==
        remaining
      )
        throw new AppError(
          "Los abonos deben coincidir exactamente con el total pagado",
          400,
        );
      for (const item of requested) {
        const obligation = rows.find((row) => row.id === item.obligacion_id);
        if (!obligation || obligation.anulada_en)
          throw new AppError(
            "La obligación no corresponde a esta inscripción o está anulada",
            400,
          );
        if (
          cents(item.importe) <= 0n ||
          cents(item.importe) > cents(obligation.disponible)
        )
          throw new AppError(
            "El abono excede el saldo disponible, incluyendo pagos en revisión",
            409,
          );
        selected.push({
          obligacion_id: item.obligacion_id,
          importe: decimal(cents(item.importe)),
        });
      }
      return selected;
    }
    for (const row of rows) {
      if (row.anulada_en || remaining === 0n) continue;
      const available = cents(row.disponible);
      if (available <= 0n) continue;
      const amount = available < remaining ? available : remaining;
      selected.push({ obligacion_id: row.id, importe: decimal(amount) });
      remaining -= amount;
    }
    if (remaining !== 0n)
      throw new AppError(
        "El pago supera el saldo disponible de las obligaciones",
        409,
      );
    return selected;
  }

  static async prepare(
    db: DbClient,
    enrollment: InscripcionRecord,
    cohort: CohorteWithProgramRecord,
    data: CreatePaymentInput,
    uploadFingerprint: string | null = null,
  ) {
    if (
      !["BAUCHER_BANCARIO", "CAJA_ADMINISTRATIVA", "TRANSFERENCIA"].includes(
        data.metodo_pago,
      )
    )
      throw new AppError(
        "No existe un mecanismo de pago electrónico autorizado",
        400,
      );
    const amount = decimal(cents(data.total_pagado));
    if (
      cents(data.monto_subtotal) - cents(data.descuento_aplicado) !==
      cents(amount)
    )
      throw new AppError("Los importes del pago no coinciden", 400);
    const key =
      data.clave_idempotencia ||
      `legacy-${createHash("sha256")
        .update(
          JSON.stringify([
            data.metodo_pago,
            data.banco_origen || "",
            data.numero_referencia_o_recibo,
          ]),
        )
        .digest("hex")}`;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          metodo: data.metodo_pago,
          referencia: data.numero_referencia_o_recibo,
          banco: data.banco_origen || "",
          total: amount,
          subtotal: decimal(cents(data.monto_subtotal)),
          descuento: decimal(cents(data.descuento_aplicado)),
          concepto: data.concepto,
          comprobante: data.comprobante_baucher_url || null,
          archivo_sha256: uploadFingerprint,
          fecha: data.fecha_pago_reportada || null,
          aplicaciones: data.aplicaciones
            ? [...data.aplicaciones].sort((a, b) =>
                a.obligacion_id.localeCompare(b.obligacion_id),
              )
            : null,
        }),
      )
      .digest("hex");
    const previous = await db.query(
      `SELECT * FROM pagos_inscripcion WHERE inscripcion_id=$1 AND (clave_idempotencia=$2 OR (estado IN ('PENDIENTE_REVISION','APROBADO') AND metodo_pago=$3 AND numero_referencia_o_recibo=$4 AND COALESCE(banco_origen,'')=$5)) ORDER BY fecha_pago_reportada LIMIT 1`,
      [
        enrollment.id,
        key,
        data.metodo_pago,
        data.numero_referencia_o_recibo,
        data.banco_origen || "",
      ],
    );
    if (previous.rows[0]) {
      const old = previous.rows[0];
      const legacyChanged =
        !old.solicitud_hash &&
        (cents(old.total_pagado) !== cents(amount) ||
          cents(old.monto_subtotal) !== cents(data.monto_subtotal) ||
          cents(old.descuento_aplicado) !== cents(data.descuento_aplicado) ||
          old.concepto !== data.concepto ||
          Boolean(data.aplicaciones || uploadFingerprint) ||
          (data.comprobante_baucher_url &&
            data.comprobante_baucher_url !== old.comprobante_baucher_url) ||
          (data.fecha_pago_reportada &&
            new Date(data.fecha_pago_reportada).getTime() !==
              new Date(old.fecha_pago_reportada).getTime()));
      if (
        old.solicitud_hash ? old.solicitud_hash !== fingerprint : legacyChanged
      ) {
        throw new AppError(
          "La clave o referencia ya fue utilizada con otros datos; revise el pago existente",
          409,
        );
      }
      return {
        existing: old as PagoInscripcionRecord,
        key,
        fingerprint,
        applications: [] as Allocation[],
      };
    }
    await BillingService.ensureAgreement(enrollment, cohort, db);
    const applications = this.selectApplications(
      await this.obligations(db, enrollment.id),
      amount,
      data.aplicaciones,
    );
    return { existing: null, key, fingerprint, applications };
  }

  static async reserve(
    db: DbClient,
    payment: PagoInscripcionRecord,
    applications: Allocation[],
    actor: string | null,
  ) {
    for (const item of applications)
      await db.query(
        "INSERT INTO aplicaciones_pago(pago_id,obligacion_id,inscripcion_id,importe) VALUES($1,$2,$3,$4)",
        [payment.id, item.obligacion_id, payment.inscripcion_id, item.importe],
      );
    await BillingService.audit(
      db,
      payment.estado === "APROBADO" ? "COBRO_REGISTRADO" : "PAGO_REPORTADO",
      actor,
      payment.inscripcion_id,
      null,
      {
        pago_id: payment.id,
        total: payment.total_pagado,
        aplicaciones: applications,
      },
    );
  }

  /** Reuses the receipt's allocations; legacy pending vouchers are allocated only at authorized review. */
  static async beforeApproval(
    db: DbClient,
    payment: PagoInscripcionRecord,
    enrollment: InscripcionRecord,
    cohort: CohorteWithProgramRecord,
    actor: string,
  ) {
    await BillingService.ensureAgreement(enrollment, cohort, db, actor);
    const existing = await db.query(
      "SELECT obligacion_id,importe::text FROM aplicaciones_pago WHERE pago_id=$1 ORDER BY obligacion_id",
      [payment.id],
    );
    const selected = this.selectApplications(
      await this.obligations(db, enrollment.id, payment.id),
      decimal(cents(payment.total_pagado)),
      existing.rows.length ? (existing.rows as Allocation[]) : undefined,
    );
    if (!existing.rows.length) await this.reserve(db, payment, selected, actor);
  }

  static async issueReceipt(
    db: DbClient,
    payment: PagoInscripcionRecord,
    actor: string,
  ) {
    const exists = await db.query(
      "SELECT * FROM comprobantes_internos WHERE pago_id=$1",
      [payment.id],
    );
    if (exists.rows[0]) return exists.rows[0];
    const enrollment = await EnrollmentDao.findDetailedById(
      payment.inscripcion_id,
      db,
    );
    if (!enrollment) throw new AppError("Inscripción no encontrada", 404);
    const concepts = (
      await db.query(
        `SELECT o.concepto,o.tipo,a.importe::text FROM aplicaciones_pago a JOIN obligaciones_pago o ON o.id=a.obligacion_id WHERE a.pago_id=$1 ORDER BY o.numero`,
        [payment.id],
      )
    ).rows;
    if (
      !concepts.length ||
      concepts.reduce((sum, row) => sum + cents(row.importe), 0n) !==
        cents(payment.total_pagado)
    )
      throw new AppError(
        "El pago no tiene una distribución íntegra y verificable",
        409,
      );
    const snapshot = {
      tipo: "COMPROBANTE_INTERNO",
      estudiante: {
        nombres: enrollment.aspirante_nombres,
        apellidos: enrollment.aspirante_apellidos,
        identificacion: enrollment.aspirante_identificacion,
      },
      programa: enrollment.programa_nombre,
      cohorte: enrollment.cohorte_codigo,
      expediente: enrollment.codigo_expediente,
      conceptos: concepts,
      total: decimal(cents(payment.total_pagado)),
      metodo_pago: payment.metodo_pago,
      referencia: payment.numero_referencia_o_recibo,
      fecha_pago: payment.fecha_pago_reportada,
    };
    const result = await db.query(
      "INSERT INTO comprobantes_internos(pago_id,inscripcion_id,datos) VALUES($1,$2,$3) RETURNING *",
      [payment.id, payment.inscripcion_id, JSON.stringify(snapshot)],
    );
    await BillingService.audit(
      db,
      "COMPROBANTE_EMITIDO",
      actor,
      payment.inscripcion_id,
      enrollment.cohorte_id,
      {
        pago_id: payment.id,
        comprobante_id: result.rows[0].id,
        numero: String(result.rows[0].numero),
      },
    );
    return { ...result.rows[0], total: snapshot.total };
  }

  static async collect(id: string, raw: CollectPaymentInput, actor: string) {
    const data = collectPaymentSchema.parse(raw);
    const total = decimal(
      data.aplicaciones.reduce((sum, item) => sum + cents(item.importe), 0n),
    );
    cents(total);
    const paymentData: CreatePaymentInput = {
      ...data,
      monto_subtotal: total,
      descuento_aplicado: "0.00",
      total_pagado: total,
      concepto: "Cobro contra obligaciones académicas",
    };
    return withTransaction(async (db) => {
      const { enrollment, cohort } = await BillingService.lockContext(id, db);
      if (!BillingService.eligible(enrollment, cohort))
        throw new AppError(
          "El cobro requiere aprobación documental y quórum",
          409,
        );
      const prepared = await this.prepare(db, enrollment, cohort, paymentData);
      if (prepared.existing) {
        const receipt =
          (
            await db.query(
              "SELECT * FROM comprobantes_internos WHERE pago_id=$1",
              [prepared.existing.id],
            )
          ).rows[0] || null;
        return {
          pago: prepared.existing,
          comprobante: receipt
            ? { ...receipt, total: receipt.datos.total }
            : null,
          reintento: true,
        };
      }
      const payment = await EnrollmentDao.createPago(
        {
          ...paymentData,
          inscripcion_id: id,
          aspirante_id: enrollment.aspirante_id,
          estado: "APROBADO",
          clave_idempotencia: prepared.key,
          solicitud_hash: prepared.fingerprint,
        },
        db,
      );
      await db.query(
        "UPDATE pagos_inscripcion SET usuario_validador_caja_id=$2,fecha_validacion_caja=now() WHERE id=$1",
        [payment.id, actor],
      );
      await this.reserve(db, payment, prepared.applications, actor);
      const receipt = await this.issueReceipt(db, payment, actor);
      return {
        pago: { ...payment, usuario_validador_caja_id: actor },
        comprobante: receipt,
        reintento: false,
      };
    });
  }

  static async cancelPayment(
    id: string,
    paymentId: string,
    actor: string,
    reason: string,
  ) {
    return withTransaction(async (db) => {
      await BillingService.lockContext(id, db);
      const payment = await EnrollmentDao.findPagoByIdForUpdate(paymentId, db);
      if (!payment || payment.inscripcion_id !== id)
        throw new AppError("Pago no encontrado en esta inscripción", 404);
      if (payment.estado !== "APROBADO")
        throw new AppError(
          "Solo un pago aprobado puede anularse; use revisión para rechazar un comprobante pendiente",
          409,
        );
      await db.query(
        `UPDATE pagos_inscripcion SET estado='ANULADO' WHERE id=$1`,
        [paymentId],
      );
      await db.query(
        "UPDATE comprobantes_internos SET anulado_en=now(),anulado_por=$2,motivo_anulacion=$3 WHERE pago_id=$1",
        [paymentId, actor, reason],
      );
      await BillingService.audit(
        db,
        "PAGO_ANULADO",
        actor,
        id,
        null,
        { pago_id: paymentId, total: payment.total_pagado },
        reason,
      );
      return { ...payment, estado: "ANULADO" };
    });
  }

  static async cancelObligation(
    id: string,
    obligationId: string,
    actor: string,
    reason: string,
  ) {
    return withTransaction(async (db) => {
      await BillingService.lockContext(id, db);
      const row = (await this.obligations(db, id)).find(
        (item) => item.id === obligationId,
      );
      if (!row)
        throw new AppError("Obligación no encontrada en esta inscripción", 404);
      if (
        row.anulada_en ||
        cents(row.pagado) > 0n ||
        cents(row.en_revision) > 0n
      )
        throw new AppError(
          "La obligación ya está anulada o tiene pagos aplicados o en revisión",
          409,
        );
      await db.query(
        "UPDATE obligaciones_pago SET anulada_en=now(),anulada_por=$2,motivo_anulacion=$3 WHERE id=$1",
        [obligationId, actor, reason],
      );
      await BillingService.audit(
        db,
        "OBLIGACION_ANULADA",
        actor,
        id,
        null,
        { obligacion_id: obligationId, importe: row.importe },
        reason,
      );
      return { ...row, estado: "ANULADO", saldo: "0.00", disponible: "0.00" };
    });
  }
  static async reconcileLegacy(
    db: DbClient,
    enrollment: InscripcionRecord,
    actor: string,
    reason: string,
  ) {
    const rows = await db.query(
      `SELECT * FROM pagos_inscripcion WHERE inscripcion_id=$1 AND estado='APROBADO' ORDER BY fecha_pago_reportada,id FOR UPDATE`,
      [enrollment.id],
    );
    for (const payment of rows.rows as PagoInscripcionRecord[]) {
      const existing = await db.query(
        "SELECT importe::text FROM aplicaciones_pago WHERE pago_id=$1",
        [payment.id],
      );
      if (existing.rows.length) {
        if (
          existing.rows.reduce((sum, row) => sum + cents(row.importe), 0n) !==
          cents(payment.total_pagado)
        )
          throw new AppError(
            "Un pago histórico tiene aplicaciones incompletas; revise su conciliación",
            409,
          );
        continue;
      }
      const selected = this.selectApplications(
        await this.obligations(db, enrollment.id),
        decimal(cents(payment.total_pagado)),
      );
      await this.reserve(db, payment, selected, actor);
      await this.issueReceipt(db, payment, actor);
      await BillingService.audit(
        db,
        "PAGO_HISTORICO_CONCILIADO",
        actor,
        enrollment.id,
        enrollment.cohorte_id,
        { pago_id: payment.id },
        reason,
      );
    }
  }
}
