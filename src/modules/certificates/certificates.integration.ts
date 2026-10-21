/** Explicit local integration runner: creates and removes only its own PostgreSQL container and temp files.
 * Run: node --import tsx src/modules/certificates/certificates.integration.ts
 * Requires an already available postgres:16-alpine image; never pulls images or reads project .env.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { Duplex } from 'node:stream';

let integrationStage = 'initialization';
async function main() {
  const root = path.resolve(__dirname, '../../..');
  const runId = randomBytes(6).toString('hex'), dbName = `uncsm_test_cert_${runId}`, containerName = `uncsm-cert-${runId}`;
  const scratch = await mkdtemp(path.join(tmpdir(), 'uncsm-certificate-integration-'));
  const password = randomBytes(24).toString('hex');
  let containerCreated = false, pool: any;
  const checks: string[] = [];
  function docker(args: string[]): string {
    const result = spawnSync('/usr/local/bin/docker', ['--host', 'unix:///var/run/docker.sock', ...args], { encoding: 'utf8', timeout: 30000 });
    if (result.status !== 0) throw new Error(`Isolated Docker operation failed (${args[0]}): ${result.stderr.trim() || 'unavailable'}`);
    return result.stdout.trim();
  }
  try {
    const schema = await readFile(path.join(root, 'database/schema.sql'), 'utf8');
    const migration = await readFile(path.join(root, 'database/migrations/20261021_certificate_registry.sql'), 'utf8');
    docker(['run', '--pull=never', '--rm', '-d', '--name', containerName, '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${dbName}`, '-p', '127.0.0.1::5432', 'postgres:16-alpine']);
    containerCreated = true;
    const port = Number(docker(['port', containerName, '5432/tcp']).split(':').at(-1));
    assert.ok(Number.isInteger(port) && port > 0);
    for (let attempt = 0; attempt < 50; attempt++) {
      const ready = spawnSync('/usr/local/bin/docker', ['--host', 'unix:///var/run/docker.sock', 'exec', containerName, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', dbName], { encoding: 'utf8' });
      if (ready.status === 0) break;
      if (attempt === 49) throw new Error('Isolated PostgreSQL did not become ready');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'postgres', DB_PASSWORD: password, DB_NAME: dbName, JWT_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'), NODE_ENV: 'test' });
    process.chdir(scratch);
    const dbModule = await import(pathToFileURL(path.join(root, 'src/db/pool.ts')).href);
    pool = dbModule.pool;
    const q = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows;
    const one = async (sql: string, params: unknown[] = []) => (await q(sql, params))[0];
    assert.equal((await one('SELECT current_database() AS name')).name, dbName);
    assert.match(dbName, /^uncsm_test_cert_[a-f0-9]{12}$/);
    integrationStage = 'initial schema';
    await q(schema.split('-- Technical registry of existing institutional documents; no automatic issuance.')[0]);
    await q("INSERT INTO roles(nombre) VALUES ('ESTUDIANTE'),('SUPER_ADMIN'),('ISSUER'),('REVOKER')");
    await q("INSERT INTO permisos(codigo,nombre) VALUES ('TITULO_EMITIR','Issue')");
    await q("INSERT INTO roles_permisos(rol_id,permiso_id) SELECT r.id,p.id FROM roles r,permisos p WHERE r.nombre='ISSUER' AND p.codigo='TITULO_EMITIR'");
    const { app } = await import(pathToFileURL(path.join(root, 'src/app.ts')).href);
    async function request(target: string, method = 'GET', body?: unknown, token?: string): Promise<any> {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [], socket = new Duplex({ read() {}, write(chunk, _enc, done) { chunks.push(Buffer.from(chunk)); done(); } });
        socket.on('error', reject);
        socket.on('finish', () => {
          const raw = Buffer.concat(chunks), split = raw.indexOf('\r\n\r\n'), header = raw.subarray(0, split).toString(), bytes = raw.subarray(split + 4);
          try { resolve({ status: Number(header.split(' ')[1]), bytes, body: header.includes('application/json') ? JSON.parse(bytes.toString()) : null }); } catch (error) { reject(error); }
        });
        createServer(app).emit('connection', socket);
        const payload = body === undefined ? '' : JSON.stringify(body);
        socket.push(`${method} ${target} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n${token ? `Authorization: Bearer ${token}\r\n` : ''}\r\n${payload}`);
      });
    }
    integrationStage = 'account fixtures';
    const users: any = {}, tokens: any = {};
    for (const [name, role] of [['student','ESTUDIANTE'], ['other','ESTUDIANTE'], ['issuer','ISSUER'], ['revoker','REVOKER']]) {
      let response = await request('/api/auth/register', 'POST', { email: `${name}@certificate.test`, password: 'IsolatedTestPass123', nombres: name, apellidos: 'Test' });
      assert.equal(response.status, 201, JSON.stringify(response.body)); users[name] = response.body.data.id;
      if (role !== 'ESTUDIANTE') await q('UPDATE usuarios SET rol_id=(SELECT id FROM roles WHERE nombre=$1) WHERE id=$2', [role, users[name]]);
      response = await request('/api/auth/login', 'POST', { email: `${name}@certificate.test`, password: 'IsolatedTestPass123' });
      assert.equal(response.status, 200); tokens[name] = response.body.data.tokens.accessToken;
    }
    integrationStage = 'academic fixtures';
    const area = await one("INSERT INTO areas_conocimiento(nombre,slug) VALUES ('Certificate test','certificate-test') RETURNING id");
    const campus = await one("INSERT INTO sedes_ies(codigo_sede,nombre,tipo_sede) VALUES ('CERT','Certificate test','SEDE_CENTRAL') RETURNING id");
    const staff = await one("INSERT INTO personal_academico(identificacion,nombres,apellidos,maximo_grado_academico,cv_url) VALUES ('CERT-STAFF','Test','Coordinator','MASTER','/uploads/documentos/cv.pdf') RETURNING id");
    const program = await one("INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,titulo_o_certificado_otorgado,visible_en_web) VALUES ('CERT','Immutable test program','certificate-program','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,'Test Certificate',true) RETURNING id", [area.id]);
    const applicant = await one("INSERT INTO personas_aspirantes(usuario_id,tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ($1,'PASAPORTE','CERT-OWNER','Original','Recipient','2000-01-01','student@certificate.test','12345678') RETURNING id", [users.student]);
    const dossiers: any[] = [];
    for (let index = 0; index < 2; index++) {
      const cohort = await one("INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte,estado_cohorte) VALUES ($1,$2,'PRESENCIAL',$3,1,$4,current_date-10,current_date-5,current_date-4,current_date-1,0,'FINALIZADA_PENDIENTE_EVAL') RETURNING id", [program.id, campus.id, `CERT-${index}`, staff.id]);
      const enrollment = await one("INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES ($1,$2,$3,'EGRESADO') RETURNING id", [`CERT-${index}`, applicant.id, cohort.id]);
      dossiers.push(await one("INSERT INTO expediente_graduacion_certificacion(inscripcion_id,tipo_documento_final,fecha_emision,codigo_registro_titulo_emitido,documento_final_url) VALUES ($1,'CERTIFICADO_APROBACION',$2,$3,$4) RETURNING *", [enrollment.id, index === 0 ? '2025-06-10' : null, index === 0 ? 'CERT-LEGACY' : null, '/uploads/documentos/fixture.pdf']));
    }
    // Structurally valid PDF fixture. It is a technical test document, not an official template.
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'];
    let pdf = '%PDF-1.4\n'; const offsets: number[] = [];
    for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${object}\nendobj\n`; }
    const xref = Buffer.byteLength(pdf); pdf += `xref\n0 4\n0000000000 65535 f \n${offsets.map(x=>`${String(x).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    await mkdir('uploads/documentos', { recursive: true }); await writeFile('uploads/documentos/fixture.pdf', pdf);
    async function snapshot() {
      const tables = ['expediente_graduacion_certificacion','inscripciones'];
      if ((await one("SELECT to_regclass('certificados_registro') IS NOT NULL AS available")).available) tables.push('certificados_registro','certificados_eventos');
      const data = [];
      for (const table of tables) data.push(await q(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY id`));
      return createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }
    async function denied(target: string, method: string, body: unknown, actor: string | undefined, status: number) {
      const before = await snapshot(), response = await request(target, method, body, actor ? tokens[actor] : undefined);
      assert.equal(response.status, status, JSON.stringify(response.body)); assert.equal(await snapshot(), before, 'Rejected operation changed stored state');
    }
    integrationStage = 'pre-migration behavior';
    await denied(`/api/graduation/expediente/${dossiers[1].id}/issue`, 'POST', {}, 'issuer', 503);
    let response = await request('/api/graduation/verify/CERT-LEGACY');
    assert.equal(response.status, 200); assert.equal(response.body.data.registro_digital_disponible, false); assert.equal(response.body.data.autenticidad_verificada, false);
    checks.push('missing registry fails issuance before any write; legacy verification explicitly unavailable');
    integrationStage = 'registry migration';
    await q(migration); await q(migration);
    await q("INSERT INTO roles_permisos(rol_id,permiso_id) SELECT r.id,p.id FROM roles r,permisos p WHERE r.nombre='REVOKER' AND p.codigo='CERTIFICADO_REVOCAR'");
    await q(`CREATE FUNCTION fail_test_certificate_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated audit failure'; END; $$`);
    const failAudit = async () => q('CREATE TRIGGER fail_test_audit BEFORE INSERT ON certificados_eventos FOR EACH ROW EXECUTE FUNCTION fail_test_certificate_audit()');
    const restoreAudit = async () => q('DROP TRIGGER fail_test_audit ON certificados_eventos');
    integrationStage = 'legacy registration and rollback';
    await failAudit(); await denied(`/api/certificates/expediente/${dossiers[0].id}/register`, 'POST', {}, 'issuer', 500); await restoreAudit();
    response = await request(`/api/certificates/expediente/${dossiers[0].id}/register`, 'POST', {}, tokens.issuer);
    assert.equal(response.status, 201, JSON.stringify(response.body)); const legacy = response.body.data;
    assert.match(String(legacy.fecha_emision), /^2025-06-10/);
    await denied(`/api/certificates/expediente/${dossiers[0].id}/register`, 'POST', {}, 'issuer', 409);
    checks.push('migration is idempotent; legacy registration and audit are atomic and duplicate-safe');
    integrationStage = 'new issuance and rollback';
    await failAudit(); await denied(`/api/graduation/expediente/${dossiers[1].id}/issue`, 'POST', {}, 'issuer', 500); await restoreAudit();
    response = await request(`/api/graduation/expediente/${dossiers[1].id}/issue`, 'POST', {}, tokens.issuer);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const issued = await one('SELECT * FROM certificados_registro WHERE expediente_id=$1', [dossiers[1].id]);
    assert.equal((await one('SELECT COUNT(*)::int AS n FROM certificados_eventos WHERE certificado_id=$1 AND accion=$2', [issued.id,'EMITIDO'])).n, 1);
    await q("UPDATE personas_aspirantes SET nombres='Changed' WHERE id=$1", [applicant.id]);
    response = await request(`/api/certificates/verify/${issued.token_publico}`);
    assert.equal(response.status, 200); assert.equal(response.body.data.titular_nombre, 'Original Recipient');
    for (const key of ['id','expediente_id','titular_usuario_id','documento_url','documento_sha256','motivo_revocacion']) assert.equal(response.body.data[key], undefined);
    try { await q('UPDATE certificados_registro SET titular_nombre=$1 WHERE id=$2', ['Forged',issued.id]); assert.fail('Snapshot mutation succeeded'); } catch (error: any) { assert.equal(error.code,'23514'); }
    assert.equal((await request('/api/certificates/me','GET',undefined,tokens.student)).body.total,2);
    assert.equal((await request('/api/certificates/me','GET',undefined,tokens.other)).body.total,0);
    await denied(`/api/certificates/${issued.id}/download`,'GET',undefined,'other',404);
    response = await request(`/api/certificates/${issued.id}/download`,'GET',undefined,tokens.student); assert.equal(response.status,200); assert.equal(response.bytes.toString(),pdf);
    checks.push('issuance, audit and enrollment are atomic; snapshot is immutable; owner and public privacy enforced');
    integrationStage = 'integrity and revocation';
    await writeFile('uploads/documentos/fixture.pdf',pdf.replace('100 100','200 200'));
    await denied(`/api/certificates/verify/${issued.token_publico}`,'GET',undefined,undefined,409);
    await denied(`/api/certificates/${issued.id}/download`,'GET',undefined,'student',409);
    await denied('/uploads/documentos/fixture.pdf','GET',undefined,'student',409);
    await writeFile('uploads/documentos/fixture.pdf',pdf);
    await denied(`/api/certificates/${legacy.id}/revoke`,'POST',{motivo:'Test'},'issuer',403);
    await failAudit(); await denied(`/api/certificates/${legacy.id}/revoke`,'POST',{motivo:'Rollback reason'},'revoker',500); await restoreAudit();
    const revocations = await Promise.all([request(`/api/certificates/${legacy.id}/revoke`,'POST',{motivo:'Institutional correction'},tokens.revoker), request(`/api/certificates/${legacy.id}/revoke`,'POST',{motivo:'Concurrent correction'},tokens.revoker)]);
    assert.deepEqual(revocations.map(result=>result.status).sort(),[200,409]);
    assert.equal((await one("SELECT COUNT(*)::int AS n FROM certificados_eventos WHERE certificado_id=$1 AND accion='REVOCADO'",[legacy.id])).n,1);
    response = await request(`/api/certificates/verify/${legacy.token_publico}`); assert.equal(response.status,200); assert.equal(response.body.data.estado,'REVOCADO'); assert.equal(response.body.data.integridad_verificada,false);
    response = await request('/api/graduation/verify/CERT-LEGACY'); assert.equal(response.status,200); assert.equal(response.body.data.autenticidad_verificada,false); assert.equal(response.body.data.estado_certificado,'REVOCADO');
    await denied(`/api/certificates/${legacy.id}/download`,'GET',undefined,'student',409);
    await denied('/uploads/documentos/fixture.pdf','GET',undefined,'student',409);
    checks.push('tampering and static bypass fail closed; dedicated revocation permission, atomic audit and concurrent revoke enforced');

    integrationStage = 'independent parent filters and academic revalidation';
    await q("INSERT INTO permisos(codigo,nombre) VALUES ('USUARIO_GESTIONAR','Users'),('INSCRIPCION_VALIDAR','Admissions'),('NOTA_MODIFICAR','Grades')");
    await q("INSERT INTO roles_permisos(rol_id,permiso_id) SELECT r.id,p.id FROM roles r,permisos p WHERE r.nombre='ISSUER' AND p.codigo IN ('USUARIO_GESTIONAR','INSCRIPCION_VALIDAR','NOTA_MODIFICAR')");
    response = await request('/api/users?limit=100','GET',undefined,tokens.issuer);
    assert.equal(response.status,200,JSON.stringify(response.body)); assert.equal(response.body.data.total,4); assert.equal(response.body.data.items.length,4);
    response = await request('/api/users?rol=ESTUDIANTE&limit=100','GET',undefined,tokens.issuer);
    assert.equal(response.status,200,JSON.stringify(response.body)); assert.equal(response.body.data.total,2); assert.equal(response.body.data.items.length,2); assert.ok(response.body.data.items.every((u:any)=>u.rol==='ESTUDIANTE'));
    response = await request('/api/users?rol=ABSENT','GET',undefined,tokens.issuer); assert.equal(response.body.data.total,0);
    const degree = await one("INSERT INTO titulos_academicos_aspirante(aspirante_id,nivel_titulo,denominacion_titulo,institucion_emisora,fecha_emision,titulo_pdf_url,estado_validacion) VALUES ($1,'GRADO','Original Degree','Institution','2020-01-01','/uploads/documentos/fixture.pdf','VALIDADO') RETURNING *",[applicant.id]);
    const degreeState = async () => JSON.stringify(await one('SELECT * FROM titulos_academicos_aspirante WHERE id=$1',[degree.id]));
    let degreeBefore=await degreeState(); response=await request(`/api/applicants/degrees/${degree.id}`,'PUT',{},tokens.student); assert.equal(response.status,200,JSON.stringify(response.body)); assert.equal(await degreeState(),degreeBefore);
    response=await request(`/api/applicants/degrees/${degree.id}`,'PUT',{estado_validacion:'VALIDADO'},tokens.student); assert.equal(response.status,400); assert.equal(await degreeState(),degreeBefore);
    response=await request(`/api/applicants/degrees/${degree.id}`,'PUT',{denominacion_titulo:'Edited Degree'},tokens.student); assert.equal(response.status,200,JSON.stringify(response.body)); assert.equal((await one('SELECT estado_validacion FROM titulos_academicos_aspirante WHERE id=$1',[degree.id])).estado_validacion,'PENDIENTE');
    checks.push('independent PostgreSQL user role filter/count, unchanged unfiltered list, degree empty no-op, forbidden state and edit revalidation');
    integrationStage = 'independent academic issuance gates and concurrent issue';
    const thirdCohort=await one("INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte,estado_cohorte) VALUES ($1,$2,'PRESENCIAL','CERT-INDEPENDENT',3,$3,current_date-10,current_date-5,current_date-4,current_date-1,0,'FINALIZADA_PENDIENTE_EVAL') RETURNING id",[program.id,campus.id,staff.id]);
    const thirdEnrollment=await one("INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES ('CERT-INDEPENDENT',$1,$2,'MATRICULADO_ACTIVO') RETURNING id",[applicant.id,thirdCohort.id]);
    const thirdDossier=await one("INSERT INTO expediente_graduacion_certificacion(inscripcion_id,tipo_documento_final,documento_final_url) VALUES ($1,'CERTIFICADO_APROBACION','/uploads/documentos/independent.pdf') RETURNING id",[thirdEnrollment.id]);
    await writeFile('uploads/documentos/independent.pdf',pdf);
    await denied(`/api/graduation/expediente/${thirdDossier.id}/issue`,'POST',{},'issuer',409);
    await q("UPDATE inscripciones SET estado='EGRESADO' WHERE id=$1",[thirdEnrollment.id]);
    await q("UPDATE programas_academicos SET idioma_egreso_requerido='B2' WHERE id=$1",[program.id]);
    await denied(`/api/graduation/expediente/${thirdDossier.id}/issue`,'POST',{},'issuer',400);
    await q("UPDATE expediente_graduacion_certificacion SET nivel_idioma_alcanzado='B2',idioma_validado=true WHERE id=$1",[thirdDossier.id]);
    await q('UPDATE programas_academicos SET num_publicaciones_requeridas=1 WHERE id=$1',[program.id]);
    await denied(`/api/graduation/expediente/${thirdDossier.id}/issue`,'POST',{},'issuer',400);
    await q('UPDATE programas_academicos SET num_publicaciones_requeridas=0 WHERE id=$1',[program.id]);
    const concurrentIssue=await Promise.all([request(`/api/graduation/expediente/${thirdDossier.id}/issue`,'POST',{},tokens.issuer),request(`/api/graduation/expediente/${thirdDossier.id}/issue`,'POST',{},tokens.issuer)]);
    assert.deepEqual(concurrentIssue.map(x=>x.status).sort(),[200,400]);
    const thirdCertificate=await one('SELECT * FROM certificados_registro WHERE expediente_id=$1',[thirdDossier.id]);
    assert.equal((await one("SELECT count(*)::int AS n FROM certificados_eventos WHERE certificado_id=$1 AND accion='EMITIDO'",[thirdCertificate.id])).n,1);
    await q("UPDATE programas_academicos SET nombre='Later Program Name' WHERE id=$1",[program.id]);
    response=await request(`/api/certificates/verify/${thirdCertificate.token_publico}`); assert.equal(response.status,200);assert.equal(response.body.data.programa_nombre,'Immutable test program');
    checks.push('independent enrolled/language/publication gates preserve data; concurrent issue creates exactly one registry/audit; program snapshot immutable');
    integrationStage = 'independent enrollment program filter and grade audit join';
    const secondProgram=await one("INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,titulo_o_certificado_otorgado) VALUES ('OTHER','Other','other','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,'Other') RETURNING id",[area.id]);
    const fourthCohort=await one("INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte) VALUES ($1,$2,'PRESENCIAL','OTHER',1,$3,current_date-10,current_date-5,current_date-4,current_date-1,0) RETURNING id",[secondProgram.id,campus.id,staff.id]);
    await q("INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id) VALUES ('OTHER',$1,$2)",[applicant.id,fourthCohort.id]);
    response=await request('/api/enrollments?limit=100','GET',undefined,tokens.issuer);assert.equal(response.status,200);assert.equal(response.body.pagination.total,4);assert.equal(response.body.data.length,4);
    response=await request(`/api/enrollments?programa_id=${program.id}&limit=100`,'GET',undefined,tokens.issuer);assert.equal(response.status,200);assert.equal(response.body.pagination.total,3);assert.equal(response.body.data.length,3);
    response=await request(`/api/enrollments?programa_id=${secondProgram.id}&limit=100`,'GET',undefined,tokens.issuer);assert.equal(response.status,200);assert.equal(response.body.pagination.total,1);assert.equal(response.body.data[0].cohorte_id,fourthCohort.id);
    const component=await one("INSERT INTO componentes_curriculares(programa_id,codigo,nombre,horas) VALUES ($1,'AUDIT','Audit',8) RETURNING id",[program.id]);
    const schedule=await one('INSERT INTO programacion_componentes_cohorte(cohorte_id,componente_id) VALUES ($1,$2) RETURNING id',[thirdCohort.id,component.id]);
    const grade=await one('INSERT INTO matricula_componentes_snepa(inscripcion_id,programacion_componente_id,componente_id) VALUES ($1,$2,$3) RETURNING id',[thirdEnrollment.id,schedule.id,component.id]);
    await q("INSERT INTO notas_snepa_logs(matricula_componente_id,nota_anterior,nota_nueva,motivo_modificacion,modificado_por_usuario_id) VALUES ($1,70,80,'Test audit',$2)",[grade.id,users.issuer]);
    response=await request(`/api/grades/${grade.id}/logs`,'GET',undefined,tokens.issuer);assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.data[0].modificado_por_rol,'ISSUER');
    checks.push('independent PostgreSQL enrollment program filter/count and unfiltered compatibility; grade audit joins real role');

    console.log(JSON.stringify({ complete: true, checks }, null, 2));
  } finally {
    try { if (pool) await pool.end(); }
    finally {
      process.chdir(root);
      try { if (containerCreated) docker(['stop', '-t', '1', containerName]); }
      finally { await rm(scratch, { recursive: true, force: true }); }
    }
  }
}
main().catch(error => { console.error(`Certificate integration failed at ${integrationStage}: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; });
