import { PaymentService } from "../billing/billing.payments";
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import express from "express";
import { pool } from "../../db/pool";
import { errorHandler } from "../../middlewares/error.middleware";
import { httpRequest } from "../../testing/http";
import { EnrollmentDao } from "./enrollment.dao";
import { EnrollmentController } from "./enrollment.controller";

afterEach(() => mock.restoreAll());

function fixture(state = "EN_REVISION_DOCUMENTAL") {
  const enrollment: any = {
    id: "enrollment",
    cohorte_id: "cohort",
    aspirante_id: "applicant",
    estado: state,
    observaciones_administracion: null,
    fecha_aprobacion_documental:
      state === "EN_REVISION_DOCUMENTAL" || state === "DOCUMENTACION_OBSERVADA"
        ? null
        : "2026-10-01",
    fecha_formalizacion_matricula:
      state === "MATRICULADO_ACTIVO" ? "2026-10-02" : null,
  };
  const cohort = {
    id: "cohort",
    estado_cohorte: "INSCRIPCION_ABIERTA",
    cupo_minimo: 1,
    cupo_maximo: 20,
    cupos_actuales_verificados: 0,
    cobro_habilitado: true,
  };
  const payments: any[] = [
    {
      id: "payment",
      inscripcion_id: "enrollment",
      estado: "PENDIENTE_REVISION",
    },
  ];
  const queues = new Map<string, Promise<void>>();
  async function lock(key: string, client: any) {
    const previous = queues.get(key) || Promise.resolve();
    let unlock!: () => void;
    const held = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    queues.set(
      key,
      previous.then(() => held),
    );
    await previous;
    client.unlocks.push(unlock);
  }
  mock.method(pool, "connect", async () => {
    const client: any = {
      unlocks: [] as (() => void)[],
      release() {
        while (this.unlocks.length) this.unlocks.pop()!();
      },
    };
    client.query = async (sql: string, values: string[] = []) => {
      if (/FOR UPDATE/.test(sql)) {
        const isPayment = /FROM pagos_inscripcion/.test(sql);
        await lock(
          `${isPayment ? "payment" : "enrollment"}:${values[0]}`,
          client,
        );
        return {
          rows: isPayment
            ? payments.filter((p) => p.id === values[0]).map((p) => ({ ...p }))
            : [{ ...enrollment }],
        };
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") client.release();
      return { rows: [] };
    };
    return client;
  });
  mock.method(EnrollmentDao, "findById", async () => ({ ...enrollment }));
  mock.method(EnrollmentDao, "findDetailedById", async () => ({
    ...enrollment,
  }));
  mock.method(
    EnrollmentDao,
    "getCohorteWithProgramForUpdate",
    async (_id: string, client: any) => {
      await lock("cohort", client);
      return { ...cohort };
    },
  );
  mock.method(EnrollmentDao, "getCohorteWithProgram", async () => ({
    ...cohort,
  }));
  mock.method(
    EnrollmentDao,
    "updateCohorteQuorum",
    async (
      _id: string,
      count: number,
      enabled: boolean,
      state: string | null,
    ) => {
      cohort.cupos_actuales_verificados = count;
      cohort.cobro_habilitado = enabled;
      if (state) cohort.estado_cohorte = state;
    },
  );
  mock.method(EnrollmentDao, "updateReservedToPendingPayment", async () => {});
  mock.method(
    EnrollmentDao,
    "updateInscripcionEstado",
    async (_id: string, state: string, extra: any) => {
      enrollment.estado = state;
      if ("observaciones" in extra)
        enrollment.observaciones_administracion = extra.observaciones;
      if (extra.fechaAprobacionDocumental)
        enrollment.fecha_aprobacion_documental = "2026-10-21";
      if (extra.fechaFormalizacionMatricula)
        enrollment.fecha_formalizacion_matricula = "2026-10-21";
      return { ...enrollment };
    },
  );
  mock.method(EnrollmentDao, "findPagoById", async (id: string) => ({
    ...payments.find((p) => p.id === id),
  }));
  mock.method(
    EnrollmentDao,
    "updatePagoValidation",
    async (id: string, state: string) => {
      const payment = payments.find((p) => p.id === id);
      payment.estado = state;
      return { ...payment };
    },
  );
  mock.method(EnrollmentDao, "createPago", async (data: any) => {
    const payment = { id: "new-payment", ...data };
    payments.push(payment);
    return payment;
  });
  // These fixtures isolate academic transitions; real obligation accounting is tested against PostgreSQL.
  mock.method(PaymentService, "prepare", async () => ({
    existing: null,
    key: "test-transition",
    fingerprint: "test",
    applications: [],
  }));
  mock.method(PaymentService, "reserve", async () => {});
  mock.method(PaymentService, "beforeApproval", async () => {});
  mock.method(PaymentService, "issueReceipt", async () => ({ id: "receipt" }));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "operator", rol: "SUPER_ADMIN", permisos: [] };
    next();
  });
  app.patch(
    "/enrollments/:id/validate-documents",
    EnrollmentController.validateDocuments,
  );
  app.post("/enrollments/:id/payments", EnrollmentController.registerPayment);
  app.patch(
    "/payments/:paymentId/validate",
    EnrollmentController.validatePayment,
  );
  app.use(errorHandler);
  return {
    app,
    enrollment,
    cohort,
    payments,
    snapshot: () => JSON.stringify({ enrollment, cohort, payments }),
  };
}

