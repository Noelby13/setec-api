import assert from "node:assert/strict";
import { test } from "node:test";
import { updateCohorteSchema } from "../cohorts/cohort.schema";

const plan = {
  nombre: "Pagos por módulo",
  modalidad: "MODULOS",
  predeterminado: true,
  monto_matricula: "0.00",
  precio_academico: "100.01",
  cuotas: [
    {
      concepto: "Módulo 1",
      importe: "50.01",
      fecha_vencimiento: "2026-11-01",
      componente_id: "11111111-1111-4111-8111-111111111111",
    },
    {
      concepto: "Módulo 2",
      importe: "50.00",
      fecha_vencimiento: "2026-12-01",
      componente_id: "22222222-2222-4222-8222-222222222222",
    },
  ],
};
test("cohort updates retain module amounts and payment dates in JSON and multipart", () => {
  for (const plan_pago of [plan, JSON.stringify(plan)]) {
    const result = updateCohorteSchema.parse({ plan_pago }) as any;
    assert.deepEqual(result.plan_pago, plan);
  }
});
test("embedded module schedules require a valid date and unique module for each charge", () => {
  for (const fecha_vencimiento of [null, undefined, "", "2026-02-30"]) {
    const invalid = {
      ...plan,
      cuotas: [{ ...plan.cuotas[0], fecha_vencimiento }, plan.cuotas[1]],
    };
    assert.equal(
      updateCohorteSchema.safeParse({ plan_pago: invalid }).success,
      false,
    );
  }
  assert.equal(
    updateCohorteSchema.safeParse({
      plan_pago: {
        ...plan,
        cuotas: [
          plan.cuotas[0],
          { ...plan.cuotas[1], componente_id: plan.cuotas[0].componente_id },
        ],
      },
    }).success,
    false,
  );
});
test("embedded schedule rejects non-default offers, wrong totals and malformed multipart JSON", () => {
  for (const plan_pago of [
    { ...plan, predeterminado: false },
    { ...plan, precio_academico: "100.00" },
    "{",
  ])
    assert.equal(updateCohorteSchema.safeParse({ plan_pago }).success, false);
});
test("free and enrollment-only cohorts can publish zero academic cost without module charges", () => {
  for (const [modalidad, monto_matricula] of [
    ["GRATUITO", "0.00"],
    ["PAGO_UNICO", "50.00"],
  ]) {
    const free = {
      ...plan,
      modalidad,
      monto_matricula,
      precio_academico: "0.00",
      cuotas: [],
    };
    assert.deepEqual(
      (updateCohorteSchema.parse({ plan_pago: free }) as any).plan_pago,
      free,
    );
  }
  assert.equal(
    updateCohorteSchema.safeParse({ horario_general: "Saturday" }).success,
    true,
  );
});
