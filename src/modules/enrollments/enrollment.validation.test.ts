import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import express from "express";
import { httpRequest } from "../../testing/http";
import { errorHandler } from "../../middlewares/error.middleware";
import { validateSchema } from "../../middlewares/validate.middleware";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";
import { validateDocumentsSchema } from "./enrollment.schema";

afterEach(() => mock.restoreAll());
function fixture() {
  const persisted = { estado: "EN_REVISION_DOCUMENTAL" };
  const decision = mock.method(
    EnrollmentService,
    "validateDocuments",
    async (_id: string, body: any) => {
      persisted.estado = body.aprobado
        ? "PENDIENTE_PAGO"
        : "DOCUMENTACION_OBSERVADA";
      return { ...persisted } as any;
    },
  );
  const app = express();
  app.use(express.json());
  app.patch(
    "/:id",
    validateSchema({ body: validateDocumentsSchema }),
    EnrollmentController.validateDocuments,
  );
  app.use(errorHandler);
  return { app, persisted, decision };
}
test("malformed documentary booleans fail validation before any decision or persisted change", async () => {
  const f = fixture(),
    before = JSON.stringify(f.persisted);
  for (const aprobado of ["unexpected", "", null, 1, 0, {}, []]) {
    const response = await httpRequest(f.app, "/application", "PATCH", {
      aprobado,
    });
    assert.equal(response.status, 400, JSON.stringify(aprobado));
    assert.equal(response.body.success, false);
    assert.ok(
      response.body.errors.some((error: any) => error.field === "aprobado"),
    );
    assert.equal(f.decision.mock.callCount(), 0);
    assert.equal(JSON.stringify(f.persisted), before);
  }
});
test("JSON/multipart booleans and the existing omitted-decision default retain their behavior", async () => {
  const f = fixture();
  for (const [value, expected] of [
    [true, true],
    [false, false],
    ["true", true],
    ["false", false],
    ["1", true],
    ["0", false],
    [undefined, true],
  ]) {
    const response = await httpRequest(f.app, "/application", "PATCH", {
      aprobado: value,
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.estado,
      expected ? "PENDIENTE_PAGO" : "DOCUMENTACION_OBSERVADA",
    );
    assert.equal(f.decision.mock.calls.at(-1)!.arguments[1].aprobado, expected);
  }
});
