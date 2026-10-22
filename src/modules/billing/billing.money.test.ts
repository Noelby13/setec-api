import assert from "node:assert/strict";
import { test } from "node:test";
import { cents, decimal, obligationState } from "./billing.money";
import { createPlanSchema } from "./billing.schema";

test("academic plan separates C$2,000 enrollment from three C$10,000 installments", () => {
  const plan = createPlanSchema.parse({
    nombre: "Tres cuotas",
    modalidad: "CUOTAS",
    monto_matricula: "2000.00",
    precio_academico: "30000.00",
    cuotas: [1, 2, 3].map((n) => ({
      concepto: `Cuota ${n}`,
      importe: "10000.00",
      fecha_vencimiento: `2026-${String(n + 7).padStart(2, "0")}-15`,
    })),
  });
  assert.equal(
    decimal(
      cents(plan.monto_matricula) +
        plan.cuotas.reduce((sum, row) => sum + cents(row.importe), 0n),
    ),
    "32000.00",
  );
  assert.equal(
    createPlanSchema.safeParse({ ...plan, cuotas: plan.cuotas.slice(1) })
      .success,
    false,
  );
});

test("exact money accepts cents and rejects excess precision, negative and oversized amounts", () => {
  assert.equal(decimal(cents("0.10") + cents("0.20")), "0.30");
  assert.equal(decimal(cents("9999999999.99")), "9999999999.99");
  for (const value of [
    "-1",
    "1.001",
    "1e2",
    "NaN",
    "10000000000.00",
    0.1 + 0.2,
  ])
    assert.throws(() => cents(value));
});

test("free, single-payment and real-module plans have explicit valid structures", () => {
  const free = {
    nombre: "Gratuito",
    modalidad: "GRATUITO",
    monto_matricula: "0",
    precio_academico: "0",
    cuotas: [],
  };
  assert.equal(createPlanSchema.safeParse(free).success, true);
  assert.equal(
    createPlanSchema.safeParse({ ...free, monto_matricula: "1" }).success,
    false,
  );
  const single = {
    nombre: "Contado",
    modalidad: "PAGO_UNICO",
    monto_matricula: "0",
    precio_academico: "30000",
    cuotas: [{ concepto: "Costo académico", importe: "30000" }],
  };
  assert.equal(createPlanSchema.safeParse(single).success, true);
  assert.equal(
    createPlanSchema.safeParse({ ...single, modalidad: "MODULOS" }).success,
    false,
  );
  assert.equal(
    createPlanSchema.safeParse({
      ...single,
      cuotas: [{ ...single.cuotas[0], fecha_vencimiento: "2026-02-30" }],
    }).success,
    false,
  );
});

test("obligation state derives from approved amounts, due date and explicit cancellation", () => {
  assert.equal(
    obligationState("10000", "0", null, false, "2026-10-21"),
    "PENDIENTE",
  );
  assert.equal(
    obligationState("10000", "4000", null, false, "2026-10-21"),
    "PARCIALMENTE_PAGADO",
  );
  assert.equal(decimal(cents("10000") - cents("4000")), "6000.00");
  assert.equal(
    obligationState("10000", "10000", "2026-10-01", false, "2026-10-21"),
    "PAGADO",
  );
  assert.equal(
    obligationState("10000", "4000", "2026-10-20", false, "2026-10-21"),
    "VENCIDO",
  );
  assert.equal(
    obligationState("10000", "0", "2026-10-21", false, "2026-10-21"),
    "PENDIENTE",
  );
  assert.equal(
    obligationState("10000", "0", null, true, "2026-10-21"),
    "ANULADO",
  );
});
