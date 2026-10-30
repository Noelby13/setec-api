/** Tests only owned disposable PostgreSQL databases; never loads .env. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const load = readFileSync(new URL('database/demo_bulk_load.sql', root), 'utf8');
const schema = readFileSync(new URL('database/schema.sql', root), 'utf8');
const initialSchema = readFileSync(new URL('database/init.sql', root), 'utf8');
const container = `pep-demo-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const checks = [];
let owned = false;
function docker(args, input) {
  return spawnSync('/usr/local/bin/docker', ['--host', 'unix:///var/run/docker.sock', ...args],
    { input, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
}
function query(sql, database = 'demo_test', expectedSuccess = true) {
  const result = docker(['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], sql);
  if (expectedSuccess) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0, 'expected rejected load');
  return result;
}
function count(sql, database) { return Number(query(sql, database).stdout.trim()); }
function snapshot(database = 'demo_test') {
  const tables = query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename", database)
    .stdout.trim().split('\n');
  return tables.map(table => [table, query(`SELECT md5(coalesce(string_agg(to_jsonb(t)::text,
    E'\\n' ORDER BY to_jsonb(t)::text),'')) FROM "${table}" t`, database).stdout.trim()]);
}
const enabled = "SET demo.allow_seed='yes';\n";
try {
  const started = docker(['run', '--pull=never', '--rm', '-d', '--network', 'none', '--name', container,
    '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=demo_test', 'postgres:16-alpine']);
  assert.equal(started.status, 0, started.stderr);
  owned = true;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (docker(['exec', container, 'pg_isready', '-U', 'postgres', '-d', 'demo_test']).status === 0) {
      ready = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'owned PostgreSQL readiness timed out');
  query(schema);
  const before = snapshot();
  const refused = query(load, 'demo_test', false);
  assert.match(refused.stderr, /Demo load refused/);
  assert.deepEqual(snapshot(), before);
  checks.push('explicit opt-in refusal leaves all table contents unchanged');

  query(enabled + load);
  assert.equal(count('SELECT count(*) FROM programas_academicos'), 32);
  assert.equal(count('SELECT count(*) FROM areas_conocimiento'), 8);
  assert.equal(count('SELECT count(*) FROM cohortes_apertura'), 96);
  assert.equal(count('SELECT count(*) FROM inscripciones'), 1920);
  assert.equal(count('SELECT count(*) FROM componentes_curriculares'), 128);
  assert.equal(count('SELECT count(*) FROM matricula_componentes_snepa'), 3584);
  assert.equal(count('SELECT count(*) FROM expediente_graduacion_certificacion'), 640);
  assert.equal(count('SELECT count(*) FROM usuarios WHERE activo'), 0);
  assert.equal(count("SELECT count(*) FROM usuarios WHERE password_hash <> '!DEMO-LOGIN-DISABLED!'"), 0);
  assert.equal(count('SELECT count(*) FROM roles_permisos'), 0);
  assert.equal(count("SELECT count(*) FROM programas_academicos WHERE visible_en_web AND estado_vigencia='ACTIVO'"), 32);
  checks.push('empty schema receives 32 visible synthetic offerings, 96 cohorts and 1,920 students without login access');

  assert.equal(count(`SELECT count(*) FROM pagos_inscripcion p WHERE p.total_pagado <>
    (SELECT coalesce(sum(a.importe),0) FROM aplicaciones_pago a WHERE a.pago_id=p.id)`), 0);
  assert.equal(count(`SELECT count(*) FROM obligaciones_pago o WHERE o.importe <
    (SELECT coalesce(sum(a.importe),0) FROM aplicaciones_pago a WHERE a.obligacion_id=o.id)`), 0);
  assert.equal(count(`SELECT count(*) FROM pagos_inscripcion p LEFT JOIN comprobantes_internos c ON c.pago_id=p.id
    WHERE (p.estado='APROBADO') <> (c.id IS NOT NULL)`), 0);
  assert.equal(count(`SELECT count(*) FROM acuerdos_pago_inscripcion a WHERE a.monto_matricula+a.precio_academico <>
    (SELECT coalesce(sum(o.importe),0) FROM obligaciones_pago o WHERE o.acuerdo_id=a.id)`), 0);
  assert.equal(count(`SELECT count(*) FROM matricula_componentes_snepa g
    JOIN inscripciones i ON i.id=g.inscripcion_id JOIN programacion_componentes_cohorte s ON s.id=g.programacion_componente_id
    WHERE i.cohorte_id<>s.cohorte_id OR g.componente_id<>s.componente_id OR g.aprobado<>(g.calificacion_cuantitativa>=70)`), 0);
  assert.equal(count(`SELECT count(*) FROM cohortes_apertura c JOIN programas_academicos p ON p.id=c.programa_id
    WHERE c.fecha_fin_inscripcion>=c.fecha_inicio_clases OR c.fecha_fin_clases<c.fecha_inicio_clases
    OR (p.es_ciencias_salud AND c.modalidad='VIRTUAL')`), 0);
  const receipt = JSON.parse(query('SELECT datos FROM comprobantes_internos LIMIT 1').stdout);
  const { receiptPdf } = await import(new URL('src/modules/billing/billing.receipt.ts', root));
  assert.ok(receiptPdf({ numero: '1', emitido_en: new Date(), datos: receipt }).subarray(0, 5).equals(Buffer.from('%PDF-')));
  checks.push('actual constraints, coherent grades, exact financial allocations and a renderable internal receipt');
  const once = snapshot();
  const sequence = query('SELECT last_value FROM comprobantes_internos_numero_seq').stdout;
  query(enabled + load);
  assert.deepEqual(snapshot(), once);
  assert.equal(query('SELECT last_value FROM comprobantes_internos_numero_seq').stdout, sequence);
  checks.push('repeat execution preserves every row and receipt sequence');

  query(`INSERT INTO areas_conocimiento(nombre,slug) VALUES('Existing area','existing-area');
    INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,
      horas_totales,titulo_o_certificado_otorgado,visible_en_web,estado_vigencia,precio_total_referencia)
      SELECT 'EXISTING','Preserved career','existing-career','EDUCACION_PERMANENTE','CURSO_EXTENSION',id,
        40,'Preserved certificate',false,'PAUSADO',0 FROM areas_conocimiento WHERE slug='existing-area';`);
  const preserved = query("SELECT to_jsonb(p) FROM programas_academicos p WHERE codigo_interno='EXISTING'").stdout;
  query(enabled + load);
  assert.equal(query("SELECT to_jsonb(p) FROM programas_academicos p WHERE codigo_interno='EXISTING'").stdout, preserved);
  assert.equal(count('SELECT count(*) FROM inscripciones'), 1980);
  assert.equal(count(`SELECT count(*) FROM componentes_curriculares m JOIN programas_academicos p ON p.id=m.programa_id
    WHERE p.codigo_interno='EXISTING'`), 0);
  assert.equal(count(`SELECT count(*) FROM obligaciones_pago o JOIN inscripciones i ON i.id=o.inscripcion_id
    JOIN cohortes_apertura c ON c.id=i.cohorte_id JOIN programas_academicos p ON p.id=c.programa_id
    WHERE p.codigo_interno='EXISTING' AND o.tipo='ACADEMICO'`), 0);
  checks.push('new existing zero-price hidden career receives 60 records without changing its definition or curriculum');

  query('CREATE DATABASE demo_rollback; CREATE DATABASE demo_outdated;');
  query(schema, 'demo_rollback');
  const rollbackBefore = snapshot('demo_rollback');
  const failed = query(enabled + load.replace('-- Empty tables', "DO $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;\n-- Empty tables"), 'demo_rollback', false);
  assert.match(failed.stderr, /injected failure/);
  assert.deepEqual(snapshot('demo_rollback'), rollbackBefore);
  query(initialSchema, 'demo_outdated');
  const outdatedBefore = snapshot('demo_outdated');
  assert.match(query(enabled + load, 'demo_outdated', false).stderr, /Current schema required/);
  assert.deepEqual(snapshot('demo_outdated'), outdatedBefore);
  checks.push('late failure rolls back the complete dataset; outdated schema is rejected without changing rows');
  console.log(JSON.stringify({ passed: true, checks, source: fileURLToPath(new URL('database/demo_bulk_load.sql', root)) }, null, 2));
} finally {
  if (owned) {
    const removed = docker(['rm', '-f', '-v', container]);
    assert.equal(removed.status, 0, 'failed to remove owned disposable test container');
  }
}
