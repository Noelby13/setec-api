/** Explicit local integration runner: creates and removes only its own PostgreSQL container and temp files.
 * Run: node --import tsx src/modules/enrollments/enrollment.integration.ts
 * Baseline compatibility was independently checked; this retained runner tests current isolated behavior.
 * Requires an already available postgres:16-alpine image; never pulls images or reads project .env.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { Duplex } from "node:stream";

let integrationStage = "initialization";
async function main() {
  const root = path.resolve(__dirname, "../../..");
  const runId = randomBytes(6).toString("hex"),
    dbName = `uncsm_test_transition_${runId}`,
    containerName = `uncsm-transition-${runId}`;
  const scratch = await mkdtemp(
    path.join(tmpdir(), "uncsm-transition-integration-"),
  );
  const password = randomBytes(24).toString("hex");
  let containerCreated = false,
    pool: any;
  const checks: string[] = [];
  function docker(args: string[]): string {
    const result = spawnSync(
      "/usr/local/bin/docker",
      ["--host", "unix:///var/run/docker.sock", ...args],
      { encoding: "utf8", timeout: 30000 },
    );
    if (result.status !== 0)
      throw new Error(
        `Isolated Docker operation failed (${args[0]}): ${result.stderr.trim() || "unavailable"}`,
      );
    return result.stdout.trim();
  }
  try {
    const schema = await readFile(
      path.join(root, "database/schema.sql"),
      "utf8",
    );
    const migration = await readFile(
      path.join(root, "database/migrations/20261021_certificate_registry.sql"),
      "utf8",
    );
    docker([
      "run",
      "--pull=never",
      "--rm",
      "-d",
      "--name",
      containerName,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      `POSTGRES_DB=${dbName}`,
      "-p",
      "127.0.0.1::5432",
      "postgres:16-alpine",
    ]);
    containerCreated = true;
    const port = Number(
      docker(["port", containerName, "5432/tcp"]).split(":").at(-1),
    );
    assert.ok(Number.isInteger(port) && port > 0);
    for (let attempt = 0; attempt < 50; attempt++) {
      const ready = spawnSync(
        "/usr/local/bin/docker",
        [
          "--host",
          "unix:///var/run/docker.sock",
          "exec",
          containerName,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
          "-d",
          dbName,
        ],
        { encoding: "utf8" },
      );
      if (ready.status === 0) break;
      if (attempt === 49)
        throw new Error("Isolated PostgreSQL did not become ready");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    Object.assign(process.env, {
      DB_HOST: "127.0.0.1",
      DB_PORT: String(port),
      DB_USER: "postgres",
      DB_PASSWORD: password,
      DB_NAME: dbName,
      JWT_SECRET: randomBytes(32).toString("hex"),
      JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
      NODE_ENV: "test",
    });
    process.chdir(scratch);
    const dbModule = await import(
      pathToFileURL(path.join(root, "src/db/pool.ts")).href
    );
    pool = dbModule.pool;
    const q = async (sql: string, params: unknown[] = []) =>
      (await pool.query(sql, params)).rows;
    const one = async (sql: string, params: unknown[] = []) =>
      (await q(sql, params))[0];
    assert.equal((await one("SELECT current_database() AS name")).name, dbName);
    assert.match(dbName, /^uncsm_test_transition_[a-f0-9]{12}$/);
    integrationStage = "initial schema";
    await q(
      schema.split(
        "-- Technical registry of existing institutional documents; no automatic issuance.",
      )[0],
    );
    await q(
      "INSERT INTO roles(nombre) VALUES ('ESTUDIANTE'),('SUPER_ADMIN'),('ISSUER'),('REVOKER')",
    );
    await q(
      "INSERT INTO permisos(codigo,nombre) VALUES ('TITULO_EMITIR','Issue')",
    );
    await q(
      "INSERT INTO roles_permisos(rol_id,permiso_id) SELECT r.id,p.id FROM roles r,permisos p WHERE r.nombre='ISSUER' AND p.codigo='TITULO_EMITIR'",
    );
    const { app } = await import(
      pathToFileURL(path.join(root, "src/app.ts")).href
    );
    async function request(
      target: string,
      method = "GET",
      body?: unknown,
      token?: string,
    ): Promise<any> {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [],
          socket = new Duplex({
            read() {},
            write(chunk, _enc, done) {
              chunks.push(Buffer.from(chunk));
              done();
            },
          });
        socket.on("error", reject);
        socket.on("finish", () => {
          const raw = Buffer.concat(chunks),
            split = raw.indexOf("\r\n\r\n"),
            header = raw.subarray(0, split).toString(),
            bytes = raw.subarray(split + 4);
          try {
            resolve({
              status: Number(header.split(" ")[1]),
              bytes,
              body: header.includes("application/json")
                ? JSON.parse(bytes.toString())
                : null,
            });
          } catch (error) {
            reject(error);
          }
        });
        createServer(app).emit("connection", socket);
        const payload = body === undefined ? "" : JSON.stringify(body);
        socket.push(
          `${method} ${target} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n${token ? `Authorization: Bearer ${token}\r\n` : ""}\r\n${payload}`,
        );
      });
    }
    integrationStage = "account fixtures";
    const users: any = {},
      tokens: any = {};
    for (const [name, role] of [
      ["student", "ESTUDIANTE"],
      ["other", "ESTUDIANTE"],
      ["issuer", "ISSUER"],
      ["revoker", "REVOKER"],
    ]) {
      let response = await request("/api/auth/register", "POST", {
        email: `${name}@certificate.test`,
        password: "IsolatedTestPass123",
        nombres: name,
        apellidos: "Test",
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      users[name] = response.body.data.id;
      if (role !== "ESTUDIANTE")
        await q(
          "UPDATE usuarios SET rol_id=(SELECT id FROM roles WHERE nombre=$1) WHERE id=$2",
          [role, users[name]],
        );
      response = await request("/api/auth/login", "POST", {
        email: `${name}@certificate.test`,
        password: "IsolatedTestPass123",
      });
      assert.equal(response.status, 200);
      tokens[name] = response.body.data.tokens.accessToken;
    }
    integrationStage = "academic fixtures";
    const area = await one(
      "INSERT INTO areas_conocimiento(nombre,slug) VALUES ('Certificate test','certificate-test') RETURNING id",
    );
    const campus = await one(
      "INSERT INTO sedes_ies(codigo_sede,nombre,tipo_sede) VALUES ('CERT','Certificate test','SEDE_CENTRAL') RETURNING id",
    );
    const staff = await one(
      "INSERT INTO personal_academico(identificacion,nombres,apellidos,maximo_grado_academico,cv_url) VALUES ('CERT-STAFF','Test','Coordinator','MASTER','/uploads/documentos/cv.pdf') RETURNING id",
    );
    const program = await one(
      "INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,titulo_o_certificado_otorgado,visible_en_web) VALUES ('CERT','Immutable test program','certificate-program','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,'Test Certificate',true) RETURNING id",
      [area.id],
    );
    const applicant = await one(
      "INSERT INTO personas_aspirantes(usuario_id,tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ($1,'PASAPORTE','CERT-OWNER','Original','Recipient','2000-01-01','student@certificate.test','12345678') RETURNING id",
      [users.student],
    );
    const dossiers: any[] = [];
    for (let index = 0; index < 2; index++) {
      const cohort = await one(
        "INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte,estado_cohorte) VALUES ($1,$2,'PRESENCIAL',$3,1,$4,current_date-10,current_date-5,current_date-4,current_date-1,0,'FINALIZADA_PENDIENTE_EVAL') RETURNING id",
        [program.id, campus.id, `CERT-${index}`, staff.id],
      );
      const enrollment = await one(
        "INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES ($1,$2,$3,'EGRESADO') RETURNING id",
        [`CERT-${index}`, applicant.id, cohort.id],
      );
      dossiers.push(
        await one(
          "INSERT INTO expediente_graduacion_certificacion(inscripcion_id,tipo_documento_final,fecha_emision,codigo_registro_titulo_emitido,documento_final_url) VALUES ($1,'CERTIFICADO_APROBACION',$2,$3,$4) RETURNING *",
          [
            enrollment.id,
            index === 0 ? "2025-06-10" : null,
            index === 0 ? "CERT-LEGACY" : null,
            "/uploads/documentos/fixture.pdf",
          ],
        ),
      );
    }

    integrationStage = "independent transition fixtures";
    await q(
      "INSERT INTO permisos(codigo,nombre) VALUES ('INSCRIPCION_VALIDAR','Admissions'),('PAGO_VALIDAR','Payments')",
    );
    await q(
      "INSERT INTO roles_permisos(rol_id,permiso_id) SELECT r.id,p.id FROM roles r,permisos p WHERE r.nombre='ISSUER' AND p.codigo IN ('INSCRIPCION_VALIDAR','PAGO_VALIDAR')",
    );
    const secondApplicant = await one(
      "INSERT INTO personas_aspirantes(usuario_id,tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ($1,'PASAPORTE','OTHER-OWNER','Other','Recipient','2000-01-01','other@certificate.test','12345678') RETURNING id",
      [users.other],
    );
    let serial = 0;
    async function fixture(
      state = "EN_REVISION_DOCUMENTAL",
      options: any = {},
    ) {
      const n = ++serial;
      const c = await one(
        "INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte,cupo_minimo,cupo_maximo,cupos_actuales_verificados,cobro_habilitado,estado_cohorte) VALUES ($1,$2,'PRESENCIAL',$3,1,$4,current_date-1,current_date+10,current_date+15,current_date+20,10,$5,$6,$7,$8,$9) RETURNING *",
        [
          program.id,
          campus.id,
          "TRANSITION-" + n,
          staff.id,
          options.min ?? 1,
          options.max ?? 30,
          options.count ?? 0,
          options.pay ?? false,
          options.cohortState ?? "INSCRIPCION_ABIERTA",
        ],
      );
      const e = await one(
        "INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado,fecha_aprobacion_documental,fecha_formalizacion_matricula) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          "TRANSITION-" + n,
          applicant.id,
          c.id,
          state,
          options.approved ? "2026-01-01" : null,
          state === "MATRICULADO_ACTIVO" ? "2026-01-02" : null,
        ],
      );
      return { c, e };
    }
    const snapshot = async () =>
      createHash("sha256")
        .update(
          JSON.stringify(
            await Promise.all(
              ["cohortes_apertura", "inscripciones", "pagos_inscripcion"].map(
                (t) => q(`SELECT row_to_json(t) FROM ${t} t ORDER BY id`),
              ),
            ),
          ),
        )
        .digest("hex");
    async function rejected(
      target: string,
      method: string,
      body: any,
      status: number,
      actor = tokens.issuer,
    ) {
      const before = await snapshot();
      const r = await request(target, method, body, actor);
      assert.equal(r.status, status, JSON.stringify(r.body));
      assert.equal(
        await snapshot(),
        before,
        "Rejected transition mutated data",
      );
    }
    const doc = (e: any) => `/api/enrollments/${e.id}/validate-documents`;
    const receiptBody = (ref: string) => ({
      metodo_pago: "CAJA_ADMINISTRATIVA",
      numero_referencia_o_recibo: ref,
      monto_subtotal: 10,
      total_pagado: 10,
      concepto: "Isolated transition test",
    });
    const race = await fixture("EN_REVISION_DOCUMENTAL", { min: 2 });
    const approvals = await Promise.all([
      request(doc(race.e), "PATCH", { aprobado: true }, tokens.issuer),
      request(doc(race.e), "PATCH", { aprobado: true }, tokens.issuer),
    ]);
    assert.deepEqual(approvals.map((r) => r.status).sort(), [200, 400]);
    assert.equal(
      (
        await one(
          "SELECT cupos_actuales_verificados FROM cohortes_apertura WHERE id=$1",
          [race.c.id],
        )
      ).cupos_actuales_verificados,
      1,
    );
    for (const state of [
      "MATRICULADO_ACTIVO",
      "EGRESADO",
      "GRADUADO_O_CERTIFICADO",
      "RETIRADO",
      "PENDIENTE_COMITE_PONENCIA",
      "LISTA_ESPERA",
    ]) {
      const f = await fixture(state, { approved: true, pay: true });
      await rejected(doc(f.e), "PATCH", { aprobado: false }, 409);
      if (state !== "MATRICULADO_ACTIVO")
        await rejected(doc(f.e), "PATCH", { aprobado: true }, 409);
    }
    const full = await fixture("EN_REVISION_DOCUMENTAL", { max: 1, count: 1 });
    await rejected(doc(full.e), "PATCH", { aprobado: true }, 409);
    for (const state of [
      "CANCELADA",
      "FINALIZADA_PENDIENTE_EVAL",
      "EVALUADA_SETEC",
    ]) {
      const f = await fixture("PENDIENTE_PAGO", {
        cohortState: state,
        pay: true,
        approved: true,
      });
      await rejected(doc(f.e), "PATCH", { aprobado: false }, 409);
      await rejected(
        `/api/enrollments/${f.e.id}/payments`,
        "POST",
        receiptBody("CLOSED"),
        409,
        tokens.student,
      );
    }
    checks.push(
      "concurrent document approval once; finalized/withdrawn/committee/waitlist/full/closed transitions reject without changes",
    );
    integrationStage = "normal observation approval quorum and receipt flow";
    const normal = await fixture("EN_REVISION_DOCUMENTAL", { min: 2 });
    // Two C$10 pending vouchers must reserve distinct capacity within the agreed C$20 price.
    await q("UPDATE cohortes_apertura SET precio_total_cohorte=20 WHERE id=$1", [normal.c.id]);
    let response = await request(
      doc(normal.e),
      "PATCH",
      {
        aprobado: false,
        observaciones_administracion: "Test missing document",
      },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.data.estado, "DOCUMENTACION_OBSERVADA");
    response = await request(
      doc(normal.e),
      "PATCH",
      { aprobado: true },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.data.estado, "INSCRITO_RESERVADO");
    const normalShape = {
      envelope: Object.keys(response.body).sort(),
      data: Object.keys(response.body.data).sort(),
    };
    const second = await one(
      "INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id) VALUES ('SECOND-NORMAL',$1,$2) RETURNING *",
      [secondApplicant.id, normal.c.id],
    );
    response = await request(
      doc(second),
      "PATCH",
      { aprobado: true },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.data.estado, "PENDIENTE_PAGO");
    assert.equal(
      (await one("SELECT estado FROM inscripciones WHERE id=$1", [normal.e.id]))
        .estado,
      "PENDIENTE_PAGO",
    );
    assert.equal(
      (
        await one(
          "SELECT cupos_actuales_verificados FROM cohortes_apertura WHERE id=$1",
          [normal.c.id],
        )
      ).cupos_actuales_verificados,
      2,
    );
    response = await request(
      `/api/enrollments/${normal.e.id}/payments`,
      "POST",
      receiptBody("NORMAL-1"),
      tokens.student,
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const pay1 = response.body.data;
    response = await request(
      `/api/enrollments/${normal.e.id}/payments`,
      "POST",
      receiptBody("NORMAL-2"),
      tokens.student,
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const pay2 = response.body.data;
    response = await request(
      `/api/enrollments/payments/${pay1.id}/validate`,
      "PATCH",
      { estado: "APROBADO" },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.data.inscripcion.estado, "PAGO_EN_REVISION");
    assert.equal(response.body.data.inscripcion.fecha_formalizacion_matricula, null);
    response = await request(
      `/api/billing/enrollments/${normal.e.id}/activate`,
      "POST",
      { motivo: "Explicit administrator activation in isolated transition test" },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.estado, "MATRICULADO_ACTIVO");
    const formalized = (
      await one(
        "SELECT fecha_formalizacion_matricula FROM inscripciones WHERE id=$1",
        [normal.e.id],
      )
    ).fecha_formalizacion_matricula.toISOString();
    response = await request(
      `/api/enrollments/payments/${pay2.id}/validate`,
      "PATCH",
      { estado: "RECHAZADO", motivo_rechazo: "Duplicate receipt" },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    const after = await one(
      "SELECT estado,fecha_formalizacion_matricula FROM inscripciones WHERE id=$1",
      [normal.e.id],
    );
    assert.equal(after.estado, "MATRICULADO_ACTIVO");
    assert.equal(after.fecha_formalizacion_matricula.toISOString(), formalized);
    checks.push(
      "normal observation/reservation/quorum/payment succeeds without automatic activation; administrator activates explicitly; rejecting extra reserved receipt preserves matriculation and exact date",
    );
    integrationStage = "receipt concurrency and prerequisite restrictions";
    const paymentRace = await fixture("PENDIENTE_PAGO", {
      pay: true,
      approved: true,
      count: 1,
    });
    response = await request(
      `/api/enrollments/${paymentRace.e.id}/payments`,
      "POST",
      receiptBody("RACE"),
      tokens.student,
    );
    assert.equal(response.status, 201);
    const raceReceipt = response.body.data;
    const decisions = await Promise.all([
      request(
        `/api/enrollments/payments/${raceReceipt.id}/validate`,
        "PATCH",
        { estado: "APROBADO" },
        tokens.issuer,
      ),
      request(
        `/api/enrollments/payments/${raceReceipt.id}/validate`,
        "PATCH",
        { estado: "RECHAZADO", motivo_rechazo: "Race" },
        tokens.issuer,
      ),
    ]);
    assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 400]);
    const storedReceipt = await one(
      "SELECT estado FROM pagos_inscripcion WHERE id=$1",
      [raceReceipt.id],
    );
    const storedEnrollment = await one(
      "SELECT estado,fecha_formalizacion_matricula FROM inscripciones WHERE id=$1",
      [paymentRace.e.id],
    );
    assert.ok(["APROBADO", "RECHAZADO"].includes(storedReceipt.estado));
    assert.equal(storedEnrollment.estado, "PENDIENTE_PAGO");
    assert.equal(storedEnrollment.fecha_formalizacion_matricula, null);
    for (const [approved, pay, status] of [
      [false, true, 409],
      [true, false, 400],
    ]) {
      const f = await fixture("PENDIENTE_PAGO", { approved, pay });
      await rejected(
        `/api/enrollments/${f.e.id}/payments`,
        "POST",
        receiptBody("NO-PREREQUISITE"),
        status as number,
        tokens.student,
      );
    }
    for (const state of ["RETIRADO", "EGRESADO", "GRADUADO_O_CERTIFICADO"]) {
      const f = await fixture(state, { approved: true, pay: true });
      const p = await one(
        "INSERT INTO pagos_inscripcion(inscripcion_id,aspirante_id,metodo_pago,numero_referencia_o_recibo,monto_subtotal,total_pagado,concepto) VALUES ($1,$2,'CAJA_ADMINISTRATIVA','PENDING',10,10,'Test') RETURNING id",
        [f.e.id, applicant.id],
      );
      await rejected(
        `/api/enrollments/payments/${p.id}/validate`,
        "PATCH",
        { estado: "APROBADO" },
        409,
      );
      await rejected(
        `/api/enrollments/${f.e.id}/payments`,
        "POST",
        receiptBody("NO-REACTIVATE"),
        400,
        tokens.student,
      );
    }
    checks.push(
      "simultaneous receipt approval/rejection has one decision and coherent state; own approval/quorum required; finished accounts cannot reactivate",
    );
    integrationStage = "explicit documentary decision validation";
    const invalidFixture = await fixture();
    for (const value of ["unexpected", "", null, 1, 0, {}, []]) {
      const before = await snapshot();
      const result = await request(
        doc(invalidFixture.e),
        "PATCH",
        { aprobado: value },
        tokens.issuer,
      );
      assert.equal(result.status, 400, JSON.stringify(result.body));
      assert.ok(
        result.body.errors.some((error: any) => error.field === "aprobado"),
      );
      assert.equal(await snapshot(), before);
    }
    for (const [value, expected] of [
      [false, "DOCUMENTACION_OBSERVADA"],
      ["false", "DOCUMENTACION_OBSERVADA"],
      ["0", "DOCUMENTACION_OBSERVADA"],
      [true, "PENDIENTE_PAGO"],
      ["true", "PENDIENTE_PAGO"],
      ["1", "PENDIENTE_PAGO"],
      [undefined, "PENDIENTE_PAGO"],
      [" TRUE ", "PENDIENTE_PAGO"],
    ]) {
      const f = await fixture();
      const result = await request(
        doc(f.e),
        "PATCH",
        { aprobado: value },
        tokens.issuer,
      );
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.data.estado, expected);
      const stored = await one(
        "SELECT cupos_actuales_verificados,cobro_habilitado FROM cohortes_apertura WHERE id=$1",
        [f.c.id],
      );
      assert.equal(
        stored.cupos_actuales_verificados,
        expected === "PENDIENTE_PAGO" ? 1 : 0,
      );
      assert.equal(stored.cobro_habilitado, expected === "PENDIENTE_PAGO");
    }
    checks.push(
      "malformed documentary values return400 without changes; valid booleans/multipart strings and omission preserve existing outcomes",
    );
    console.log(JSON.stringify({ complete: true, checks }, null, 2));
  } finally {
    try {
      if (pool) await pool.end();
    } finally {
      process.chdir(root);
      try {
        if (containerCreated) docker(["stop", "-t", "1", containerName]);
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    }
  }
}
main().catch((error) => {
  console.error(
    `Transition integration failed at ${integrationStage}: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
