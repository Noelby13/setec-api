import { pool, withTransaction, DbClient } from "../../db/pool";
import { AppError } from "../../middlewares/error.middleware";
import {
  EnrollmentDao,
  CohorteWithProgramRecord,
  InscripcionRecord,
} from "../enrollments/enrollment.dao";
import { cents, decimal, obligationState } from "./billing.money";
import { CreatePlanInput, createPlanSchema } from "./billing.schema";

type Row = Record<string, any>;
export class BillingService {
  static async audit(
    db: DbClient,
    action: string,
    actor: string | null,
    enrollment: string | null,
    cohort: string | null,
    detail: Row = {},
    reason?: string,
  ) {
    await db.query(
      `INSERT INTO auditoria_economica(accion,usuario_id,inscripcion_id,cohorte_id,detalle,motivo) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        action,
        actor,
        enrollment,
        cohort,
        JSON.stringify(detail),
        reason || null,
      ],
    );
  }

  static async lockContext(id: string, db: DbClient) {
    const original = await EnrollmentDao.findById(id, db);
    if (!original) throw new AppError("Inscripción no encontrada", 404);
    const cohort = await EnrollmentDao.getCohorteWithProgramForUpdate(
      original.cohorte_id,
      db,
    );
    const enrollment = await EnrollmentDao.findByIdForUpdate(id, db);
    if (!cohort || !enrollment || enrollment.cohorte_id !== cohort.id)
      throw new AppError("El contexto de inscripción cambió", 409);
    if (
      ["CANCELADA", "FINALIZADA_PENDIENTE_EVAL", "EVALUADA_SETEC"].includes(
        cohort.estado_cohorte,
      )
    )
      throw new AppError("La cohorte no admite operaciones económicas", 409);
    return { enrollment, cohort };
  }

  static eligible(
    enrollment: InscripcionRecord,
    cohort: CohorteWithProgramRecord,
  ) {
    return Boolean(
      enrollment.fecha_aprobacion_documental &&
      cohort.cobro_habilitado &&
      ["PENDIENTE_PAGO", "PAGO_EN_REVISION", "MATRICULADO_ACTIVO"].includes(
        enrollment.estado,
      ),
    );
  }

  static async getPlans(cohortId: string, db: DbClient = pool) {
    const result = await db.query(
      `SELECT p.*,COALESCE((SELECT json_agg(json_build_object('id',q.id,'numero',q.numero,'concepto',q.concepto,'importe',q.importe::text,'fecha_vencimiento',to_char(q.fecha_vencimiento,'YYYY-MM-DD'),'componente_id',q.componente_id) ORDER BY q.numero) FROM cuotas_plan_pago q WHERE q.plan_id=p.id),'[]'::json) AS cuotas FROM planes_pago_cohorte p WHERE p.cohorte_id=$1 ORDER BY p.nombre,p.version DESC`,
      [cohortId],
    );
    return result.rows;
  }

  static async createPlan(
    cohortId: string,
    raw: CreatePlanInput,
    actor: string,
  ) {
    const data = createPlanSchema.parse(raw);
    return withTransaction((db) => this.publishPlan(cohortId, data, actor, db));
  }

  /** Caller owns the cohort transaction; standalone plan publication uses the same locking order. */
  static async publishPlan(
    cohortId: string,
    data: CreatePlanInput,
    actor: string,
    db: DbClient,
  ) {
    const cohort = await EnrollmentDao.getCohorteWithProgramForUpdate(
      cohortId,
      db,
    );
    if (!cohort) throw new AppError("Cohorte no encontrada", 404);
    if (
      ["CANCELADA", "FINALIZADA_PENDIENTE_EVAL", "EVALUADA_SETEC"].includes(
        cohort.estado_cohorte,
      )
    )
      throw new AppError("La cohorte no admite nuevos planes", 409);
    for (const row of data.cuotas) {
      if (row.componente_id) {
        const component = await db.query(
          "SELECT id FROM componentes_curriculares WHERE id=$1 AND programa_id=$2",
          [row.componente_id, cohort.programa_id],
        );
        if (!component.rows.length)
          throw new AppError(
            "El módulo debe pertenecer al programa académico de esta cohorte",
            400,
          );
      }
    }
    const version = await db.query(
      `SELECT COALESCE(MAX(version),0)+1 AS next FROM planes_pago_cohorte WHERE cohorte_id=$1 AND nombre=$2`,
      [cohortId, data.nombre],
    );
    if (data.predeterminado)
      await db.query(
        "UPDATE planes_pago_cohorte SET predeterminado=false WHERE cohorte_id=$1 AND predeterminado",
        [cohortId],
      );
    const inserted = await db.query(
      `INSERT INTO planes_pago_cohorte(cohorte_id,nombre,version,modalidad,predeterminado,monto_matricula,precio_academico,creado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        cohortId,
        data.nombre,
        version.rows[0].next,
        data.modalidad,
        data.predeterminado,
        data.monto_matricula,
        data.precio_academico,
        actor,
      ],
    );
    const plan = inserted.rows[0];
    for (const [index, row] of data.cuotas.entries())
      await db.query(
        `INSERT INTO cuotas_plan_pago(plan_id,numero,concepto,importe,fecha_vencimiento,componente_id) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          plan.id,
          index + 1,
          row.concepto,
          row.importe,
          row.fecha_vencimiento || null,
          row.componente_id || null,
        ],
      );
    if (data.predeterminado)
      await db.query(
        "UPDATE cohortes_apertura SET precio_matricula=$2,precio_total_cohorte=$3 WHERE id=$1",
        [cohortId, data.monto_matricula, data.precio_academico],
      );
    await this.audit(db, "PLAN_PUBLICADO", actor, null, cohortId, {
      plan_id: plan.id,
      version: plan.version,
    });
    return { ...plan, cuotas: data.cuotas };
  }

  /** Publish only changed cohort schedules; accepted student agreements are never rewritten. */
  static async saveCohortPlan(
    cohortId: string,
    data: CreatePlanInput,
    actor: string,
    db: DbClient,
  ) {
    const cohort = await EnrollmentDao.getCohorteWithProgramForUpdate(
      cohortId,
      db,
    );
    if (!cohort) throw new AppError("Cohorte no encontrada", 404);
    if (data.modalidad === "MODULOS") {
      const components = await db.query(
        "SELECT id FROM componentes_curriculares WHERE programa_id=$1",
        [cohort.programa_id],
      );
      const ids = new Set(data.cuotas.map((row) => row.componente_id));
      if (
        !components.rows.length ||
        ids.size !== data.cuotas.length ||
        ids.size !== components.rows.length ||
        components.rows.some((row) => !ids.has(row.id))
      )
        throw new AppError(
          "Configure un precio y fecha de pago para cada módulo del programa",
          400,
        );
    }
    const previous = (await this.getPlans(cohortId, db)).find(
      (plan) => plan.predeterminado,
    );
    const identity = (plan: any) =>
      JSON.stringify({
        nombre: plan.nombre,
        modalidad: plan.modalidad,
        monto_matricula: decimal(cents(plan.monto_matricula)),
        precio_academico: decimal(cents(plan.precio_academico)),
        cuotas: plan.cuotas.map((row: any) => ({
          concepto: row.concepto,
          importe: decimal(cents(row.importe)),
          fecha_vencimiento: row.fecha_vencimiento || null,
          componente_id: row.componente_id || null,
        })),
      });
    if (previous && identity(previous) === identity(data)) return previous;
    return this.publishPlan(cohortId, data, actor, db);
  }

  static async assignPlan(id: string, planId: string, actor: string) {
    return withTransaction(async (db) => {
      const { enrollment, cohort } = await this.lockContext(id, db);
      const agreement = await db.query(
        "SELECT id FROM acuerdos_pago_inscripcion WHERE inscripcion_id=$1",
        [id],
      );
      if (agreement.rows.length)
        throw new AppError(
          "El estudiante ya tiene obligaciones aceptadas; no se cambian sus precios generales",
          409,
        );
      if (
        ![
          "EN_REVISION_DOCUMENTAL",
          "DOCUMENTACION_OBSERVADA",
          "INSCRITO_RESERVADO",
          "PENDIENTE_PAGO",
        ].includes(enrollment.estado)
      )
        throw new AppError("El estado actual no permite asignar un plan", 409);
      const plan = await db.query(
        "SELECT id FROM planes_pago_cohorte WHERE id=$1 AND cohorte_id=$2",
        [planId, cohort.id],
      );
      if (!plan.rows.length)
        throw new AppError("El plan no pertenece a la cohorte", 400);
      await db.query(
        `INSERT INTO planes_asignados_inscripcion(inscripcion_id,plan_id,asignado_por) VALUES($1,$2,$3) ON CONFLICT(inscripcion_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,asignado_por=EXCLUDED.asignado_por,asignado_en=now()`,
        [id, planId, actor],
      );
      await this.audit(db, "PLAN_ASIGNADO", actor, id, cohort.id, {
        plan_id: planId,
      });
      if (this.eligible(enrollment, cohort))
        await this.ensureAgreement(enrollment, cohort, db, actor);
      return { inscripcion_id: id, plan_id: planId };
    });
  }

  /** Caller holds cohort then enrollment locks. Never re-price an existing agreement. */
  static async ensureAgreement(
    enrollment: InscripcionRecord,
    cohort: CohorteWithProgramRecord,
    db: DbClient,
    actor: string | null = null,
    automatic = false,
    historicalReason?: string,
  ): Promise<Row | null> {
    const existing = await db.query(
      "SELECT * FROM acuerdos_pago_inscripcion WHERE inscripcion_id=$1",
      [enrollment.id],
    );
    if (existing.rows[0]) return existing.rows[0];
    if (!this.eligible(enrollment, cohort)) {
      if (automatic) return null;
      throw new AppError(
        "Las obligaciones requieren aprobación documental y cobro habilitado por quórum",
        409,
      );
    }
    // Historical payments do not prove a historical agreed price. Do not silently fabricate old debt.
    const historical = await db.query(
      `SELECT id FROM pagos_inscripcion WHERE inscripcion_id=$1 AND estado='APROBADO' LIMIT 1`,
      [enrollment.id],
    );
    if (historical.rows.length && !historicalReason) {
      if (automatic) return null;
      throw new AppError(
        "La inscripción tiene pagos históricos: requiere conciliación administrativa explícita antes de generar obligaciones",
        409,
      );
    }
    const selected = await db.query(
      `SELECT p.* FROM planes_pago_cohorte p WHERE p.cohorte_id=$1 AND p.id=COALESCE((SELECT plan_id FROM planes_asignados_inscripcion WHERE inscripcion_id=$2),(SELECT id FROM planes_pago_cohorte WHERE cohorte_id=$1 AND predeterminado))`,
      [cohort.id, enrollment.id],
    );
    const plan = selected.rows[0];
    if (!plan && cohort.descuento_porcentaje) {
      if (automatic) return null;
      throw new AppError(
        "Configure un plan con el precio académico acordado antes de aplicar una tarifa con descuento existente",
        409,
      );
    }
    const fee = decimal(
      cents(plan?.monto_matricula ?? cohort.precio_matricula),
    );
    const price = decimal(
      cents(plan?.precio_academico ?? cohort.precio_total_cohorte),
    );
    const mode =
      plan?.modalidad ||
      (cents(fee) + cents(price) === 0n ? "GRATUITO" : "PAGO_UNICO");
    const inserted = await db.query(
      `INSERT INTO acuerdos_pago_inscripcion(inscripcion_id,plan_id,nombre_plan,modalidad,monto_matricula,precio_academico,aceptado_por) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        enrollment.id,
        plan?.id || null,
        plan?.nombre || "Tarifa vigente de cohorte",
        mode,
        fee,
        price,
        actor,
      ],
    );
    const agreement = inserted.rows[0];
    const items: Row[] = plan
      ? (
          await db.query(
            `SELECT *,to_char(fecha_vencimiento,'YYYY-MM-DD') AS fecha_vencimiento FROM cuotas_plan_pago WHERE plan_id=$1 ORDER BY numero`,
            [plan.id],
          )
        ).rows
      : cents(price) > 0n
        ? [{ numero: 1, concepto: "Costo académico", importe: price }]
        : [];
    if (cents(fee) > 0n)
      await db.query(
        `INSERT INTO obligaciones_pago(acuerdo_id,inscripcion_id,numero,tipo,concepto,importe) VALUES($1,$2,0,'MATRICULA','Matrícula',$3)`,
        [agreement.id, enrollment.id, fee],
      );
    for (const row of items)
      await db.query(
        `INSERT INTO obligaciones_pago(acuerdo_id,inscripcion_id,numero,tipo,concepto,importe,fecha_vencimiento,componente_id) VALUES($1,$2,$3,'ACADEMICO',$4,$5,$6,$7)`,
        [
          agreement.id,
          enrollment.id,
          row.numero,
          row.concepto,
          row.importe,
          row.fecha_vencimiento || null,
          row.componente_id || null,
        ],
      );
    await this.audit(
      db,
      "OBLIGACIONES_GENERADAS",
      actor,
      enrollment.id,
      cohort.id,
      { acuerdo_id: agreement.id, plan_id: plan?.id || null },
    );
    return agreement;
  }

