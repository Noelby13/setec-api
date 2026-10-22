import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import express from "express";
import { pool } from "../../db/pool";
import { CohortDao } from "../cohorts/cohort.dao";
import { CohortController } from "../cohorts/cohort.controller";
import { errorHandler } from "../../middlewares/error.middleware";
import { httpRequest } from "../../testing/http";
afterEach(() => mock.restoreAll());
function fixture() {
  const current: any = {
    id: "11111111-1111-4111-8111-111111111111",
    programa_id: "program",
    precio_matricula: "2000.00",
    precio_total_cohorte: "30000.00",
    modalidad: "PRESENCIAL",
    cupo_minimo: 15,
    cupo_maximo: 30,
    tiene_excepcion_cupo_setec: false,
    es_ciencias_salud: false,
  };
  mock.method(CohortDao, "findCohorteById", async () => ({ ...current }));
  const update = mock.method(
    CohortDao,
    "updateCohorte",
    async (_id: string, data: any) => Object.assign(current, data),
  );
  const query = async (sql: string) => ({
    rows: sql.includes("planes_pago_cohorte")
      ? [{ id: "plan" }]
      : [{ id: current.id }],
  });
  mock.method(pool, "query", query);
  mock.method(pool, "connect", async () => ({ query, release() {} }) as any);
  const app = express();
  app.use(express.json());
  app.put("/cohorts/:id", CohortController.updateCohorte);
  app.use(errorHandler);
  return { app, current, update };
}
test("published cohort prices change through a new plan rather than drifting from its default offer", async () => {
  const f = fixture(),
    before = JSON.stringify(f.current);
  const response = await httpRequest(f.app, `/cohorts/${f.current.id}`, "PUT", {
    precio_total_cohorte: 35000,
  });
  assert.equal(response.status, 409);
  assert.equal(JSON.stringify(f.current), before);
  assert.equal(f.update.mock.callCount(), 0);
});
test("ordinary cohort schedule edits and unchanged price fields remain available with a plan", async () => {
  const f = fixture();
  const response = await httpRequest(f.app, `/cohorts/${f.current.id}`, "PUT", {
    horario_general: "Saturday",
    precio_total_cohorte: 30000,
    precio_matricula: 2000,
  });
  assert.equal(response.status, 200);
  assert.equal(f.current.horario_general, "Saturday");
});
