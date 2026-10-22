/** Explicit local integration runner: creates and removes only its own PostgreSQL container and temp files.
 * Run: node --import tsx src/modules/billing/billing.integration.ts
 * Exercises the current financial behavior through public HTTP with isolated fixtures.
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
    dbName = `uncsm_test_billing_${runId}`,
    containerName = `uncsm-billing-${runId}`;
  const scratch = await mkdtemp(
    path.join(tmpdir(), "uncsm-billing-integration-"),
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
    assert.match(dbName, /^uncsm_test_billing_[a-f0-9]{12}$/);
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
      multipart?: { boundary: string; payload: string },
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
        const payload =
          multipart?.payload ??
          (body === undefined ? "" : JSON.stringify(body));
        socket.push(
          `${method} ${target} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: ${multipart ? `multipart/form-data; boundary=${multipart.boundary}` : "application/json"}\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n${token ? `Authorization: Bearer ${token}\r\n` : ""}\r\n${payload}`,
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

    integrationStage = "billing schema and explicit role fixtures";
    for (const file of [
      "20261021_academic_billing.sql",
      "20261021_billing_payments.sql",
    ]) {
      const sql = await readFile(
        path.join(root, "database/migrations", file),
        "utf8",
      );
      await q(sql);
      await q(sql);
    }
    await q(
      "INSERT INTO permisos(codigo,nombre) VALUES ('COHORTE_GESTIONAR','Cohorts'),('INSCRIPCION_VALIDAR','Admissions'),('PAGO_VALIDAR','Payments') ON CONFLICT(codigo) DO NOTHING",
    );
    await q(
      "INSERT INTO roles_permisos(rol_id,permiso_id) SELECT r.id,p.id FROM roles r,permisos p WHERE (r.nombre='ISSUER' AND p.codigo IN ('COHORTE_GESTIONAR','INSCRIPCION_VALIDAR','PAGO_VALIDAR','PAGO_ANULAR','OBLIGACION_ANULAR')) OR (r.nombre='REVOKER' AND p.codigo='PAGO_VALIDAR') ON CONFLICT DO NOTHING",
    );
    for (const name of ["issuer", "revoker"]) {
      const login = await request("/api/auth/login", "POST", {
        email: `${name}@certificate.test`,
        password: "IsolatedTestPass123",
      });
      assert.equal(login.status, 200);
      tokens[name] = login.body.data.tokens.accessToken;
    }
    const area = await one(
      "INSERT INTO areas_conocimiento(nombre,slug) VALUES ('Billing test','billing-test') RETURNING id",
    );
    const campus = await one(
      "INSERT INTO sedes_ies(codigo_sede,nombre,tipo_sede) VALUES ('BILL','Billing test','SEDE_CENTRAL') RETURNING id",
    );
    const staff = await one(
      "INSERT INTO personal_academico(identificacion,nombres,apellidos,maximo_grado_academico,cv_url) VALUES ('BILL-STAFF','Test','Coordinator','MASTER','/uploads/documentos/cv.pdf') RETURNING id",
    );
    const program = await one(
      "INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,titulo_o_certificado_otorgado) VALUES ('BILL','Diplomado de prueba','billing-program','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,'Test Certificate') RETURNING id",
      [area.id],
    );
    const applicants: any = {};
    for (const name of ["student", "other"])
      applicants[name] = await one(
        "INSERT INTO personas_aspirantes(usuario_id,tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ($1,'PASAPORTE',$2,$3,'Prueba','2000-01-01',$4,'12345678') RETURNING id",
        [users[name], `BILL-${name}`, name, `${name}@certificate.test`],
      );
    let fixtureNumber = 0;
    async function cohort(price = "30000.00", fee = "2000.00", min = 1) {
      return one(
        "INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte,precio_matricula,cupo_minimo,cupo_maximo,estado_cohorte,tiene_excepcion_cupo_setec,excepcion_cupo_setec_url) VALUES($1,$2,'PRESENCIAL',$3,1,$4,current_date-1,current_date+10,current_date+20,current_date+50,$5,$6,$7,20,'INSCRIPCION_ABIERTA',true,'/uploads/cohortes/test-exception.pdf') RETURNING *",
        [
          program.id,
          campus.id,
          `BILL-${++fixtureNumber}`,
          staff.id,
          price,
          fee,
          min,
        ],
      );
    }
    async function enrollment(
      c: any,
      owner = "student",
      state = "EN_REVISION_DOCUMENTAL",
      approved = false,
    ) {
      return one(
        "INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado,fecha_aprobacion_documental) VALUES($1,$2,$3,$4,CASE WHEN $5 THEN now() ELSE NULL END) RETURNING *",
        [
          `BILL-E-${++fixtureNumber}`,
          applicants[owner].id,
          c.id,
          state,
          approved,
        ],
      );
    }
    const bill = (e: any, suffix: string) =>
      `/api/billing/enrollments/${e.id}/${suffix}`;
    const approve = (e: any) =>
      request(
        `/api/enrollments/${e.id}/validate-documents`,
        "PATCH",
        { aprobado: true },
        tokens.issuer,
      );
    const account = async (e: any, token = tokens.student) => {
      const response = await request(
        bill(e, "account"),
        "GET",
        undefined,
        token,
      );
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return response.body.data;
    };
    async function snapshot() {
      const data = [];
      for (const table of [
        "cohortes_apertura",
        "inscripciones",
        "planes_pago_cohorte",
        "cuotas_plan_pago",
        "planes_asignados_inscripcion",
        "acuerdos_pago_inscripcion",
        "obligaciones_pago",
        "pagos_inscripcion",
        "aplicaciones_pago",
        "comprobantes_internos",
        "auditoria_economica",
      ]) {
        const order =
          table === "aplicaciones_pago"
            ? "pago_id,obligacion_id"
            : table === "planes_asignados_inscripcion"
              ? "inscripcion_id"
              : "id";
        data.push(await q(`SELECT * FROM ${table} ORDER BY ${order}`));
      }
      return createHash("sha256").update(JSON.stringify(data)).digest("hex");
    }
    async function rejected(
      target: string,
      method: string,
      payload: any,
      status: number,
      token = tokens.issuer,
    ) {
      const before = await snapshot();
      const response = await request(target, method, payload, token);
      assert.equal(response.status, status, JSON.stringify(response.body));
      assert.equal(
        await snapshot(),
        before,
        "rejected HTTP operation changed persisted data",
      );
    }
    const c = await cohort("30000.00", "2000.00", 2),
      e = await enrollment(c),
      other = await enrollment(c, "other");
    integrationStage = "real student-first discovery and privacy";
    await enrollment(await cohort(), "student");
    await q(
      "INSERT INTO personas_aspirantes(tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ('PASAPORTE','BILL-UNLINKED','Unlinked','Prueba','2000-01-01','unlinked@certificate.test','12345678')",
    );
    const beforeDiscovery = await snapshot();
    assert.equal((await request("/api/billing/students")).status, 401);
    await rejected("/api/billing/students", "GET", undefined, 403, tokens.student);
    for (const query of ["page=0", "limit=51", "page=1.5", `search=${"x".repeat(121)}`]) {
      await rejected(`/api/billing/students?${query}`, "GET", undefined, 400, tokens.revoker);
    }
    for (const search of [" student Prueba ", "BILL-student", e.codigo_expediente]) {
      const found = await request(`/api/billing/students?search=${encodeURIComponent(search)}`, "GET", undefined, tokens.revoker);
      assert.equal(found.status, 200, JSON.stringify(found.body));
      assert.deepEqual(found.body.pagination, { total: 1, page: 1, limit: 10, totalPages: 1 });
      assert.deepEqual(found.body.data, [{ id: applicants.student.id, nombres: "student", apellidos: "Prueba", tipo_identificacion: "PASAPORTE", identificacion_terminacion: "dent" }]);
    }
    const pages = [];
    for (const page of [1, 2, 3]) {
      const found = await request(`/api/billing/students?search=Prueba&page=${page}&limit=1`, "GET", undefined, tokens.issuer);
      assert.equal(found.status, 200, JSON.stringify(found.body));
      assert.deepEqual(found.body.pagination, { total: 2, page, limit: 1, totalPages: 2 });
      pages.push(...found.body.data);
    }
    assert.deepEqual(pages.map(person => person.id), [applicants.other.id, applicants.student.id]);
    assert.deepEqual(pages.map(person => person.identificacion_terminacion), ["ther", "dent"]);
    const excluded = await request("/api/billing/students?search=Unlinked", "GET", undefined, tokens.revoker);
    assert.equal(excluded.status, 200);
    assert.deepEqual(excluded.body.data, []);
    assert.equal(excluded.body.pagination.total, 0);
    assert.equal(await snapshot(), beforeDiscovery, "student discovery changed persisted financial data");
    checks.push("real student-first discovery enforces authentication and permissions, literal name/identifier/expediente search, last-four-only identity, pagination, enrollment-only results and no duplicates across cohorts");
    integrationStage = "cohort price plan and quorum";
    const plan = {
      nombre: "Tres cuotas",
      modalidad: "CUOTAS",
      predeterminado: true,
      monto_matricula: "2000.00",
      precio_academico: "30000.00",
      cuotas: [1, 2, 3].map((n) => ({
        concepto: `Cuota ${n}`,
        importe: "10000.00",
        fecha_vencimiento: n === 1 ? "2020-01-01" : "2099-12-31",
      })),
    };
    const planPath = `/api/billing/cohorts/${c.id}/plans`;
    await rejected(
      planPath,
      "POST",
      { ...plan, cuotas: plan.cuotas.slice(1) },
      400,
    );
    await rejected(planPath, "POST", plan, 403, tokens.revoker);
    let response = await request(planPath, "POST", plan, tokens.issuer);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const planId = response.body.data.id;
    response = await approve(e);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.estado, "INSCRITO_RESERVADO");
    assert.equal(
      (await one("SELECT count(*)::int AS n FROM acuerdos_pago_inscripcion")).n,
      0,
    );
    response = await approve(other);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    let a = await account(e);
    assert.equal(a.resumen.total_comprometido, "32000.00");
    assert.equal(a.resumen.monto_matricula, "2000.00");
    assert.equal(a.resumen.costo_academico, "30000.00");
    assert.equal(a.obligaciones.length, 4);
    assert.equal(a.obligaciones[1].estado, "VENCIDO");
    const ownIds = a.obligaciones.map((row: any) => row.id);
    await rejected(
      `/api/enrollments/${e.id}/validate-documents`,
      "PATCH",
      { aprobado: true },
      400,
    );
    await rejected(bill(e, "account"), "GET", undefined, 403, tokens.other);
    await rejected(
      bill(e, "activate"),
      "POST",
      { motivo: "Unauthorized activation" },
      403,
      tokens.revoker,
    );
    checks.push(
      "quorum creates one immutable fee plus three exact installments for each reserved/approved student; owners and granular roles enforced",
    );
    integrationStage = "transactional collection, allocations and retries";
    function payment(
      key: string,
      reference: string,
      index: number,
      amount: string,
      ids = ownIds,
    ) {
      return {
        clave_idempotencia: key,
        metodo_pago: "CAJA_ADMINISTRATIVA",
        numero_referencia_o_recibo: reference,
        aplicaciones: [{ obligacion_id: ids[index], importe: amount }],
      };
    }
    const collect = (data: any) =>
      request(bill(e, "payments"), "POST", data, tokens.revoker);
    const foreign = (await account(other, tokens.other)).obligaciones[0].id;
    await rejected(
      bill(e, "payments"),
      "POST",
      payment("wrong-owner-key", "WRONG", 0, "1.00", [foreign]),
      400,
      tokens.revoker,
    );
    await rejected(
      bill(e, "payments"),
      "POST",
      payment("negative-amount", "NEGATIVE", 1, "-1.00"),
      400,
      tokens.revoker,
    );
    response = await collect(
      payment("enrollment-fee-1", "FEE-1", 0, "2000.00"),
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    response = await collect(
      payment("partial-payment-1", "PARTIAL-1", 1, "4000.00"),
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const partial = response.body.data;
    const beforeRetry = await snapshot();
    response = await collect(
      payment("partial-payment-1", "PARTIAL-1", 1, "4000.00"),
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.data.pago.id, partial.pago.id);
    assert.equal(response.body.data.comprobante.id, partial.comprobante.id);
    assert.equal(await snapshot(), beforeRetry);
    await rejected(
      bill(e, "payments"),
      "POST",
      payment("partial-payment-1", "PARTIAL-1", 1, "4001.00"),
      409,
      tokens.revoker,
    );
    await rejected(
      bill(e, "payments"),
      "POST",
      payment("different-retry-key", "PARTIAL-1", 1, "4001.00"),
      409,
      tokens.revoker,
    );
    a = await account(e);
    assert.equal(a.obligaciones[1].saldo, "6000.00");
    assert.equal(a.resumen.total_pagado, "6000.00");
    assert.equal(a.resumen.saldo_pendiente, "26000.00");
    assert.equal(a.inscripcion.estado, "PENDIENTE_PAGO");
    const race = await Promise.all([
      collect(payment("concurrent-payment-a", "RACE-A", 1, "6000.00")),
      collect(payment("concurrent-payment-b", "RACE-B", 1, "6000.00")),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    a = await account(e);
    assert.equal(a.obligaciones[1].saldo, "0.00");
    assert.equal(a.obligaciones[1].estado, "PAGADO");
    checks.push(
      "C$4000 abono leaves C$6000; exact retry returns same payment/receipt unchanged; concurrent overpayment has one winner and no negative balance",
    );
    integrationStage = "reported vouchers, approval and manual matriculation";
    const reported = {
      ...payment("student-voucher-1", "VOUCHER-1", 2, "1000.00"),
      metodo_pago: "BAUCHER_BANCARIO",
      monto_subtotal: "1000.00",
      descuento_aplicado: "0.00",
      total_pagado: "1000.00",
      concepto: "Abono a cuota 2",
    };
    response = await request(
      `/api/enrollments/${e.id}/payments`,
      "POST",
      reported,
      tokens.student,
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const voucher = response.body.data;
    a = await account(e);
    assert.equal(a.obligaciones[2].en_revision, "1000.00");
    assert.equal(a.obligaciones[2].pagado, "0.00");
    response = await request(
      `/api/enrollments/payments/${voucher.id}/validate`,
      "PATCH",
      { estado: "APROBADO" },
      tokens.revoker,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.inscripcion.estado, "PENDIENTE_PAGO");
    assert.equal(
      response.body.data.inscripcion.fecha_formalizacion_matricula,
      null,
    );
    response = await request(
      bill(e, "activate"),
      "POST",
      { motivo: "Explicit administrator decision" },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.estado, "MATRICULADO_ACTIVO");
    const activeDate = response.body.data.fecha_formalizacion_matricula;
    response = await collect(
      payment("active-payment-1", "ACTIVE-1", 2, "3000.00"),
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const activePayment = response.body.data;
    a = await account(e);
    assert.equal(a.inscripcion.estado, "MATRICULADO_ACTIVO");
    assert.equal(
      (
        await one(
          "SELECT fecha_formalizacion_matricula FROM inscripciones WHERE id=$1",
          [e.id],
        )
      ).fecha_formalizacion_matricula.toISOString(),
      activeDate,
    );
    checks.push(
      "student pending voucher reserves but does not pay debt; authorized approval issues receipt without matriculating; only administrator activates and active students can continue installments",
    );
    integrationStage = "documents, cancellation, atomic rollback and audit";
    response = await request(
      bill(e, `receipts/${partial.comprobante.id}.pdf`),
      "GET",
      undefined,
      tokens.student,
    );
    assert.equal(response.status, 200);
    assert.equal(response.bytes.subarray(0, 8).toString(), "%PDF-1.4");
    await rejected(
      bill(e, `receipts/${partial.comprobante.id}.pdf`),
      "GET",
      undefined,
      403,
      tokens.other,
    );
    await rejected(
      bill(other, `receipts/${partial.comprobante.id}.pdf`),
      "GET",
      undefined,
      404,
      tokens.issuer,
    );
    await rejected(
      bill(e, `payments/${activePayment.pago.id}/cancel`),
      "POST",
      { motivo: "Unauthorized cancellation" },
      403,
      tokens.revoker,
    );
    const beforeVoid = (await account(e)).obligaciones[2].saldo;
    response = await request(
      bill(e, `payments/${activePayment.pago.id}/cancel`),
      "POST",
      { motivo: "Authorized correction of recorded collection" },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    a = await account(e);
    assert.equal(a.obligaciones[2].saldo, "9000.00");
    assert.equal(
      a.pagos.find((p: any) => p.id === activePayment.pago.id).estado,
      "ANULADO",
    );
    assert.ok(
      a.comprobantes.find((r: any) => r.id === activePayment.comprobante.id)
        .anulado_en,
    );
    await rejected(
      bill(e, `obligations/${ownIds[1]}/cancel`),
      "POST",
      { motivo: "Cannot waive an obligation with payments" },
      409,
    );
    response = await request(
      bill(e, `obligations/${ownIds[3]}/cancel`),
      "POST",
      { motivo: "Explicit authorized cancellation of unused obligation" },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    a = await account(e);
    assert.equal(a.obligaciones[3].estado, "ANULADO");
    assert.equal(a.resumen.importe_anulado, "10000.00");
    const audit = await request(
      bill(e, "audit"),
      "GET",
      undefined,
      tokens.revoker,
    );
    assert.equal(audit.status, 200);
    assert.ok(audit.body.data.some((x: any) => x.accion === "PAGO_ANULADO"));
    assert.ok(
      audit.body.data.some((x: any) => x.accion === "MATRICULA_ACTIVADA"),
    );
    checks.push(
      "protected numbered PDF links, cross-owner isolation, separate cancellation permission, retained void documents and economic audit are verified",
    );
    integrationStage =
      "new versions, alternatives, free cohorts and explicit historical reconciliation";
    response = await request(
      planPath,
      "POST",
      {
        ...plan,
        monto_matricula: "2500.00",
        precio_academico: "36000.00",
        cuotas: plan.cuotas.map((row) => ({ ...row, importe: "12000.00" })),
      },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal((await account(e)).resumen.total_comprometido, "32000.00");
    assert.equal((await account(e)).acuerdo.plan_id, planId);
    const alternative = {
      nombre: "Contado",
      modalidad: "PAGO_UNICO",
      predeterminado: false,
      monto_matricula: "2000.00",
      precio_academico: "30000.00",
      cuotas: [{ concepto: "Costo académico completo", importe: "30000.00" }],
    };
    response = await request(planPath, "POST", alternative, tokens.issuer);
    assert.equal(response.status, 200);
    const alternativeId = response.body.data.id;
    const third = await one(
      "INSERT INTO personas_aspirantes(tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ('PASAPORTE','BILL-THIRD','Third','Fixture','2000-01-01','third@billing.test','12345678') RETURNING id",
    );
    applicants.third = third;
    const e3 = await enrollment(c, "third");
    response = await request(
      bill(e3, "plan"),
      "POST",
      { plan_id: alternativeId },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    response = await approve(e3);
    assert.equal(response.status, 200);
    assert.equal(
      (await account(e3, tokens.issuer)).resumen.total_comprometido,
      "32000.00",
    );
    const cFree = await cohort("0.00", "0.00"),
      eFree = await enrollment(cFree);
    response = await approve(eFree);
    assert.equal(response.status, 200);
    a = await account(eFree);
    assert.equal(a.obligaciones.length, 0);
    assert.equal(a.resumen.total_comprometido, "0.00");
    assert.equal(a.inscripcion.estado, "PENDIENTE_PAGO");
    response = await request(
      bill(eFree, "activate"),
      "POST",
      { motivo: "Administrative activation of free cohort" },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.data.estado, "MATRICULADO_ACTIVO");
    await rejected(
      `/api/enrollments/${eFree.id}/payments`,
      "POST",
      { ...reported, total_pagado: "0.00", monto_subtotal: "0.00" },
      400,
      tokens.student,
    );
    const cLegacy = await cohort("10000.00", "0.00");
    await q("UPDATE cohortes_apertura SET cobro_habilitado=true WHERE id=$1", [
      cLegacy.id,
    ]);
    const eLegacy = await enrollment(
      cLegacy,
      "student",
      "MATRICULADO_ACTIVO",
      true,
    );
    await q(
      "INSERT INTO pagos_inscripcion(inscripcion_id,aspirante_id,metodo_pago,numero_referencia_o_recibo,monto_subtotal,total_pagado,concepto,estado) VALUES($1,$2,'CAJA_ADMINISTRATIVA','LEGACY-4000',4000,4000,'Historical payment','APROBADO')",
      [eLegacy.id, applicants.student.id],
    );
    a = await account(eLegacy);
    assert.equal(a.requiere_conciliacion, true);
    assert.equal(a.resumen.saldo_pendiente, null);
    await rejected(bill(eLegacy, "accept"), "POST", {}, 409);
    response = await request(
      bill(eLegacy, "accept"),
      "POST",
      {
        motivo: "Confirm agreed historical price and credit existing payments",
      },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    a = await account(eLegacy);
    assert.equal(a.requiere_conciliacion, false);
    assert.equal(a.resumen.saldo_pendiente, "6000.00");
    assert.equal(a.resumen.total_pagado, "4000.00");
    const afterReconcile = await snapshot();
    response = await request(
      bill(eLegacy, "accept"),
      "POST",
      {
        motivo: "Confirm agreed historical price and credit existing payments",
      },
      tokens.issuer,
    );
    assert.equal(response.status, 200);
    assert.equal(await snapshot(), afterReconcile);
    checks.push(
      "new tariffs never rewrite accepted obligations; alternative plans, no charges for free cohorts and administrator-only free activation; legacy balances stay unknown until explicit audited reconciliation",
    );
    const dashboard = await request(
      "/api/billing/dashboard",
      "GET",
      undefined,
      tokens.revoker,
    );
    assert.equal(dashboard.status, 200, JSON.stringify(dashboard.body));
    assert.ok(dashboard.body.data.cobros_hoy > 0);
    await rejected(
      "/api/billing/dashboard",
      "GET",
      undefined,
      403,
      tokens.student,
    );

    integrationStage = "independent bounded public-interface probes";
    const moduleOwn = await one(
      "INSERT INTO componentes_curriculares(programa_id,codigo,nombre,horas) VALUES($1,'MOD-OWN','Módulo propio',8) RETURNING id",
      [program.id],
    );
    const programOther = await one(
      "INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,titulo_o_certificado_otorgado) VALUES('OTHER','Programa ajeno','billing-other','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,'Certificado') RETURNING id",
      [area.id],
    );
    const moduleForeign = await one(
      "INSERT INTO componentes_curriculares(programa_id,codigo,nombre,horas) VALUES($1,'MOD-FOREIGN','Módulo ajeno',8) RETURNING id",
      [programOther.id],
    );
    const modulePlan = {
      nombre: "Por módulos",
      modalidad: "MODULOS",
      predeterminado: false,
      monto_matricula: "0.00",
      precio_academico: "10000.00",
      cuotas: [
        {
          concepto: "Módulo de gestión académica",
          importe: "10000.00",
          componente_id: moduleOwn.id,
        },
      ],
    };
    await rejected(
      planPath,
      "POST",
      {
        ...modulePlan,
        cuotas: [{ ...modulePlan.cuotas[0], componente_id: moduleForeign.id }],
      },
      400,
    );
    response = await request(planPath, "POST", modulePlan, tokens.issuer);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.cuotas[0].componente_id, moduleOwn.id);
    await rejected(
      bill(e, "payments"),
      "POST",
      {
        ...payment("duplicate-applications", "DUPLICATE", 2, "1.00"),
        aplicaciones: [
          { obligacion_id: ownIds[2], importe: "1.00" },
          { obligacion_id: ownIds[2], importe: "1.00" },
        ],
      },
      400,
      tokens.revoker,
    );
    await rejected(
      `/api/cohorts/${c.id}`,
      "PUT",
      { precio_matricula: "2501.00" },
      409,
    );
    response = await request(
      `/api/cohorts/${c.id}`,
      "PUT",
      {
        precio_matricula: "2500.00",
        precio_total_cohorte: "36000.00",
        horario_general: "Sábados por la mañana",
      },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const repeatActivation = await snapshot();
    response = await request(
      bill(e, "activate"),
      "POST",
      { motivo: "Repeat explicit administration" },
      tokens.issuer,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.fecha_formalizacion_matricula, activeDate);
    assert.equal(await snapshot(), repeatActivation);
    const rejectable = {
      ...reported,
      clave_idempotencia: "reject-release-probe",
      numero_referencia_o_recibo: "REJECT-PROBE",
      aplicaciones: [{ obligacion_id: ownIds[2], importe: "500.00" }],
      total_pagado: "500.00",
      monto_subtotal: "500.00",
    };
    response = await request(
      `/api/enrollments/${e.id}/payments`,
      "POST",
      rejectable,
      tokens.student,
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal((await account(e)).obligaciones[2].en_revision, "500.00");
    const rejectId = response.body.data.id;
    response = await request(
      `/api/enrollments/payments/${rejectId}/validate`,
      "PATCH",
      {
        estado: "RECHAZADO",
        motivo_rechazo: "Comprobante inconsistente de prueba",
      },
      tokens.revoker,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    a = await account(e);
    assert.equal(a.obligaciones[2].en_revision, "0.00");
    assert.equal(a.obligaciones[2].saldo, "9000.00");
    assert.equal(a.inscripcion.estado, "MATRICULADO_ACTIVO");
    assert.equal(
      (
        await one(
          "SELECT fecha_formalizacion_matricula FROM inscripciones WHERE id=$1",
          [e.id],
        )
      ).fecha_formalizacion_matricula.toISOString(),
      activeDate,
    );
    const otherAccount = await account(other, tokens.other);
    response = await request(
      `/api/enrollments/${other.id}/payments`,
      "POST",
      {
        ...rejectable,
        clave_idempotencia: "nonactive-rejection-probe",
        numero_referencia_o_recibo: "NONACTIVE-REJECT",
        aplicaciones: [
          { obligacion_id: otherAccount.obligaciones[1].id, importe: "500.00" },
        ],
      },
      tokens.other,
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const nonactivePayment = response.body.data.id;
    response = await request(
      `/api/enrollments/payments/${nonactivePayment}/validate`,
      "PATCH",
      { estado: "RECHAZADO", motivo_rechazo: "Comprobante ilegible de prueba" },
      tokens.revoker,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(
      response.body.data.inscripcion.observaciones_administracion,
      "Comprobante ilegible de prueba",
    );
    assert.equal(
      (
        await one(
          "SELECT observaciones_administracion FROM inscripciones WHERE id=$1",
          [other.id],
        )
      ).observaciones_administracion,
      "Comprobante ilegible de prueba",
    );
    response = await request(
      `/api/enrollments/${other.id}/payments`,
      "POST",
      {
        ...rejectable,
        clave_idempotencia: "nonactive-default-rejection",
        numero_referencia_o_recibo: "NONACTIVE-DEFAULT",
        aplicaciones: [
          { obligacion_id: otherAccount.obligaciones[1].id, importe: "500.00" },
        ],
      },
      tokens.other,
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    response = await request(
      `/api/enrollments/payments/${response.body.data.id}/validate`,
      "PATCH",
      { estado: "RECHAZADO" },
      tokens.revoker,
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(
      response.body.data.inscripcion.observaciones_administracion,
      "Comprobante de pago rechazado por tesorería",
    );
    assert.equal(
      (
        await one(
          "SELECT observaciones_administracion FROM inscripciones WHERE id=$1",
          [other.id],
        )
      ).observaciones_administracion,
      "Comprobante de pago rechazado por tesorería",
    );
    const uploadData = {
      ...rejectable,
      clave_idempotencia: "attachment-content-probe",
      numero_referencia_o_recibo: "ATTACH-PROBE",
    };
    async function attachment(content: string) {
      const boundary = "BoundedVerifyMultipart";
      const fields = Object.entries(uploadData)
        .map(
          ([key, value]) =>
            `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${typeof value === "object" ? JSON.stringify(value) : value}\r\n`,
        )
        .join("");
      const payload =
        fields +
        `--${boundary}\r\nContent-Disposition: form-data; name="comprobante_baucher"; filename="voucher.pdf"\r\nContent-Type: application/pdf\r\n\r\n${content}\r\n--${boundary}--\r\n`;
      return request(
        `/api/enrollments/${e.id}/payments`,
        "POST",
        undefined,
        tokens.student,
        { boundary, payload },
      );
    }
    response = await attachment("%PDF-1.4 synthetic voucher one");
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const attachmentPayment = response.body.data.id,
      beforeAttachmentRetry = await snapshot();
    response = await attachment("%PDF-1.4 synthetic voucher one");
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.data.id, attachmentPayment);
    assert.equal(await snapshot(), beforeAttachmentRetry);
    response = await attachment("%PDF-1.4 synthetic voucher changed");
    assert.equal(response.status, 409, JSON.stringify(response.body));
    assert.equal(await snapshot(), beforeAttachmentRetry);
    checks.push(
      "independent probes: real/foreign module ownership, duplicate applications rejected without writes, cohort reference price drift blocked and ordinary schedule preserved, idempotent activation date/data, rejected voucher reservation release, identical attachment retry and changed attachment conflict",
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
    `Billing integration failed at ${integrationStage}: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