  static async generateEligibleForCohort(cohortId: string, db: DbClient) {
    const rows = await db.query(
      `SELECT id FROM inscripciones WHERE cohorte_id=$1 AND fecha_aprobacion_documental IS NOT NULL AND estado IN ('PENDIENTE_PAGO','PAGO_EN_REVISION','MATRICULADO_ACTIVO') ORDER BY id`,
      [cohortId],
    );
    const cohort = rows.rows.length
      ? await EnrollmentDao.getCohorteWithProgramForUpdate(cohortId, db)
      : null;
    if (!cohort) return;
    for (const row of rows.rows) {
      const enrollment = await EnrollmentDao.findByIdForUpdate(row.id, db);
      if (enrollment)
        await this.ensureAgreement(enrollment, cohort, db, null, true);
    }
  }

  static async acceptAgreement(
    id: string,
    planId: string | undefined,
    actor: string,
    reason?: string,
  ) {
    return withTransaction(async (db) => {
      const { enrollment, cohort } = await this.lockContext(id, db);
      if (planId) {
        const current = await db.query(
          "SELECT plan_id FROM acuerdos_pago_inscripcion WHERE inscripcion_id=$1",
          [id],
        );
        if (current.rows.length && current.rows[0].plan_id !== planId)
          throw new AppError(
            "Las obligaciones aceptadas no se reemplazan mediante un cambio de tarifa",
            409,
          );
        const plan = await db.query(
          "SELECT id FROM planes_pago_cohorte WHERE id=$1 AND cohorte_id=$2",
          [planId, cohort.id],
        );
        if (!plan.rows.length)
          throw new AppError("El plan no pertenece a la cohorte", 400);
        await db.query(
          `INSERT INTO planes_asignados_inscripcion(inscripcion_id,plan_id,asignado_por) VALUES($1,$2,$3) ON CONFLICT(inscripcion_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,asignado_por=EXCLUDED.asignado_por,asignado_en=now()`,
          [id, planId, actor],
        );
      }
      const agreement = await this.ensureAgreement(
        enrollment,
        cohort,
        db,
        actor,
        false,
        reason,
      );
      if (reason) {
        const { PaymentService } = await import("./billing.payments");
        await PaymentService.reconcileLegacy(db, enrollment, actor, reason);
      }
      return agreement;
    });
  }

