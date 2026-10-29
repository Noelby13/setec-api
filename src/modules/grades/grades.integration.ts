/** Disposable local PostgreSQL proof. Uses only a cached image and its own container/database. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const root = path.resolve(__dirname, "../../..");
  const originalCwd = process.cwd();
  const suffix = randomBytes(6).toString("hex");
  const database = `uncsm_test_grades_${suffix}`;
  const container = `uncsm-grades-${suffix}`;
  const password = randomBytes(24).toString("hex");
  const scratch = await mkdtemp(
    path.join(tmpdir(), "uncsm-grades-integration-"),
  );
  let created = false;
  let pool: import("pg").Pool | undefined;
  const checks: string[] = [];
  function docker(args: string[]) {
    const result = spawnSync(
      "/usr/local/bin/docker",
      ["--host", "unix:///var/run/docker.sock", ...args],
      { encoding: "utf8", timeout: 30000 },
    );
    if (result.status !== 0)
      throw new Error(
        `Owned Docker operation ${args[0]} failed: ${result.stderr.trim() || "unavailable"}`,
      );
    return result.stdout.trim();
  }
  try {
    const schema = await readFile(
      path.join(root, "database/schema.sql"),
      "utf8",
    );
    docker([
      "run",
      "--pull=never",
      "--rm",
      "-d",
      "--name",
      container,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      `POSTGRES_DB=${database}`,
      "-p",
      "127.0.0.1::5432",
      "postgres:16-alpine",
    ]);
    created = true;
    const port = Number(
      docker(["port", container, "5432/tcp"]).split(":").at(-1),
    );
    assert.ok(Number.isInteger(port) && port > 0);
    for (let attempt = 0; ; attempt++) {
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
          database,
        ],
        { timeout: 5000, stdio: "ignore" },
      );
      if (ready.status === 0) break;
      if (attempt === 49)
        throw new Error("Owned PostgreSQL readiness timed out");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    Object.assign(process.env, {
      DB_HOST: "127.0.0.1",
      DB_PORT: String(port),
      DB_USER: "postgres",
      DB_PASSWORD: password,
      DB_NAME: database,
      NODE_ENV: "test",
    });
    process.chdir(scratch);
    pool = (await import(pathToFileURL(path.join(root, "src/db/pool.ts")).href))
      .pool;
    const db = pool!;
    const q = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows;
    const one = async (sql: string, values: unknown[] = []) =>
      (await q(sql, values))[0];
    assert.equal(
      (await one("SELECT current_database() AS name")).name,
      database,
    );
    assert.match(database, /^uncsm_test_grades_[a-f0-9]{12}$/);
    await q(
      schema.split(
        "-- Technical registry of existing institutional documents; no automatic issuance.",
      )[0],
    );
    const role = await one(
      "INSERT INTO roles(nombre) VALUES ('SUPER_ADMIN') RETURNING id",
    );
    const user = await one(
      "INSERT INTO usuarios(email,password_hash,nombres,apellidos,rol_id) VALUES ('operator@grades.test','unused','Grade','Operator',$1) RETURNING id",
      [role.id],
    );
    const area = await one(
      "INSERT INTO areas_conocimiento(nombre,slug) VALUES ('Grade test','grades-test') RETURNING id",
    );
    const campus = await one(
      "INSERT INTO sedes_ies(codigo_sede,nombre,tipo_sede) VALUES ('GRADES','Grade test','SEDE_CENTRAL') RETURNING id",
    );
    const staff = await one(
      "INSERT INTO personal_academico(usuario_id,identificacion,nombres,apellidos,maximo_grado_academico,cv_url) VALUES ($1,'GRADE-STAFF','Grade','Teacher','MASTER','/uploads/test.pdf') RETURNING id",
      [user.id],
    );
    const program = await one(
      "INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,titulo_o_certificado_otorgado) VALUES ('GRADES','Grade test','grade-test','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,'Test') RETURNING id",
      [area.id],
    );
    const cohorts: any[] = [];
    for (let index = 0; index < 2; index++)
      cohorts.push(
        await one(
          "INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte) VALUES ($1,$2,'PRESENCIAL',$3,1,$4,current_date-4,current_date-3,current_date-2,current_date-1,0) RETURNING id",
          [program.id, campus.id, `GRADES-${index}`, staff.id],
        ),
      );
    const component = await one(
      "INSERT INTO componentes_curriculares(programa_id,codigo,nombre,horas) VALUES ($1,'GRADES','Grade test',8) RETURNING id",
      [program.id],
    );
    const schedule = await one(
      "INSERT INTO programacion_componentes_cohorte(cohorte_id,componente_id,docente_titular_id) VALUES ($1,$2,$3) RETURNING id",
      [cohorts[0].id, component.id, staff.id],
    );
    const enrollments: any[] = [];
    for (let index = 0; index < 4; index++) {
      const applicant = await one(
        "INSERT INTO personas_aspirantes(tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ('PASAPORTE',$1,'Synthetic',$2,'2000-01-01',$3,'12345678') RETURNING id",
        [`GRADES-${index}`, `Student ${index}`, `student${index}@grades.test`],
      );
      enrollments.push(
        await one(
          "INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES ($1,$2,$3,'MATRICULADO_ACTIVO') RETURNING id",
          [`GRADES-${index}`, applicant.id, cohorts[index === 3 ? 1 : 0].id],
        ),
      );
    }
    const { GradesService } = await import(
      pathToFileURL(path.join(root, "src/modules/grades/grades.service.ts"))
        .href
    );
    const actor = { id: user.id, rol: "SUPER_ADMIN", permisos: [] };
    const input = (score: number) => ({
      calificacion_cuantitativa: score,
      motivo_modificacion: "Isolated grade verification",
    });
    const snapshot = async () =>
      createHash("sha256")
        .update(
          JSON.stringify([
            await q("SELECT * FROM matricula_componentes_snepa ORDER BY id"),
            await q("SELECT * FROM notas_snepa_logs ORDER BY id"),
          ]),
        )
        .digest("hex");
    async function rejected(operation: () => Promise<unknown>, status: number) {
      const before = await snapshot();
      await assert.rejects(
        operation,
        (error: any) => error.statusCode === status,
      );
      assert.equal(await snapshot(), before);
    }
    const pending = await GradesService.getStudentsByComponent(schedule.id);
    assert.equal(pending.length, 3);
    assert.ok(pending.every((row: any) => row.id === null));
    assert.equal(
      (await q("SELECT * FROM matricula_componentes_snepa")).length,
      0,
    );
    checks.push(
      "complete cohort roster includes pending students without writes",
    );
    const initial = await GradesService.createGradeManually(
      schedule.id,
      enrollments[0].id,
      input(0),
      actor,
    );
    assert.equal(Number(initial.grade.calificacion_cuantitativa), 0);
    assert.equal(initial.grade.aprobado, false);
    assert.equal(initial.grade.valoracion_cualitativa, "APRENDIZAJE_INICIAL");
    assert.equal(initial.grade.lote_importacion_id, null);
    assert.equal(initial.auditLog.nota_anterior, null);
    assert.equal(Number(initial.auditLog.nota_nueva), 0);
    checks.push(
      "zero grade and initial audit persist together without an import lot",
    );
    await rejected(
      () =>
        GradesService.createGradeManually(
          schedule.id,
          enrollments[0].id,
          input(90),
          actor,
        ),
      409,
    );
    await rejected(
      () =>
        GradesService.createGradeManually(
          schedule.id,
          enrollments[3].id,
          input(90),
          actor,
        ),
      400,
    );
    await rejected(
      () =>
        GradesService.createGradeManually(
          schedule.id,
          randomUUID(),
          input(90),
          actor,
        ),
      404,
    );
    await rejected(
      () =>
        GradesService.createGradeManually(
          randomUUID(),
          enrollments[1].id,
          input(90),
          actor,
        ),
      404,
    );
    await rejected(
      () =>
        GradesService.createGradeManually(
          schedule.id,
          enrollments[1].id,
          input(90),
          { ...actor, id: randomUUID(), rol: "DOCENTE" },
        ),
      403,
    );
    checks.push(
      "duplicate, foreign-cohort, missing-record and other-teacher rejection preserve data hashes",
    );
    const corrected = await GradesService.modifyGradeManually(
      initial.grade.id,
      input(92),
      user.id,
      actor.rol,
    );
    assert.equal(Number(corrected.auditLog.nota_anterior), 0);
    assert.equal(Number(corrected.auditLog.nota_nueva), 92);
    assert.equal(corrected.grade.aprobado, true);
    assert.equal(
      corrected.grade.valoracion_cualitativa,
      "APRENDIZAJE_AVANZADO",
    );
    checks.push(
      "correction recomputes SNEPA and retains actual previous values in audit",
    );
    await q(
      "CREATE FUNCTION reject_grade_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit failure'; END $$",
    );
    await q(
      "CREATE TRIGGER reject_grade_audit BEFORE INSERT ON notas_snepa_logs FOR EACH ROW EXECUTE FUNCTION reject_grade_audit()",
    );
    const beforeAuditFailure = await snapshot();
    await assert.rejects(
      () =>
        GradesService.createGradeManually(
          schedule.id,
          enrollments[1].id,
          input(80),
          actor,
        ),
      /Synthetic audit failure/,
    );
    assert.equal(await snapshot(), beforeAuditFailure);
    await assert.rejects(
      () =>
        GradesService.modifyGradeManually(
          initial.grade.id,
          input(50),
          user.id,
          actor.rol,
        ),
      /Synthetic audit failure/,
    );
    assert.equal(await snapshot(), beforeAuditFailure);
    await q("DROP TRIGGER reject_grade_audit ON notas_snepa_logs");
    checks.push(
      "real PostgreSQL audit failures roll back both creation and correction",
    );
    const races = await Promise.allSettled(
      [80, 90].map((score) =>
        GradesService.createGradeManually(
          schedule.id,
          enrollments[1].id,
          input(score),
          actor,
        ),
      ),
    );
    assert.equal(
      races.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      races.filter(
        (result) =>
          result.status === "rejected" && result.reason.statusCode === 409,
      ).length,
      1,
    );
    assert.equal(
      (
        await one(
          "SELECT count(*)::int AS count FROM matricula_componentes_snepa WHERE inscripcion_id=$1",
          [enrollments[1].id],
        )
      ).count,
      1,
    );
    const raceGrade = await one(
      "SELECT id FROM matricula_componentes_snepa WHERE inscripcion_id=$1",
      [enrollments[1].id],
    );
    assert.equal(
      (
        await one(
          "SELECT count(*)::int AS count FROM notas_snepa_logs WHERE matricula_componente_id=$1",
          [raceGrade.id],
        )
      ).count,
      1,
    );
    checks.push(
      "simultaneous first entry has one winner, one conflict and one audit",
    );
    const concurrentCorrections = await Promise.all(
      [80, 90].map((score) =>
        GradesService.modifyGradeManually(
          initial.grade.id,
          input(score),
          user.id,
          actor.rol,
        ),
      ),
    );
    const first = concurrentCorrections.find(
      (result) => Number(result.auditLog.nota_anterior) === 92,
    )!;
    assert.ok(first);
    const second = concurrentCorrections.find(
      (result) =>
        Number(result.auditLog.nota_anterior) ===
        Number(first.auditLog.nota_nueva),
    );
    assert.ok(second);
    assert.notEqual(first.auditLog.id, second.auditLog.id);
    checks.push(
      "concurrent corrections serialize and retain an unbroken audit chain",
    );
    const owner = await db.connect();
    let waiting: Promise<{ error: any }> | undefined;
    try {
      await owner.query("BEGIN");
      await owner.query(
        "UPDATE programacion_componentes_cohorte SET actas_notas_cerradas=TRUE WHERE id=$1",
        [schedule.id],
      );
      waiting = GradesService.createGradeManually(
        schedule.id,
        enrollments[2].id,
        input(85),
        actor,
      ).then(
        () => ({ error: null }),
        (error: any) => ({ error }),
      );
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        blocked = (
          await one(
            "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF pcc%') AS blocked",
            [database],
          )
        ).blocked;
        if (blocked) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(blocked, "save must wait on the uncommitted schedule closure");
      await owner.query("COMMIT");
      const before = await snapshot();
      assert.equal((await waiting)?.error?.statusCode, 400);
      assert.equal(await snapshot(), before);
    } finally {
      await owner.query("ROLLBACK");
      owner.release();
      if (waiting) await waiting;
    }
    await rejected(
      () =>
        GradesService.modifyGradeManually(
          initial.grade.id,
          input(70),
          user.id,
          actor.rol,
        ),
      400,
    );
    checks.push(
      "schedule closure blocks waiting creation and later correction without data changes",
    );
    assert.equal(
      (await GradesService.getStudentsByComponent(schedule.id)).filter(
        (row: any) => row.id === null,
      ).length,
      1,
    );
  } finally {
    try {
      if (pool) await pool.end();
    } finally {
      process.chdir(originalCwd);
      try {
        if (created) docker(["stop", "-t", "1", container]);
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        complete: true,
        database: "disposable PostgreSQL 16",
        cleanup: "owned container and scratch removed",
        checks,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(
    `Grade integration failed: ${error instanceof Error ? error.message : "unknown failure"}`,
  );
  process.exitCode = 1;
});
