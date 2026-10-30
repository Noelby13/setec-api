/** Tests only an owned disposable PostgreSQL database; never loads .env. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rollbackPath = new URL('database/demo_bulk_rollback.sql', root);
assert.ok(existsSync(rollbackPath), 'rollback SQL is missing; v1 demo records cannot be removed safely');
const rollback = readFileSync(rollbackPath, 'utf8');
const schema = readFileSync(new URL('database/schema.sql', root), 'utf8');
const container = `pep-demo-rollback-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const checks = [];
let owned = false;

function docker(args, input) {
  return spawnSync('/usr/local/bin/docker', ['--host', 'unix:///var/run/docker.sock', ...args],
    { input, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
}
function query(sql, database = 'rollback_test', expectedSuccess = true) {
  const result = docker(['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], sql);
  if (expectedSuccess) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0, 'expected rejected rollback');
  return result;
}
function snapshot(database = 'rollback_test') {
  const tables = query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename", database)
    .stdout.trim().split('\n');
  return tables.map(table => [table, query(`SELECT md5(coalesce(string_agg(to_jsonb(t)::text,
    E'\\n' ORDER BY to_jsonb(t)::text),'')) FROM "${table}" t`, database).stdout.trim()]);
}
function count(sql) { return Number(query(sql).stdout.trim()); }
const optIn = "SET demo.allow_remove='yes';\n";

try {
  const started = docker(['run', '--pull=never', '--rm', '-d', '--network', 'none', '--name', container,
    '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=rollback_test', 'postgres:16-alpine']);
  assert.equal(started.status, 0, started.stderr);
  owned = true;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'rollback_test']).status === 0) {
      ready = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'owned PostgreSQL readiness timed out');
  query(schema);

  const archived = spawnSync('git', ['show', '08a6999:database/demo_bulk_load.sql'],
    { cwd: fileURLToPath(root), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(archived.status, 0, archived.stderr);
  const v1 = archived.stdout;

  query(`INSERT INTO areas_conocimiento(id,nombre,slug) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001','Original area','original-area');
    INSERT INTO programas_academicos(id,codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,
      horas_totales,titulo_o_certificado_otorgado,visible_en_web,estado_vigencia,precio_total_referencia)
    VALUES ('aaaaaaaa-0000-4000-8000-000000000002','ORIGINAL','Original career','original-career',
      'EDUCACION_PERMANENTE','CURSO_EXTENSION','aaaaaaaa-0000-4000-8000-000000000001',40,
      'Original certificate',false,'PAUSADO',0);`);
  const originalProgram = query("SELECT to_jsonb(p) FROM programas_academicos p WHERE id='aaaaaaaa-0000-4000-8000-000000000002'").stdout;
  const originalArea = query("SELECT to_jsonb(a) FROM areas_conocimiento a WHERE id='aaaaaaaa-0000-4000-8000-000000000001'").stdout;
  query("SET demo.allow_seed='yes';\n" + v1);
  assert.equal(count('SELECT count(*) FROM cohortes_apertura'), 99);
  assert.equal(count('SELECT count(*) FROM inscripciones'), 1980);

  query(`INSERT INTO areas_conocimiento(id,nombre,slug) VALUES
    ('bbbbbbbb-0000-4000-8000-000000000001','Later area','later-area');
    INSERT INTO programas_academicos(id,codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,
      horas_totales,titulo_o_certificado_otorgado,visible_en_web,estado_vigencia,precio_total_referencia)
    VALUES ('bbbbbbbb-0000-4000-8000-000000000002','LATER','Later unrelated career','later-career',
      'EDUCACION_PERMANENTE','CURSO_EXTENSION','bbbbbbbb-0000-4000-8000-000000000001',40,
      'Later certificate',false,'PAUSADO',0);`);
  const lateProgram = query("SELECT to_jsonb(p) FROM programas_academicos p WHERE id='bbbbbbbb-0000-4000-8000-000000000002'").stdout;
  const laterArea = query("SELECT to_jsonb(a) FROM areas_conocimiento a WHERE id='bbbbbbbb-0000-4000-8000-000000000001'").stdout;
  checks.push('setup loads archived v1 fixtures and retains independently-added rows for preservation checks');

  const beforeRefusal = snapshot();
  assert.match(query(rollback, 'rollback_test', false).stderr, /Demo rollback refused/);
  assert.deepEqual(snapshot(), beforeRefusal);
  checks.push('missing opt-in refuses without changing any table');

  query(`INSERT INTO virtual_classroom_exports(id,created_by,format,filename,content_type,content_bytes,content_snapshot)
    SELECT 'cccccccc-0000-4000-8000-000000000001', id, 'users_csv', 'later.csv', 'text/csv', ''::bytea, '{}'
    FROM usuarios WHERE id=md5('pep-demo-v1:operator')::uuid;`);
  const beforeUnknown = snapshot();
  const unknown = query(optIn + rollback, 'rollback_test', false);
  assert.match(unknown.stderr, /unrecognized dependent|unknown dependent/i);
  assert.deepEqual(snapshot(), beforeUnknown, 'refused rollback must be atomic');
  checks.push('unknown later dependent row is reported and atomically preserved');

  query("DELETE FROM virtual_classroom_exports WHERE id='cccccccc-0000-4000-8000-000000000001';");

  const courseId = query('SELECT id FROM virtual_classroom_courses LIMIT 1').stdout.trim();
  const laterCourseId = 'cccccccc-0000-4000-8000-000000000002';
  query(`UPDATE virtual_classroom_courses SET id='${laterCourseId}' WHERE id='${courseId}';`);
  const beforeUnknownCourse = snapshot();
  const unknownCourse = query(optIn + rollback, 'rollback_test', false);
  assert.match(unknownCourse.stderr, /unrecognized virtual classroom course/i);
  assert.deepEqual(snapshot(), beforeUnknownCourse, 'course cascade guard must reject before any row changes');
  checks.push('unowned classroom course referencing a v1 schedule is refused before cascade can delete it');
  query(`UPDATE virtual_classroom_courses SET id='${courseId}' WHERE id='${laterCourseId}';`);

  query(`INSERT INTO personal_academico(id,usuario_id,identificacion,nombres,apellidos,maximo_grado_academico,cv_url)
    SELECT 'cccccccc-0000-4000-8000-000000000003', a.usuario_id, 'LATER-STAFF', 'Later', 'Staff',
      'DOCTOR', '/later/no-cv'
    FROM personas_aspirantes a WHERE a.usuario_id IS NOT NULL LIMIT 1;`);
  const beforeUnknownStaff = snapshot();
  const unknownStaff = query(optIn + rollback, 'rollback_test', false);
  assert.match(unknownStaff.stderr, /unrecognized academic staff/i);
  assert.deepEqual(snapshot(), beforeUnknownStaff, 'SET NULL guard must reject before mutating a staff row');
  checks.push('unowned academic staff linked to a v1 user is refused before SET NULL can alter it');
  query("DELETE FROM personal_academico WHERE id='cccccccc-0000-4000-8000-000000000003';");

  const assignment = query('SELECT inscripcion_id,plan_id FROM planes_asignados_inscripcion LIMIT 1').stdout.trim().split('|');
  assert.equal(assignment.length, 2, 'v1 fixture must include an assigned payment plan');
  const [assignedEnrollment, originalPlan] = assignment;
  const unrelatedPlan = 'cccccccc-0000-4000-8000-000000000004';
  query(`INSERT INTO planes_pago_cohorte(id,cohorte_id,nombre,version,modalidad,predeterminado,
      monto_matricula,precio_academico,creado_por)
    SELECT '${unrelatedPlan}', i.cohorte_id, 'Later unrelated plan', 99, 'PAGO_UNICO', false,
      0, 0, md5('pep-demo-v1:operator')::uuid
    FROM inscripciones i WHERE i.id='${assignedEnrollment}';
    UPDATE planes_asignados_inscripcion SET plan_id='${unrelatedPlan}'
    WHERE inscripcion_id='${assignedEnrollment}';`);
  const beforeUnknownPlanAssignment = snapshot();
  const unknownPlanAssignment = query(optIn + rollback, 'rollback_test', false);
  assert.match(unknownPlanAssignment.stderr, /planes_asignados_inscripcion/i);
  assert.deepEqual(snapshot(), beforeUnknownPlanAssignment, 'unknown plan assignment must abort atomically');
  checks.push('later plan assignment is preserved and blocks removal of its referenced v1 enrollment');
  query(`UPDATE planes_asignados_inscripcion SET plan_id='${originalPlan}'
    WHERE inscripcion_id='${assignedEnrollment}'; DELETE FROM planes_pago_cohorte WHERE id='${unrelatedPlan}';`);

  query(optIn + rollback);
  const emptyQueries = [
    "SELECT count(*) FROM cohortes_apertura",
    "SELECT count(*) FROM programacion_componentes_cohorte",
    "SELECT count(*) FROM personas_aspirantes",
    "SELECT count(*) FROM titulos_academicos_aspirante",
    "SELECT count(*) FROM inscripciones",
    "SELECT count(*) FROM planes_pago_cohorte",
    "SELECT count(*) FROM acuerdos_pago_inscripcion",
    "SELECT count(*) FROM obligaciones_pago",
    "SELECT count(*) FROM pagos_inscripcion",
    "SELECT count(*) FROM aplicaciones_pago",
    "SELECT count(*) FROM comprobantes_internos",
    "SELECT count(*) FROM matricula_componentes_snepa",
    "SELECT count(*) FROM expediente_graduacion_certificacion",
    "SELECT count(*) FROM virtual_classroom_courses",
    "SELECT count(*) FROM virtual_classroom_accounts",
    "SELECT count(*) FROM usuarios WHERE username LIKE 'demo.%'",
    "SELECT count(*) FROM personal_academico WHERE identificacion LIKE 'DEMO-%'",
    "SELECT count(*) FROM sedes_ies WHERE codigo_sede='DEMO-CENTRAL'",
    "SELECT count(*) FROM tags_academicos WHERE slug LIKE 'demo-%'",
    "SELECT count(*) FROM areas_conocimiento WHERE slug LIKE 'demo-%'",
    "SELECT count(*) FROM programas_academicos WHERE codigo_interno LIKE 'DEMO-%'",
    "SELECT count(*) FROM componentes_curriculares WHERE codigo LIKE 'DEMO-M%'",
    "SELECT count(*) FROM programas_tags",
    "SELECT count(*) FROM aspirantes_intereses_areas",
  ];
  for (const sql of emptyQueries) assert.equal(count(sql), 0, `v1-owned rows remain: ${sql}`);
  assert.equal(count('SELECT count(*) FROM cohortes_apertura'), 0);
  assert.equal(count('SELECT count(*) FROM inscripciones'), 0);
  assert.equal(count('SELECT count(*) FROM programas_academicos WHERE codigo_interno LIKE \'DEMO-%\''), 0);
  assert.equal(count('SELECT count(*) FROM areas_conocimiento WHERE slug LIKE \'demo-%\''), 0);
  assert.equal(query("SELECT to_jsonb(p) FROM programas_academicos p WHERE id='aaaaaaaa-0000-4000-8000-000000000002'").stdout, originalProgram);
  assert.equal(query("SELECT to_jsonb(a) FROM areas_conocimiento a WHERE id='aaaaaaaa-0000-4000-8000-000000000001'").stdout, originalArea);
  assert.equal(query("SELECT to_jsonb(p) FROM programas_academicos p WHERE id='bbbbbbbb-0000-4000-8000-000000000002'").stdout, lateProgram);
  assert.equal(query("SELECT to_jsonb(a) FROM areas_conocimiento a WHERE id='bbbbbbbb-0000-4000-8000-000000000001'").stdout, laterArea);
  assert.equal(count("SELECT count(*) FROM roles WHERE nombre IN ('COORDINADOR','DOCENTE','ESTUDIANTE')"), 3);
  const afterRemoval = snapshot();
  query(optIn + rollback);
  assert.deepEqual(snapshot(), afterRemoval, 'repeated rollback must be a no-op');
  checks.push('rollback removes exact v1-owned rows, preserves originals and later records, and repeats as a no-op');
  console.log(JSON.stringify({ passed: true, checks, archivedLoader: '08a6999:database/demo_bulk_load.sql' }, null, 2));
} finally {
  if (owned) {
    const removed = docker(['rm', '-f', '-v', container]);
    assert.equal(removed.status, 0, 'failed to remove owned disposable test container');
  }
}