for (const state of [
  "INSCRITO_RESERVADO",
  "PENDIENTE_PAGO",
  "PAGO_EN_REVISION",
  "MATRICULADO_ACTIVO",
  "RETIRADO",
  "EGRESADO",
  "GRADUADO_O_CERTIFICADO",
  "LISTA_ESPERA",
  "PENDIENTE_COMITE_PONENCIA",
]) {
  test(`document observations cannot move ${state} back to review`, async () => {
    const f = fixture(state),
      before = f.snapshot();
    const response = await httpRequest(
      f.app,
      "/enrollments/enrollment/validate-documents",
      "PATCH",
      { aprobado: false },
    );
    assert.equal(response.status, 409);
    assert.equal(f.snapshot(), before);
  });
}
test("document review keeps observation and subsequent quorum approval behavior", async () => {
  const f = fixture();
  assert.equal(
    (
      await httpRequest(
        f.app,
        "/enrollments/enrollment/validate-documents",
        "PATCH",
        { aprobado: false },
      )
    ).status,
    200,
  );
  assert.equal(f.enrollment.estado, "DOCUMENTACION_OBSERVADA");
  assert.equal(f.cohort.cupos_actuales_verificados, 0);
  assert.equal(
    (
      await httpRequest(
        f.app,
        "/enrollments/enrollment/validate-documents",
        "PATCH",
        { aprobado: true },
      )
    ).status,
    200,
  );
  assert.equal(f.enrollment.estado, "PENDIENTE_PAGO");
  assert.equal(f.cohort.cupos_actuales_verificados, 1);
});
test("concurrent approvals count an application only once", async () => {
  const f = fixture();
  const responses = await Promise.all(
    [true, true].map((aprobado) =>
      httpRequest(
        f.app,
        "/enrollments/enrollment/validate-documents",
        "PATCH",
        { aprobado },
      ),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  assert.equal(f.cohort.cupos_actuales_verificados, 1);
});
test("document approval cannot exceed the existing maximum capacity", async () => {
  const f = fixture();
  f.cohort.cupo_maximo = 1;
  f.cohort.cupos_actuales_verificados = 1;
  const before = f.snapshot();
  assert.equal(
    (
      await httpRequest(
        f.app,
        "/enrollments/enrollment/validate-documents",
        "PATCH",
        { aprobado: true },
      )
    ).status,
    409,
  );
  assert.equal(f.snapshot(), before);
});
test("concurrent payment decisions admit only one decision for a pending receipt", async () => {
  const f = fixture("PAGO_EN_REVISION");
  const responses = await Promise.all(
    ["APROBADO", "RECHAZADO"].map((estado) =>
      httpRequest(f.app, "/payments/payment/validate", "PATCH", { estado }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  assert.equal(f.payments[0].estado, "APROBADO");
  assert.equal(f.enrollment.estado, "PENDIENTE_PAGO");
});
test("rejecting another pending receipt preserves established matriculation and its date", async () => {
  const f = fixture("MATRICULADO_ACTIVO"),
    date = f.enrollment.fecha_formalizacion_matricula;
  assert.equal(
    (
      await httpRequest(f.app, "/payments/payment/validate", "PATCH", {
        estado: "RECHAZADO",
      })
    ).status,
    200,
  );
  assert.equal(f.enrollment.estado, "MATRICULADO_ACTIVO");
  assert.equal(f.enrollment.fecha_formalizacion_matricula, date);
  assert.equal(f.payments[0].estado, "RECHAZADO");
});
for (const state of ["RETIRADO", "EGRESADO", "GRADUADO_O_CERTIFICADO"]) {
  test(`a pending payment cannot reactivate ${state}`, async () => {
    const f = fixture(state),
      before = f.snapshot();
    assert.equal(
      (
        await httpRequest(f.app, "/payments/payment/validate", "PATCH", {
          estado: "APROBADO",
        })
      ).status,
      409,
    );
    assert.equal(f.snapshot(), before);
  });
}
test("cohort quorum alone cannot authorize payment before own documentary approval", async () => {
  const f = fixture("DOCUMENTACION_OBSERVADA"),
    before = f.snapshot();
  assert.equal(
    (
      await httpRequest(f.app, "/enrollments/enrollment/payments", "POST", {
        metodo_pago: "CAJA_ADMINISTRATIVA",
        total_pagado: 100,
      })
    ).status,
    409,
  );
  assert.equal(f.snapshot(), before);
});
test("a document-approved pending account can still register its receipt", async () => {
  const f = fixture("PENDIENTE_PAGO");
  assert.equal(
    (
      await httpRequest(f.app, "/enrollments/enrollment/payments", "POST", {
        metodo_pago: "CAJA_ADMINISTRATIVA",
        total_pagado: 100,
      })
    ).status,
    201,
  );
  assert.equal(f.enrollment.estado, "PAGO_EN_REVISION");
  assert.equal(f.payments.length, 2);
});
for (const state of [
  "CANCELADA",
  "FINALIZADA_PENDIENTE_EVAL",
  "EVALUADA_SETEC",
]) {
  for (const operation of ["documents", "register", "decision"]) {
    test(`${state} cohort cannot be reactivated through ${operation}`, async () => {
      const f = fixture(
        operation === "documents"
          ? "EN_REVISION_DOCUMENTAL"
          : "PAGO_EN_REVISION",
      );
      f.cohort.estado_cohorte = state;
      const before = f.snapshot();
      const response =
        operation === "documents"
          ? await httpRequest(
              f.app,
              "/enrollments/enrollment/validate-documents",
              "PATCH",
              { aprobado: true },
            )
          : operation === "register"
            ? await httpRequest(
                f.app,
                "/enrollments/enrollment/payments",
                "POST",
                { metodo_pago: "CAJA_ADMINISTRATIVA", total_pagado: 100 },
              )
            : await httpRequest(f.app, "/payments/payment/validate", "PATCH", {
                estado: "APROBADO",
              });
      assert.equal(response.status, 409);
      assert.equal(f.snapshot(), before);
    });
  }
}
test("pending receipt approval cannot bypass a disabled cohort collection gate", async () => {
  const f = fixture("PAGO_EN_REVISION");
  f.cohort.cobro_habilitado = false;
  const before = f.snapshot();
  assert.equal(
    (
      await httpRequest(f.app, "/payments/payment/validate", "PATCH", {
        estado: "APROBADO",
      })
    ).status,
    409,
  );
  assert.equal(f.snapshot(), before);
});
test("approval below quorum preserves a reserved place without enabling collection", async () => {
  const f = fixture();
  f.cohort.cupo_minimo = 2;
  f.cohort.cobro_habilitado = false;
  assert.equal(
    (
      await httpRequest(
        f.app,
        "/enrollments/enrollment/validate-documents",
        "PATCH",
        { aprobado: true },
      )
    ).status,
    200,
  );
  assert.equal(f.enrollment.estado, "INSCRITO_RESERVADO");
  assert.equal(f.cohort.cupos_actuales_verificados, 1);
  assert.equal(f.cohort.cobro_habilitado, false);
});

test("approving payment leaves matriculation for an explicit administrator decision", async () => {
  const f = fixture("PAGO_EN_REVISION");
  const response = await httpRequest(
    f.app,
    "/payments/payment/validate",
    "PATCH",
    { estado: "APROBADO" },
  );
  assert.equal(response.status, 200);
  assert.equal(f.payments[0].estado, "APROBADO");
  assert.equal(f.enrollment.estado, "PENDIENTE_PAGO");
  assert.equal(f.enrollment.fecha_formalizacion_matricula, null);
});

for (const reason of ["Comprobante ilegible de prueba", undefined]) {
  test(`rejected voucher preserves enrollment observations: ${reason || "existing default"}`, async () => {
    const f = fixture("PAGO_EN_REVISION");
    const response = await httpRequest(
      f.app,
      "/payments/payment/validate",
      "PATCH",
      { estado: "RECHAZADO", ...(reason ? { motivo_rechazo: reason } : {}) },
    );
    assert.equal(response.status, 200);
    const expected = reason || "Comprobante de pago rechazado por tesorería";
    assert.equal(
      response.body.data.inscripcion.observaciones_administracion,
      expected,
    );
    assert.equal(f.enrollment.observaciones_administracion, expected);
    assert.equal(f.enrollment.estado, "PENDIENTE_PAGO");
    assert.equal(f.enrollment.fecha_formalizacion_matricula, null);
  });
}
