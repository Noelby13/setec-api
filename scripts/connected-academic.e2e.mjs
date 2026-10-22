/** Real connected local probe. Run: npm run test:connected (from the API repository)
 * Creates only its own postgres:16-alpine container, uncsm_test DB and ephemeral loopback servers.
 * No API interception, configured .env, installs, production data or official PDF template.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  cp,
  mkdtemp,
  readFile,
  writeFile,
  symlink,
  stat,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
const source = path.resolve(process.argv[2] || "");
assert.ok(process.argv[2], "Pass the V1 root explicitly.");
const runId = randomBytes(6).toString("hex");
const scratch = await mkdtemp(path.join(tmpdir(), "uncsm-connected-academic-"));
const names = ["POSGRADOSETECAPI", "setecweb", "setecportal"];
const roots = Object.fromEntries(
  names.map((name) => [name, path.join(scratch, name)]),
);
const container = `uncsm-ui-e2e-${runId}`;
const dbName = `uncsm_test_${runId}`;
const dbPassword = randomBytes(24).toString("hex");
const password = `Isolated-${randomBytes(10).toString("hex")}!`;
const report = {
  scratch,
  baseline: Object.fromEntries(
    names.map((name) => {
      const result = spawnSync("git", ["rev-parse", "HEAD"], {
        cwd: path.join(source, name),
        encoding: "utf8",
      });
      return [name, result.status === 0 ? result.stdout.trim() : "uncommitted"];
    }),
  ),
  mockHttp: false,
  steps: [],
  fixtures: [],
  screenshots: [],
  pageErrors: [],
  httpErrors: [],
  cleanup: {},
};
const servers = [];
let containerCreated = false,
  pool,
  browser;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function docker(args) {
  const result = spawnSync(
    "/usr/local/bin/docker",
    ["--host", "unix:///var/run/docker.sock", ...args],
    { encoding: "utf8", timeout: 30000 },
  );
  if (result.status !== 0)
    throw new Error(`Owned Docker ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}
function build(name, env = {}) {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: roots[name],
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 60000,
  });
  return writeFile(
    path.join(scratch, `build-${name}.log`),
    result.stdout + result.stderr,
  ).then(() => {
    assert.equal(
      result.status,
      0,
      `${name} build failed; see retained build log`,
    );
  });
}
async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
async function staticApp(root) {
  const dist = path.join(root, "dist");
  return listen(
    createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(
          new URL(request.url, "http://localhost").pathname,
        );
        let target = path.resolve(dist, "." + pathname);
        if (!target.startsWith(dist + path.sep) && target !== dist) {
          response.writeHead(403);
          response.end();
          return;
        }
        try {
          if (!(await stat(target)).isFile())
            target = path.join(dist, "index.html");
        } catch {
          target = path.join(dist, "index.html");
        }
        const mime = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".woff": "font/woff",
          ".woff2": "font/woff2",
          ".svg": "image/svg+xml",
          ".png": "image/png",
        };
        response.setHeader(
          "Content-Type",
          mime[path.extname(target)] || "application/octet-stream",
        );
        response.end(await readFile(target));
      } catch {
        response.writeHead(500);
        response.end();
      }
    }),
  );
}
async function screenshot(page, name) {
  const target = path.join(scratch, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  report.screenshots.push(target);
}
async function step(name, action, page) {
  try {
    const value = await action();
    report.steps.push({ name, passed: true });
    console.log(`PASS ${name}`);
    return value === undefined ? true : value;
  } catch (error) {
    const item = { name, passed: false, error: error.message.slice(0, 1800) };
    if (page) {
      item.visibleText = (
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(0, 2000);
      await screenshot(page, `failed-${report.steps.length}`).catch(() => {});
    }
    report.steps.push(item);
    console.log(`FAIL ${name}: ${error.message.slice(0, 250)}`);
    return false;
  }
}
async function main() {
  console.log(`SCRATCH ${scratch}`);
  for (const name of names) {
    await cp(path.join(source, name), roots[name], {
      recursive: true,
      filter: (candidate) =>
        ![
          "node_modules",
          ".git",
          "dist",
          "uploads",
          "test-results",
          "playwright-report",
          "coverage",
        ].includes(path.basename(candidate)) &&
        !path.basename(candidate).startsWith(".env"),
    });
    await symlink(
      path.join(source, name, "node_modules"),
      path.join(roots[name], "node_modules"),
      "dir",
    );
  }
  report.sourceHashes = {};
  for (const [name, file] of [
    ["POSGRADOSETECAPI", "src/modules/enrollments/enrollment.service.ts"],
    ["setecweb", "src/features/admissions/CashierPage.jsx"],
    ["setecweb", "src/features/billing/AccountPanel.jsx"],
    ["setecweb", "src/features/billing/PaymentPlansDialog.jsx"],
    ["setecportal", "src/pages/Student.jsx"],
    ["setecportal", "src/pages/StudentAccount.jsx"],
  ])
    report.sourceHashes[`${name}/${file}`] = hash(
      await readFile(path.join(roots[name], file)),
    );
  docker(["image", "inspect", "postgres:16-alpine", "--format", "{{.Id}}"]);
  docker([
    "run",
    "--pull=never",
    "--rm",
    "-d",
    "--name",
    container,
    "-e",
    `POSTGRES_PASSWORD=${dbPassword}`,
    "-e",
    `POSTGRES_DB=${dbName}`,
    "-p",
    "127.0.0.1::5432",
    "postgres:16-alpine",
  ]);
  containerCreated = true;
  const dbPort = docker(["port", container, "5432/tcp"]).split(":").at(-1);
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = spawnSync(
      "/usr/local/bin/docker",
      [
        "--host",
        "unix:///var/run/docker.sock",
        "exec",
        container,
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
    if (attempt === 59) throw new Error("Owned PostgreSQL readiness timeout");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  Object.assign(process.env, {
    DB_HOST: "127.0.0.1",
    DB_PORT: dbPort,
    DB_USER: "postgres",
    DB_PASSWORD: dbPassword,
    DB_NAME: dbName,
    JWT_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    NODE_ENV: "test",
  });
  process.chdir(roots.POSGRADOSETECAPI);
  await build("POSGRADOSETECAPI");
  const require = createRequire(
    path.join(roots.POSGRADOSETECAPI, "package.json"),
  );
  pool = require("./dist/db/pool.js").pool;
  const q = async (sql, params = []) => (await pool.query(sql, params)).rows;
  const one = async (sql, params = []) => (await q(sql, params))[0];
  assert.equal((await one("SELECT current_database() AS name")).name, dbName);
  await q(
    await readFile(
      path.join(roots.POSGRADOSETECAPI, "database/schema.sql"),
      "utf8",
    ),
  );
  await q(
    "INSERT INTO roles(nombre) VALUES ('SUPER_ADMIN'),('COORDINADOR'),('CAJERO'),('DOCENTE'),('ESTUDIANTE')",
  );
  const permissions = [
    "USUARIO_GESTIONAR",
    "SEDE_GESTIONAR",
    "DOCENTE_GESTIONAR",
    "CATALOGO_GESTIONAR",
    "COHORTE_GESTIONAR",
    "INSCRIPCION_VALIDAR",
    "PAGO_VALIDAR",
    "CONVALIDACION_DICTAMINAR",
    "NOTA_IMPORTAR",
    "NOTA_MODIFICAR",
    "TITULO_EMITIR",
    "CERTIFICADO_REVOCAR",
  ];
  for (const code of permissions)
    await q(
      "INSERT INTO permisos(codigo,nombre) VALUES ($1,$1) ON CONFLICT(codigo) DO NOTHING",
      [code],
    );
  await q(
    "INSERT INTO roles_permisos(rol_id,permiso_id) SELECT r.id,p.id FROM roles r,permisos p WHERE r.nombre='CAJERO' AND p.codigo='PAGO_VALIDAR'",
  );
  const bcrypt = require("bcrypt");
  const passwordHash = await bcrypt.hash(password, 8);
  for (const [name, role] of [
    ["admin", "SUPER_ADMIN"],
    ["cashier", "CAJERO"],
  ])
    await q(
      "INSERT INTO usuarios(email,username,nombres,apellidos,password_hash,rol_id,activo) VALUES ($1,$2,$3,'Prueba',$4,(SELECT id FROM roles WHERE nombre=$5),true)",
      [
        `${name}@isolated-e2e.test`,
        name,
        name === "admin" ? "Administración" : "Caja",
        passwordHash,
        role,
      ],
    );
  const area = await one(
    "INSERT INTO areas_conocimiento(nombre,slug) VALUES ('Área de prueba aislada','e2e-area') RETURNING id",
  );
  const campus = await one(
    "INSERT INTO sedes_ies(codigo_sede,nombre,tipo_sede) VALUES ('E2E','Sede de prueba aislada','SEDE_CENTRAL') RETURNING id",
  );
  const staff = await one(
    "INSERT INTO personal_academico(identificacion,nombres,apellidos,maximo_grado_academico,cv_url) VALUES ('E2E-STAFF','Docente','De prueba','MASTER','/uploads/documentos/cv-fixture.pdf') RETURNING id",
  );
  const program = await one(
    "INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,creditos_totales,titulo_o_certificado_otorgado,visible_en_web,resumen_corto_web,precio_total_referencia) VALUES ('E2E','Programa conectado de prueba','programa-conectado-prueba','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,2,'Certificado de prueba',true,'Fixture aislada para verificar integración real, sin oferta oficial.',100) RETURNING id",
    [area.id],
  );
  const cohort = await one(
    "INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte,precio_matricula,cupo_minimo,cupo_maximo,cupos_actuales_verificados,estado_cohorte) VALUES ($1,$2,'VIRTUAL','E2E-ABIERTA',1,$3,current_date-1,current_date+10,current_date+20,current_date+25,100,10,15,30,14,'INSCRIPCION_ABIERTA') RETURNING id",
    [program.id, campus.id, staff.id],
  );
  const component = await one(
    "INSERT INTO componentes_curriculares(programa_id,codigo,nombre,horas,creditos) VALUES ($1,'E2E-M1','Componente de prueba',8,2) RETURNING id",
    [program.id],
  );
  const schedule = await one(
    "INSERT INTO programacion_componentes_cohorte(cohorte_id,componente_id,docente_titular_id,fecha_inicio,fecha_fin,horario,aula) VALUES ($1,$2,$3,current_date+20,current_date+25,'Horario de prueba','Aula de prueba') RETURNING id",
    [cohort.id, component.id, staff.id],
  );
  for (let n = 1; n <= 14; n++) {
    const applicant = await one(
      "INSERT INTO personas_aspirantes(tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono,identidad_verificada) VALUES ('PASAPORTE',$1,'Quórum','Fixture','2000-01-01',$2,'12345678',true) RETURNING id",
      [`E2E-Q-${n}`, `quorum-${n}@isolated-e2e.test`],
    );
    await q(
      "INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES ($1,$2,$3,'INSCRITO_RESERVADO')",
      [`EXP-E2E-Q-${n}`, applicant.id, cohort.id],
    );
  }
  report.fixtures.push(
    "New uncsm_test PostgreSQL database, roles/admin/cashier, published EP program and open cohort, 14 prevalidated reservation fixtures to satisfy the existing quorum of 15, one real modeled component/schedule.",
  );
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const text =
    "BT /F1 12 Tf 30 100 Td (ISOLATED TEST FIXTURE - NOT AN OFFICIAL CERTIFICATE) Tj ET";
  objects.push(
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  );
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const [index, value] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${value}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const pdfPath = path.join(scratch, "fixture-not-official.pdf");
  await writeFile(pdfPath, pdf);
  const { app } = require("./dist/app.js");
  const apiOrigin = await listen(createServer(app));
  const apiBase = `${apiOrigin}/api`;
  await Promise.all(
    ["setecweb", "setecportal"].map((name) =>
      build(name, {
        NODE_ENV: "production",
        VITE_API_BASE_URL: apiBase,
        VITE_API_ORIGIN: apiOrigin,
      }),
    ),
  );
  const adminOrigin = await staticApp(roots.setecweb),
    portalOrigin = await staticApp(roots.setecportal);
  report.origins = { api: apiOrigin, admin: adminOrigin, portal: portalOrigin };
  const { chromium } = await import(
    pathToFileURL(
      path.join(source, "setecportal/node_modules/playwright/index.mjs"),
    ).href
  );
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const newPage = async (name) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", (error) =>
      report.pageErrors.push({ name, error: error.message }),
    );
    page.on("response", (response) => {
      if (response.url().startsWith(apiOrigin) && response.status() >= 400)
        report.httpErrors.push({
          name,
          url: new URL(response.url()).pathname,
          status: response.status(),
        });
    });
    return page;
  };
  const student = await newPage("student"),
    admin = await newPage("admin"),
    cashier = await newPage("cashier"),
    visitor = await newPage("visitor");
  let studentTokens,
    enrollment,
    applicant,
    registered,
    adminReady = false;
  const apiRequest = async (target, method = "GET", body, token) => {
    const result = await fetch(apiBase + target, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: result.status,
      data: (result.headers.get("content-type") || "").includes(
        "application/json",
      )
        ? await result.json()
        : Buffer.from(await result.arrayBuffer()),
    };
  };
  const loginAdmin = async (page, email) => {
    await page.goto(adminOrigin);
    await page.getByLabel("Usuario o correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: email.startsWith("cashier") ? "Panel de Caja" : "Panel principal",
        exact: true,
      })
      .waitFor();
  };
  let studentReady = false;
  await step(
    "API fixture prepares an existing own application for the targeted admission/payment recheck",
    async () => {
      let response = await apiRequest("/auth/register", "POST", {
        email: "student@isolated-e2e.test",
        password,
        nombres: "Estudiante Real",
        apellidos: "Prueba",
      });
      assert.equal(response.status, 201);
      response = await apiRequest("/auth/login", "POST", {
        email: "student@isolated-e2e.test",
        password,
      });
      assert.equal(response.status, 200);
      studentTokens = response.data.data.tokens;
      response = await apiRequest(
        "/applicants",
        "POST",
        {
          tipo_identificacion: "PASAPORTE",
          numero_identificacion: "E2E-STUDENT-OWNER",
          nombres: "Estudiante Real",
          apellidos: "Prueba",
          fecha_nacimiento: "2000-01-01",
          email: "student@isolated-e2e.test",
          telefono: "12345678",
        },
        studentTokens.accessToken,
      );
      assert.equal(response.status, 201);
      applicant = response.data.data;
      response = await apiRequest(
        "/enrollments",
        "POST",
        { cohorte_id: cohort.id },
        studentTokens.accessToken,
      );
      assert.equal(response.status, 201);
      enrollment = response.data.data;
      assert.equal(enrollment.estado, "EN_REVISION_DOCUMENTAL");
      report.fixtures.push(
        "Targeted recheck starts with registration/profile/application created through real HTTP API; their UI traversal was already observed in the previous retained run.",
      );
      await student.goto(portalOrigin + "/acceso");
      await student
        .getByLabel(/^Correo o usuario/)
        .fill("student@isolated-e2e.test");
      await student.getByLabel(/^Contraseña/).fill(password);
      await student
        .getByRole("button", { name: "Entrar", exact: true })
        .click();
      await student
        .getByRole("heading", { name: "Hola, Estudiante Real", exact: true })
        .waitFor();
      studentReady = true;
    },
    student,
  );
  adminReady = await step(
    "UI admin login, operational dashboard and real user directory",
    async () => {
      await loginAdmin(admin, "admin@isolated-e2e.test");
      await screenshot(admin, "admin-dashboard");
      await admin
        .getByRole("navigation")
        .getByRole("link", { name: "Usuarios", exact: true })
        .click();
      await admin
        .getByRole("heading", { name: "Usuarios", exact: true })
        .waitFor();
      await admin
        .getByLabel("Buscar nombre, correo o usuario")
        .fill("student@isolated-e2e.test");
      if (studentReady)
        await admin
          .getByRole("cell", { name: "student@isolated-e2e.test", exact: true })
          .waitFor();
    },
    admin,
  );
  let planReady = false;
  if (adminReady)
    planReady = await step(
      "UI administrator configures a separate enrollment fee and exact installment plan before acceptance",
      async () => {
        await admin.getByRole("navigation").getByRole("link", { name: "Cohortes y grupos", exact: true }).click();
        await admin.getByRole("button", { name: "Planes de pagos", exact: true }).click();
        const dialog = admin.getByRole("dialog", { name: "Planes de pagos de cohorte", exact: true });
        await dialog.getByRole("button", { name: "Nuevo plan", exact: true }).click();
        await dialog.getByLabel("Nombre del plan *", { exact: true }).fill("Plan conectado: matrícula y dos cuotas");
        await dialog.getByLabel(/^Modalidad de cobro/).selectOption("CUOTAS");
        await dialog.getByLabel("Costo académico *", { exact: true }).fill("100.00");
        await dialog.getByLabel("Matrícula separada *", { exact: true }).fill("10.00");
        await dialog.getByLabel("Cantidad de cuotas", { exact: true }).fill("2");
        await dialog.getByRole("button", { name: "Distribuir costo académico", exact: true }).click();
        assert.equal(await dialog.getByLabel("Importe 1 *", { exact: true }).inputValue(), "50.00");
        assert.equal(await dialog.getByLabel("Importe 2 *", { exact: true }).inputValue(), "50.00");
        const saved = admin.waitForResponse(response => response.url().endsWith(`/billing/cohorts/${cohort.id}/plans`) && response.request().method() === "POST");
        await dialog.getByRole("button", { name: "Guardar plan", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await dialog.getByText(/Plan guardado correctamente/).waitFor();
        await screenshot(admin, "admin-cohort-payment-plan");
        await dialog.getByRole("button", { name: "Cerrar diálogo", exact: true }).click();
      },
      admin,
    );
  let approved = false;
  if (adminReady && planReady && enrollment)
    approved = await step(
      "UI administrative documentary validation reaches actual quorum and pending payment",
      async () => {
        await admin
          .getByRole("navigation")
          .getByRole("link", { name: "Inscripciones", exact: true })
          .click();
        await admin
          .getByRole("searchbox", { name: "Buscar", exact: true })
          .fill(enrollment.codigo_expediente);
        const row = admin
          .getByRole("row")
          .filter({ hasText: enrollment.codigo_expediente });
        await row.getByRole("button").first().click();
        await admin
          .getByRole("button", { name: "Validar documentación", exact: true })
          .click();
        await admin.getByLabel(/^Aprobar documentación/).check();
        const decision = admin.waitForResponse(
          (response) =>
            response.url().endsWith("/validate-documents") &&
            response.request().method() === "PATCH",
        );
        await admin
          .getByRole("button", {
            name: "Confirmar validación documental",
            exact: true,
          })
          .click();
        assert.equal((await decision).status(), 200);
        const persisted = await one(
          "SELECT estado FROM inscripciones WHERE id=$1",
          [enrollment.id],
        );
        assert.equal(persisted.estado, "PENDIENTE_PAGO");
        await screenshot(admin, "admin-document-validation");
        await admin.getByRole("dialog", { name: "Detalle de inscripción", exact: true })
          .getByRole("button", { name: "Cerrar diálogo", exact: true }).click();
      },
      admin,
    );
  let collected = false;
  let matriculated = false;
  const cashierReady = await step(
    "UI cashier-only dashboard and restricted navigation",
    async () => {
      await loginAdmin(cashier, "cashier@isolated-e2e.test");
      assert.equal(
        await cashier
          .getByRole("navigation")
          .getByRole("link", { name: "Usuarios", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await cashier
          .getByRole("navigation")
          .getByRole("link", { name: "Graduación", exact: true })
          .count(),
        0,
      );
      await screenshot(cashier, "cashier-dashboard");
    },
    cashier,
  );
  if (cashierReady && approved)
    collected = await step(
      "UI student-first Caja discovers cohorts and collects partial obligations without activating enrollment",
      async () => {
        await cashier
          .getByRole("navigation")
          .getByRole("link", { name: "Caja y pagos", exact: true })
          .click();
        await cashier.getByLabel("Nombre, identificación o expediente", { exact: true }).fill("Estudiante Real");
        const person = cashier.getByRole("row").filter({ hasText: "Estudiante Real Prueba" });
        assert.equal((await person.getByRole("cell").nth(1).innerText()).includes("termina en WNER"), true);
        assert.equal((await person.innerText()).includes("E2E-STUDENT-OWNER"), false);
        await person.getByRole("button", { name: "Seleccionar estudiante", exact: true }).click();
        await cashier.getByRole("row").filter({ hasText: enrollment.codigo_expediente })
          .getByRole("button", { name: "Ver estado de cuenta", exact: true }).click();
        await cashier.getByRole("heading", { name: "Estado de cuenta", exact: true }).waitFor();
        assert.equal(await cashier.getByRole("button", { name: "Activar matrícula", exact: true }).count(), 0);
        await cashier.getByRole("button", { name: "Cobrar conceptos", exact: true }).click();
        const dialog = cashier.getByRole("dialog", { name: "Registrar cobro", exact: true });
        await dialog.getByRole("checkbox", { name: "Seleccionar Matrícula", exact: true }).check();
        await dialog.getByRole("checkbox", { name: "Seleccionar Cuota 1", exact: true }).check();
        await dialog.getByLabel("Abono a Cuota 1", { exact: true }).fill("20.00");
        const payment = cashier.waitForResponse(
          (response) =>
            response.url().endsWith(`/billing/enrollments/${enrollment.id}/payments`) &&
            response.request().method() === "POST",
        );
        await cashier
          .getByRole("button", { name: "Confirmar cobro", exact: true })
          .click();
        const paymentResponse = await payment;
        assert.equal(paymentResponse.status(), 200);
        const financial = (await paymentResponse.json()).data;
        assert.equal(financial.pago.total_pagado, "30.00");
        assert.ok(financial.comprobante.id);
        const persisted = await one("SELECT estado,fecha_formalizacion_matricula FROM inscripciones WHERE id=$1", [enrollment.id]);
        assert.equal(persisted.estado, "PENDIENTE_PAGO");
        assert.equal(persisted.fecha_formalizacion_matricula, null);
        await cashier.getByText(/Cobro confirmado/).waitFor();
        const downloadPromise = cashier.waitForEvent("download");
        await cashier.getByRole("button", { name: "Descargar PDF", exact: true }).click();
        const download = await downloadPromise;
        const downloaded = path.join(scratch, "cashier-internal-receipt.pdf");
        await download.saveAs(downloaded);
        assert.equal((await readFile(downloaded)).subarray(0, 8).toString(), "%PDF-1.4");
        await screenshot(cashier, "cashier-partial-obligations-collection");
      },
      cashier,
    );
  if (collected)
    await step(
      "UI student account shows the same agreed plan, paid concepts and balance as Caja",
      async () => {
        await student.getByRole("navigation").getByRole("link", { name: "Mis solicitudes", exact: true }).click();
        await student.getByRole("link", { name: "Programa conectado de prueba", exact: true }).click();
        await student.getByRole("heading", { name: "Estado de cuenta", exact: true }).waitFor();
        await student.getByText("Plan conectado: matrícula y dos cuotas", { exact: true }).waitFor();
        const fact = async (label) => student.getByText(label, { exact: true }).locator("xpath=following-sibling::dd").innerText();
        assert.match(await fact("Matrícula acordada"), /10\.00/);
        assert.match(await fact("Costo académico acordado"), /100\.00/);
        assert.match(await fact("Total pagado y aprobado"), /30\.00/);
        assert.match(await fact("Saldo pendiente"), /80\.00/);
        const obligations = student.getByRole("region", { name: "Obligaciones y cuotas", exact: true });
        assert.match(await obligations.getByRole("row").filter({ hasText: "Cuota 1" }).innerText(), /30\.00/);
        await student.getByRole("button", { name: /^Descargar PDF del comprobante/ }).waitFor();
        await screenshot(student, "student-authoritative-account");
      },
      student,
    );
  if (collected && adminReady)
    matriculated = await step(
      "UI administrator explicitly activates enrollment after collection; student sees the active course",
      async () => {
        await admin.getByRole("navigation").getByRole("link", { name: "Caja y pagos", exact: true }).click();
        await admin.getByLabel("Nombre, identificación o expediente", { exact: true }).fill("Estudiante Real");
        await admin.getByRole("row").filter({ hasText: "Estudiante Real Prueba" })
          .getByRole("button", { name: "Seleccionar estudiante", exact: true }).click();
        await admin.getByRole("row").filter({ hasText: enrollment.codigo_expediente })
          .getByRole("button", { name: "Ver estado de cuenta", exact: true }).click();
        await admin.getByRole("button", { name: "Activar matrícula", exact: true }).click();
        const dialog = admin.getByRole("dialog", { name: "Activar matrícula", exact: true });
        await dialog.getByLabel(/^Motivo de la operación/).fill("Decisión administrativa explícita de prueba aislada");
        const activation = admin.waitForResponse(response => response.url().endsWith(`/billing/enrollments/${enrollment.id}/activate`) && response.request().method() === "POST");
        await dialog.getByRole("button", { name: "Confirmar operación", exact: true }).click();
        assert.equal((await activation).status(), 200);
        const persisted = await one("SELECT estado,fecha_formalizacion_matricula FROM inscripciones WHERE id=$1", [enrollment.id]);
        assert.equal(persisted.estado, "MATRICULADO_ACTIVO");
        assert.ok(persisted.fecha_formalizacion_matricula);
        await student
          .getByRole("navigation")
          .getByRole("link", { name: "Mis cursos", exact: true })
          .click();
        await student
          .getByRole("link", {
            name: "Programa conectado de prueba",
            exact: true,
          })
          .waitFor();
        await screenshot(student, "student-active-course");
      },
      admin,
    );
  if (matriculated)
    await step(
      "UI finished history and actual grade reflect an explicit isolated EGRESADO fixture",
      async () => {
        await q("UPDATE inscripciones SET estado='EGRESADO' WHERE id=$1", [
          enrollment.id,
        ]);
        await q(
          "INSERT INTO matricula_componentes_snepa(inscripcion_id,programacion_componente_id,componente_id,calificacion_cuantitativa,aprobado) VALUES ($1,$2,$3,90,true) ON CONFLICT DO NOTHING",
          [enrollment.id, schedule.id, component.id],
        );
        report.fixtures.push(
          "Only the finished-history check uses SQL academic prerequisite EGRESADO and an approved component grade; this is not an automatic academic decision.",
        );
        await student
          .getByRole("navigation")
          .getByRole("link", { name: "Inicio", exact: true })
          .click();
        await student
          .getByRole("navigation")
          .getByRole("link", { name: "Mis cursos", exact: true })
          .click();
        const finished = student
          .getByRole("heading", { name: "Finalizados", exact: true })
          .locator("xpath=ancestor::section[1]");
        await finished
          .getByRole("link", {
            name: "Programa conectado de prueba",
            exact: true,
          })
          .waitFor();
        await screenshot(student, "student-finished-history");
        await finished
          .getByRole("link", {
            name: "Programa conectado de prueba",
            exact: true,
          })
          .click();
        const gradeCell = student
          .getByRole("row")
          .filter({ hasText: "Componente de prueba" })
          .getByRole("cell")
          .first();
        await gradeCell.waitFor();
        const recordedGrade = (await gradeCell.innerText()).trim();
        assert.equal(Number(recordedGrade.replace(",", ".")), 90);
        report.recordedGrade = recordedGrade;
        await screenshot(student, "student-recorded-results");
      },
      student,
    );
  report.complete = report.steps.every((item) => item.passed);
}
try {
  await main();
} catch (error) {
  report.fatal = error.message;
  report.complete = false;
  console.error("FATAL " + error.message);
} finally {
  try {
    if (browser) await browser.close();
    report.cleanup.browser = true;
  } catch (error) {
    report.cleanup.browser = error.message;
  }
  for (const server of servers.reverse())
    await new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    });
  report.cleanup.servers = true;
  try {
    if (pool) await pool.end();
    report.cleanup.pool = true;
  } catch (error) {
    report.cleanup.pool = error.message;
  }
  try {
    if (containerCreated) docker(["stop", "-t", "1", container]);
    report.cleanup.container = true;
  } catch (error) {
    report.cleanup.container = error.message;
  }
  await writeFile(
    path.join(scratch, "result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      complete: report.complete,
      passed: report.steps.filter((item) => item.passed).length,
      failed: report.steps.filter((item) => !item.passed).length,
      fatal: report.fatal,
      scratch,
      cleanup: report.cleanup,
    }),
  );
  if (!report.complete) process.exitCode = 1;
}