  static async activate(id: string, actor: string, reason: string) {
    return withTransaction(async (db) => {
      const { enrollment, cohort } = await this.lockContext(id, db);
      if (!this.eligible(enrollment, cohort))
        throw new AppError(
          "La activación requiere aprobación documental, quórum y un estado de inscripción habilitado",
          409,
        );
      if (enrollment.estado === "MATRICULADO_ACTIVO") return enrollment;
      await this.ensureAgreement(enrollment, cohort, db, actor, true);
      const result = await EnrollmentDao.updateInscripcionEstado(
        id,
        "MATRICULADO_ACTIVO",
        { fechaFormalizacionMatricula: true },
        db,
      );
      await this.audit(
        db,
        "MATRICULA_ACTIVADA",
        actor,
        id,
        cohort.id,
        {},
        reason,
      );
      return result;
    });
  }

  static async getAccount(id: string) {
    return withTransaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const enrollment = await EnrollmentDao.findDetailedById(id, db);
      if (!enrollment) throw new AppError("Inscripción no encontrada", 404);
      const agreement =
        (
          await db.query(
            "SELECT * FROM acuerdos_pago_inscripcion WHERE inscripcion_id=$1",
            [id],
          )
        ).rows[0] || null;
      const { PaymentService } = await import("./billing.payments");
      const obligations = await PaymentService.obligations(db, id);
      const history = await EnrollmentDao.findPagosByInscripcionId(id, db);
      const unallocated = (
        await db.query(
          `SELECT p.id FROM pagos_inscripcion p WHERE p.inscripcion_id=$1 AND p.estado='APROBADO' AND p.total_pagado<>(SELECT COALESCE(SUM(a.importe),0) FROM aplicaciones_pago a WHERE a.pago_id=p.id)`,
          [id],
        )
      ).rows;
      const legacy = unallocated.length > 0;
      const receipts = (
        await db.query(
          `SELECT id,numero::text,pago_id,emitido_en,anulado_en,motivo_anulacion,datos->>'total' AS total FROM comprobantes_internos WHERE inscripcion_id=$1 ORDER BY numero DESC`,
          [id],
        )
      ).rows;
      const totalPaid = history
        .filter((row) => row.estado === "APROBADO")
        .reduce((sum, row) => sum + cents(row.total_pagado), 0n);
      const overdue = obligations.filter((row) => row.estado === "VENCIDO");
      const next = obligations
        .filter(
          (row) =>
            !row.anulada_en &&
            cents(row.saldo) > 0n &&
            row.fecha_vencimiento &&
            row.fecha_vencimiento >= row.hoy,
        )
        .sort((a, b) =>
          a.fecha_vencimiento.localeCompare(b.fecha_vencimiento),
        )[0];
      return {
        inscripcion: {
          id: enrollment.id,
          codigo_expediente: enrollment.codigo_expediente,
          estado: enrollment.estado,
          aspirante_nombres: enrollment.aspirante_nombres,
          aspirante_apellidos: enrollment.aspirante_apellidos,
          cohorte_codigo: enrollment.cohorte_codigo,
          cohorte_id: enrollment.cohorte_id,
          programa_id: enrollment.programa_id,
          programa_nombre: enrollment.programa_nombre,
          cobro_habilitado: enrollment.cobro_habilitado,
        },
        acuerdo: agreement,
        obligaciones: obligations,
        pagos: history,
        requiere_conciliacion: legacy,
        resumen: {
          monto_matricula: agreement?.monto_matricula || null,
          costo_academico: agreement?.precio_academico || null,
          total_comprometido: agreement
            ? decimal(
                cents(agreement.monto_matricula) +
                  cents(agreement.precio_academico),
              )
            : null,
          total_pagado: decimal(totalPaid),
          saldo_pendiente:
            agreement && !legacy
              ? decimal(
                  obligations.reduce((sum, row) => sum + cents(row.saldo), 0n),
                )
              : null,
          matricula_pendiente:
            agreement && !legacy
              ? decimal(
                  obligations
                    .filter((row) => row.tipo === "MATRICULA")
                    .reduce((sum, row) => sum + cents(row.saldo), 0n),
                )
              : null,
          en_revision: decimal(
            obligations.reduce((sum, row) => sum + cents(row.en_revision), 0n),
          ),
          importe_anulado: decimal(
            obligations
              .filter((row) => row.anulada_en)
              .reduce((sum, row) => sum + cents(row.importe), 0n),
          ),
          vencido:
            agreement && !legacy
              ? decimal(
                  overdue.reduce((sum, row) => sum + cents(row.saldo), 0n),
                )
              : null,
          obligaciones_vencidas: overdue.length,
          proximo_vencimiento: next?.fecha_vencimiento || null,
        },
        comprobantes: receipts,
      };
    });
  }
}
