/** Disposable local PostgreSQL proof. Uses only a cached image and its own database/container. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function main() {
  const root = path.resolve(__dirname, '../../..');
  const originalCwd = process.cwd();
  const runId = randomBytes(6).toString('hex');
  const database = `uncsm_test_vclass_${runId}`;
  const container = `uncsm-vclass-${runId}`;
  const password = randomBytes(24).toString('hex');
  const scratch = await mkdtemp(path.join(tmpdir(), 'uncsm-vclass-integration-'));
  let created = false;
  let pool: import('pg').Pool | undefined;
  const checks: string[] = [];
  const regressionResults: { name: string; passed: boolean; detail: string }[] = [];
  function docker(args: string[]) {
    const result = spawnSync('/usr/local/bin/docker', ['--host','unix:///var/run/docker.sock',...args],
      { encoding: 'utf8',timeout: 30000 });
    if (result.status !== 0) throw new Error(`Owned Docker operation ${args[0]} failed: ${result.stderr.trim() || 'unavailable'}`);
    return result.stdout.trim();
  }
  try {
    const schema = await readFile(path.join(root,'database/schema.sql'),'utf8');
    const migration = await readFile(path.join(root,'database/migrations/20261029_virtual_classroom.sql'),'utf8');
    const proposalsMigration = await readFile(path.join(root,'database/migrations/20261029_virtual_classroom_proposals.sql'),'utf8');
    docker(['run','--pull=never','--rm','-d','--name',container,'-e',`POSTGRES_PASSWORD=${password}`,
      '-e',`POSTGRES_DB=${database}`,'-p','127.0.0.1::5432','postgres:16-alpine']);
    created = true;
    const port = Number(docker(['port',container,'5432/tcp']).split(':').at(-1));
    assert.ok(Number.isInteger(port) && port > 0);
    let ready = false;
    for (let attempt=0;attempt<50;attempt++) {
      ready = spawnSync('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock','exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-d',database],
        { encoding:'utf8',timeout:5000 }).status === 0;
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve,100));
    }
    assert.ok(ready,'isolated PostgreSQL readiness timed out');
    Object.assign(process.env,{ DB_HOST:'127.0.0.1',DB_PORT:String(port),DB_USER:'postgres',DB_PASSWORD:password,
      DB_NAME:database,NODE_ENV:'test' });
    process.chdir(scratch);
    pool = (await import(pathToFileURL(path.join(root,'src/db/pool.ts')).href)).pool;
    const q = async (sql: string, values: unknown[] = []) => (await pool!.query(sql,values)).rows;
    const one = async (sql: string, values: unknown[] = []) => (await q(sql,values))[0];
    assert.equal((await one('SELECT current_database() AS name')).name,database);
    assert.match(database,/^uncsm_test_vclass_[a-f0-9]{12}$/);
    await q(schema);
    await q(migration); await q(migration);
    await q(proposalsMigration); await q(proposalsMigration);
    await q("INSERT INTO roles(nombre) VALUES ('SUPER_ADMIN') ON CONFLICT(nombre) DO NOTHING");
    const role = await one("SELECT id FROM roles WHERE nombre='SUPER_ADMIN'");
    const admin = await one("INSERT INTO usuarios(email,password_hash,nombres,apellidos,rol_id) VALUES ('admin@vclass.test','unused','Admin','Test',$1) RETURNING id",[role.id]);
    const area = await one("INSERT INTO areas_conocimiento(nombre,slug) VALUES ('VClass test','vclass-test') RETURNING id");
    const campus = await one("INSERT INTO sedes_ies(codigo_sede,nombre,tipo_sede) VALUES ('VCLASS','VClass test','SEDE_CENTRAL') RETURNING id");
    const teacher = await one("INSERT INTO personal_academico(usuario_id,identificacion,nombres,apellidos,maximo_grado_academico,cv_url) VALUES ($1,'VCLASS-TEACHER','Docente','Prueba','MASTER','/private/test') RETURNING id",[admin.id]);
    const program = await one("INSERT INTO programas_academicos(codigo_interno,nombre,slug,categoria,subtipo,area_conocimiento_id,horas_totales,titulo_o_certificado_otorgado) VALUES ('VCLASS','Programa Ágil','vclass-program','EDUCACION_PERMANENTE','CURSO_EXTENSION',$1,8,'Certificado') RETURNING id",[area.id]);
    const component = await one("INSERT INTO componentes_curriculares(programa_id,codigo,nombre,horas) VALUES ($1,'VCLASS','Gestión Pública',8) RETURNING id",[program.id]);
    const cohorts: any[] = [];
    const schedules: any[] = [];
    for (let index=0;index<2;index++) {
      const cohort = await one(`INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,
        fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte)
        VALUES($1,$2,'PRESENCIAL',$3,1,$4,'2026-10-01','2026-10-20','2026-11-01','2027-01-01',0) RETURNING id`,[program.id,campus.id,`VCLASS-${index}`,teacher.id]);
      cohorts.push(cohort);
      schedules.push(await one(`INSERT INTO programacion_componentes_cohorte(cohorte_id,componente_id,docente_titular_id,fecha_inicio,fecha_fin)
        VALUES($1,$2,$3,'2026-11-01','2026-11-30') RETURNING id`,[cohort.id,component.id,teacher.id]));
    }
    const linkedUser = await one("INSERT INTO usuarios(email,username,password_hash,nombres,apellidos,rol_id) VALUES ('lucia@vclass.test','web.lucia','unused','Lucía','Álvarez',$1) RETURNING id",[role.id]);
    const applicant = await one("INSERT INTO personas_aspirantes(usuario_id,tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ($1,'PASAPORTE','VCLASS-STUDENT','Lucía','Álvarez','2000-01-01','lucia@vclass.test','12345678') RETURNING id",[linkedUser.id]);
    for (const [index,cohort] of cohorts.entries()) await q("INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES ($1,$2,$3,'MATRICULADO_ACTIVO')",[`VCLASS-STUDENT-${index}`,applicant.id,cohort.id]);
    const pending = await one("INSERT INTO personas_aspirantes(tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono) VALUES ('PASAPORTE','VCLASS-PENDING','No','Activo','2000-01-01','pending@vclass.test','12345678') RETURNING id");
    await q("INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES ('VCLASS-PENDING',$1,$2,'PENDIENTE_PAGO')",[pending.id,cohorts[0].id]);
    await q("INSERT INTO virtual_classroom_accounts(person_type,person_id,username,verified,updated_by) VALUES ('user',$1,'lucia.moodle',TRUE,$2),('user',$3,'docente.moodle',TRUE,$2)",[linkedUser.id,admin.id,admin.id]);
    const unconfiguredCandidates=await (await import(pathToFileURL(path.join(root,'src/modules/virtual-classroom/virtual-classroom.service.ts')).href))
      .VirtualClassroomService.candidates({from:'2026-10-29',to:'2026-12-01'}, {id:admin.id,rol:'SUPER_ADMIN',permisos:[]});
    assert.deepEqual(unconfiguredCandidates.categories,[{value:'1',course_count:2}]);
    for (const [index,schedule] of schedules.entries()) await q("INSERT INTO virtual_classroom_courses(schedule_id,shortname,category,teacher_role,updated_by) VALUES($1,$2,$4,'editingteacher',$3)",[schedule.id,`VCLASS-${index}`,admin.id,index===0?'00123':'Posgrados']);
    const { VirtualClassroomDAO } = await import(pathToFileURL(path.join(root,'src/modules/virtual-classroom/virtual-classroom.dao.ts')).href);
    const { VirtualClassroomService } = await import(pathToFileURL(path.join(root,'src/modules/virtual-classroom/virtual-classroom.service.ts')).href);
    const actor = { id:admin.id,rol:'SUPER_ADMIN',permisos:[] };
    const candidateResult = await VirtualClassroomService.candidates({ from:'2026-10-29',to:'2026-12-01' },actor);
    assert.equal(candidateResult.schedules.length,2);
    assert.equal(candidateResult.schedules[0].componente_nombre,'Gestión Pública');
    assert.deepEqual(candidateResult.categories,[{value:'00123',course_count:1},{value:'Posgrados',course_count:1}]);
    const categoryCandidates=await VirtualClassroomService.candidates({from:'2026-10-29',to:'2026-12-01',category:'00123'},actor);
    assert.deepEqual(categoryCandidates.schedules.map((row:any)=>[row.id,row.category]),[[schedules[0].id,'00123']]);
    assert.equal(categoryCandidates.programs.length,1);
    assert.equal(categoryCandidates.cohorts.length,1);
    const unknownCategory=await VirtualClassroomService.candidates({from:'2026-10-29',to:'2026-12-01',category:'unknown'},actor);
    assert.equal(unknownCategory.schedules.length,0);
    assert.deepEqual(unknownCategory.categories,candidateResult.categories);
    const categoryPreview=await VirtualClassroomService.previewExport([schedules[0].id],'00123');
    assert.equal(categoryPreview.category,'00123');
    assert.deepEqual(categoryPreview.courses.map((course:any)=>course.category),['00123']);
    const categoryUsers=await VirtualClassroomService.createExport([schedules[0].id],'users_csv',actor,'00123');
    assert.match(categoryUsers.content.toString('utf8'),/course1,role1/);
    assert.doesNotMatch(categoryUsers.content.toString('utf8'),/course2|VCLASS-1/);
    const categoryCourses=await VirtualClassroomService.createExport([schedules[0].id],'courses_csv',actor,'00123');
    assert.match(categoryCourses.content.toString('utf8'),/VCLASS-0,Gestión Pública - VCLASS-0/);
    assert.doesNotMatch(categoryCourses.content.toString('utf8'),/VCLASS-1/);
    const categoryXlsx=await VirtualClassroomService.createExport([schedules[0].id],'xlsx',actor,'00123');
    const categoryWorkbook=new ExcelJS.Workbook();
    await categoryWorkbook.xlsx.load(categoryXlsx.content);
    const categoryCourseRows=categoryWorkbook.getWorksheet('Cursos')!.getSheetValues().slice(2).filter(Boolean);
    assert.equal(categoryCourseRows.length,1);
    assert.equal((categoryCourseRows[0] as any[])[1],'VCLASS-0');
    const categoryUserRows=categoryWorkbook.getWorksheet('Usuarios')!.getSheetValues().slice(2).filter(Boolean);
    assert.equal(categoryUserRows.length,2);
    assert.equal((categoryUserRows[0] as any[]).length,7);
    const categorySnapshot=await one('SELECT content_snapshot FROM virtual_classroom_exports WHERE id=$1',[categoryCourses.export.id]);
    assert.equal(categorySnapshot.content_snapshot.category,'00123');
    assert.equal(categorySnapshot.content_snapshot.courses.length,1);
    const exportCountBeforeCategoryConflict=Number((await one('SELECT count(*)::int AS count FROM virtual_classroom_exports')).count);
    await q("UPDATE virtual_classroom_courses SET category='Changed after review' WHERE schedule_id=$1",[schedules[0].id]);
    let categoryConflict:any;
    try { await VirtualClassroomService.createExport([schedules[0].id],'courses_csv',actor,'00123'); }
    catch (error) { categoryConflict=error; }
    const exportCountAfterCategoryConflict=Number((await one('SELECT count(*)::int AS count FROM virtual_classroom_exports')).count);
    assert.equal(categoryConflict?.statusCode,409);
    assert.equal(exportCountAfterCategoryConflict,exportCountBeforeCategoryConflict);
    await q("UPDATE virtual_classroom_courses SET category='00123' WHERE schedule_id=$1",[schedules[0].id]);
    await q("UPDATE virtual_classroom_courses SET updated_at=NOW()+INTERVAL '1 minute' WHERE schedule_id=$1",[schedules[0].id]);
    checks.push('category options count unconfigured proposals and exact stored values before filtering; filtered scopes and all three exports exclude other-category courses, and stale category assignment conflicts without export history');
    checks.push('candidate query preserves program/cohort/component identity and accent text');
    const stateFixtures:any[]=[];
    for (const [index,state] of ['INSCRIPCION_ABIERTA','QUORUM_ALCANZADO_COBRANDO','EN_EJECUCION','PLANIFICADA','CANCELADA'].entries()) {
      const cohort=await one(`INSERT INTO cohortes_apertura(programa_id,sede_id,modalidad,codigo_cohorte,numero_edicion,coordinador_id,
        fecha_inicio_inscripcion,fecha_fin_inscripcion,fecha_inicio_clases,fecha_fin_clases,precio_total_cohorte,estado_cohorte)
        VALUES($1,$2,'PRESENCIAL',$3,1,$4,'2026-10-01','2026-10-20',$5,'2028-01-01',0,$6) RETURNING id`,
      [program.id,campus.id,`VCLASS-STATE-${index}`,teacher.id,index===0?'2020-01-01':index===2?'2035-01-01':'2026-11-01',state]);
      const schedule=await one(`INSERT INTO programacion_componentes_cohorte(cohorte_id,componente_id,docente_titular_id,fecha_inicio,fecha_fin)
        VALUES($1,$2,$3,$4,$5) RETURNING id`,[cohort.id,component.id,index===0?null:teacher.id,index===1?'2020-02-01':index===2?null:'2026-11-01',index===1?'2020-03-01':null]);
      stateFixtures.push({cohortId:cohort.id,scheduleId:schedule.id,state});
    }
    const operational=await VirtualClassroomService.candidates({},actor);
    assert.equal(operational.schedules.length,3);
    assert.equal(operational.schedules.find((row:any)=>row.id===stateFixtures[0].scheduleId)?.category,'00123');
    assert.deepEqual(new Set(operational.schedules.map((row:any)=>row.estado_cohorte)),
      new Set(['INSCRIPCION_ABIERTA','QUORUM_ALCANZADO_COBRANDO','EN_EJECUCION']));
    assert.equal(operational.cohorts.length,3);
    const exactCancelled=await VirtualClassroomService.candidates({estado_cohorte:'CANCELADA'},actor);
    assert.deepEqual(exactCancelled.schedules.map((row:any)=>row.estado_cohorte),['CANCELADA']);
    const legacyAll=await VirtualClassroomService.candidates({from:'2026-10-29',to:'2026-12-01'},actor);
    assert.ok(legacyAll.schedules.some((row:any)=>row.estado_cohorte==='PLANIFICADA'));
    assert.ok(legacyAll.schedules.some((row:any)=>row.estado_cohorte==='CANCELADA'));
    await q('DELETE FROM programacion_componentes_cohorte WHERE id=ANY($1::uuid[])',[stateFixtures.map(row=>row.scheduleId)]);
    await q('DELETE FROM cohortes_apertura WHERE id=ANY($1::uuid[])',[stateFixtures.map(row=>row.cohortId)]);
    checks.push('default SQL filters the three operational states independent of null, past, or future dates; explicit state and legacy date paths remain distinct');
    const preview = await VirtualClassroomService.previewExport(schedules.map(item => item.id));
    assert.equal(preview.courses.length,2);
    assert.equal(preview.people.filter((person: any) => person.kind==='student').length,1);
    assert.equal(preview.people.find((person: any) => person.kind==='student').courses.length,2);
    assert.equal(preview.people.find((person: any) => person.kind==='student').person_key,`user:${linkedUser.id}`);
    assert.ok(preview.issues.every((issue: any) => issue.code!=='PERSON_DATA_MISSING'));
    const exportResult = await VirtualClassroomService.createExport(schedules.map(item => item.id),'users_csv',actor);
    const exported = exportResult.content.toString('utf8');
    assert.match(exported,/username,firstname,lastname,email,course1,role1,course2,role2/);
    assert.match(exported,/lucia\.moodle,Lucía,Álvarez/);
    assert.equal((await one('SELECT count(*)::int AS count FROM virtual_classroom_exports')).count,4);
    checks.push('active-only roster consolidation produces one accented account row across two courses');

    const collisionPeople:any[]=[];
    for (const [index,cohort] of cohorts.entries()) {
      collisionPeople.push(await one(`INSERT INTO personas_aspirantes(tipo_identificacion,numero_identificacion,nombres,apellidos,fecha_nacimiento,email,telefono)
        VALUES('PASAPORTE',$1,'Common','Student','2000-01-01',$2,'12345678') RETURNING id`,[`VCLASS-COLLISION-${index}`,`common@domain${index}.test`]));
      await q("INSERT INTO inscripciones(codigo_expediente,aspirante_id,cohorte_id,estado) VALUES($1,$2,$3,'MATRICULADO_ACTIVO')",
        [`VCLASS-COLLISION-${index}`,collisionPeople[index].id,cohort.id]);
    }
    const candidateFor = async (ids:string[],personId:string) => (await VirtualClassroomService.previewExport(ids)).people
      .find((person:any)=>person.person_key===`applicant:${personId}`)?.username;
    const expectedCollisionNames=collisionPeople.map(person=>`pep.applicant.${String(person.id).replaceAll('-','')}`);
    const aloneNames=await Promise.all(collisionPeople.map((person,index)=>candidateFor([schedules[index].id],person.id)));
    const combined=await VirtualClassroomService.previewExport(schedules.map(schedule=>schedule.id));
    const reversed=await VirtualClassroomService.previewExport(schedules.map(schedule=>schedule.id).reverse());
    const combinedNames=collisionPeople.map(person=>combined.people.find((row:any)=>row.person_key===`applicant:${person.id}`)?.username);
    const reversedNames=collisionPeople.map(person=>reversed.people.find((row:any)=>row.person_key===`applicant:${person.id}`)?.username);
    assert.deepEqual(aloneNames,expectedCollisionNames);
    assert.deepEqual(combinedNames,expectedCollisionNames);
    assert.deepEqual(reversedNames,expectedCollisionNames);
    assert.equal(new Set(expectedCollisionNames).size,2);
    await VirtualClassroomDAO.upsertAccount('applicant',collisionPeople[0].id,{username:'common'},admin.id);
    assert.equal(await candidateFor([schedules[1].id],collisionPeople[1].id),expectedCollisionNames[1]);
    await q("DELETE FROM virtual_classroom_accounts WHERE person_type='applicant' AND person_id=ANY($1::uuid[])",[collisionPeople.map(person=>person.id)]);
    for (const person of collisionPeople) {
      await q('DELETE FROM inscripciones WHERE aspirante_id=$1',[person.id]);
      await q('DELETE FROM personas_aspirantes WHERE id=$1',[person.id]);
    }
    checks.push('email-derived username proposals are global, order-independent, and remain stable after another identity is confirmed');

    await q('DELETE FROM virtual_classroom_courses WHERE schedule_id=$1',[schedules[0].id]);
    const proposedCourse = await VirtualClassroomService.previewExport([schedules[0].id]);
    assert.equal(proposedCourse.courses[0].confirmed,false);
    assert.equal(proposedCourse.courses[0].teacher_role,'editingteacher');
    assert.equal(proposedCourse.people.find((person:any)=>person.kind==='teacher').courses[0].role,'editingteacher');
    assert.match(proposedCourse.courses[0].shortname,/^VCLASS-0-VCLASS-[a-f0-9]{32}$/i);
    await q("INSERT INTO virtual_classroom_courses(schedule_id,shortname,category,teacher_role,updated_by) VALUES($1,'VCLASS-0','Posgrados','editingteacher',$2)",[schedules[0].id,admin.id]);
    checks.push('unsaved course proposals inherit sibling category and teacher role, retain readable UUID names, and align the teacher roster');

    await VirtualClassroomService.configureAccount(`user:${linkedUser.id}`,{ username:'lucia.moodle',firstname:'Lucía revisada',lastname:'Álvarez Alumna',email:'lucia.export@vclass.test' },actor);
    await VirtualClassroomService.configureAccount(`user:${linkedUser.id}`,{ username:'lucia.moodle' },actor);
    await VirtualClassroomService.configureCourse(schedules[0].id,{shortname:'VCLASS-0',category:'1',teacher_role:'teacher',fullname:'Gestión Pública revisada',summary:'Resumen de prueba' },actor);
    await VirtualClassroomService.configureCourse(schedules[0].id,{shortname:'VCLASS-0',category:'1',teacher_role:'teacher' },actor);
    const reviewedPreview = await VirtualClassroomService.previewExport([schedules[0].id]);
    assert.equal(reviewedPreview.courses[0].confirmed,true);
    assert.equal(reviewedPreview.courses[0].fullname,'Gestión Pública revisada');
    const reviewedStudent = reviewedPreview.people.find((person:any)=>person.person_key===`user:${linkedUser.id}`);
    assert.equal(reviewedStudent.firstname,'Lucía revisada');
    assert.equal(reviewedStudent.email,'lucia.export@vclass.test');
    const reviewedExport = await VirtualClassroomService.createExport([schedules[0].id],'users_csv',actor);
    assert.match(reviewedExport.content.toString('utf8'),/lucia\.moodle,Lucía revisada,Álvarez Alumna,lucia\.export@vclass\.test/);
    checks.push('saved account and course overrides survive omitted-field updates and are used in preview and generated exports');

    await q("UPDATE programacion_componentes_cohorte SET codigo_aula_virtual_externa='VCLASS-0' WHERE id=$1",[schedules[1].id]);
    const legacyPreview = await VirtualClassroomService.previewExport([schedules[0].id]);
    let legacySaveError: any;
    let legacyExportError: any;
    try { await VirtualClassroomService.configureCourse(schedules[0].id,{shortname:'VCLASS-0',category:'Posgrados',teacher_role:'editingteacher'},actor); }
    catch (error) { legacySaveError=error; }
    const exportCountBeforeLegacyAttempt=Number((await one('SELECT count(*)::int AS count FROM virtual_classroom_exports')).count);
    try { await VirtualClassroomService.createExport([schedules[0].id],'courses_csv',actor); }
    catch (error) { legacyExportError=error; }
    const exportCountAfterLegacyAttempt=Number((await one('SELECT count(*)::int AS count FROM virtual_classroom_exports')).count);
    const legacyConflict = legacyPreview.issues.some((issue:any)=>issue.code==='LEGACY_COURSE_CODE_CONFLICT');
    await q("UPDATE programacion_componentes_cohorte SET codigo_aula_virtual_externa='VCLASS-0' WHERE id=$1",[schedules[0].id]);
    await q('UPDATE programacion_componentes_cohorte SET codigo_aula_virtual_externa=NULL WHERE id=$1',[schedules[1].id]);
    await q('DELETE FROM virtual_classroom_courses WHERE schedule_id=$1',[schedules[0].id]);
    const legacyFallbackPreview=await VirtualClassroomService.previewExport([schedules[0].id]);
    let selfCodeError:any;
    try { await VirtualClassroomService.configureCourse(schedules[0].id,{shortname:'VCLASS-0',category:'Posgrados',teacher_role:'editingteacher'},actor); }
    catch (error) { selfCodeError=error; }
    const selfPreview=await VirtualClassroomService.previewExport([schedules[0].id]);
    const selfCodeAllowed=legacyFallbackPreview.courses[0].shortname==='VCLASS-0' && !legacyFallbackPreview.issues.some((issue:any)=>issue.code==='LEGACY_COURSE_CODE_CONFLICT') &&
      !selfCodeError && selfPreview.courses[0].shortname==='VCLASS-0' && !selfPreview.issues.some((issue:any)=>issue.code.startsWith('LEGACY_COURSE_CODE_'));
    regressionResults.push({ name:'B5 legacy course ownership',passed:legacyConflict && legacySaveError?.statusCode===409 && legacyExportError?.statusCode===400 && exportCountAfterLegacyAttempt===exportCountBeforeLegacyAttempt && selfCodeAllowed,
      detail:JSON.stringify({legacyConflict,saveStatus:legacySaveError?.statusCode,exportStatus:legacyExportError?.statusCode,exportCountBeforeLegacyAttempt,exportCountAfterLegacyAttempt,selfCodeAllowed}) });
    const file = { originalname:'grades.csv',mimetype:'text/csv',buffer:Buffer.from('Username,Final grade\r\nlucia.moodle,85\r\n') } as Express.Multer.File;
    const uploadActor = { ...actor,permisos:['NOTA_IMPORTAR','NOTA_MODIFICAR'] };
    const firstPreview = await VirtualClassroomService.previewGrades(schedules[0].id,file,'Username','Final grade',uploadActor);
    assert.equal(firstPreview.can_confirm,true);
    assert.equal(firstPreview.rows[0].status,'new');
    const firstConfirmation = await VirtualClassroomService.confirmGrades(schedules[0].id,{preview_id:firstPreview.preview_id!},uploadActor);
    assert.equal(firstConfirmation.processed,1);
    assert.equal(Number((await one('SELECT calificacion_cuantitativa FROM matricula_componentes_snepa WHERE programacion_componente_id=$1',[schedules[0].id])).calificacion_cuantitativa),85);
    assert.equal((await one('SELECT length(source_bytes) AS bytes FROM virtual_classroom_grade_previews WHERE id=$1',[firstPreview.preview_id])).bytes>0,true);
    const dao:any=VirtualClassroomDAO;
    let interleaved=false;
    const originalSnapshot=dao.gradePreviewSnapshot;
    const originalFingerprint=dao.gradeFingerprint;
    if(originalSnapshot) dao.gradePreviewSnapshot=async (...args:any[])=>{
      const snapshot=await originalSnapshot(...args);
      if(!interleaved){interleaved=true;await q('UPDATE matricula_componentes_snepa SET calificacion_cuantitativa=87 WHERE programacion_componente_id=$1',[schedules[0].id]);}
      return snapshot;
    };
    else dao.gradeFingerprint=async (...args:any[])=>{
      if(!interleaved){interleaved=true;await q('UPDATE matricula_componentes_snepa SET calificacion_cuantitativa=87 WHERE programacion_componente_id=$1',[schedules[0].id]);}
      return originalFingerprint(...args);
    };
    let racePreview:any, raceResult:any, raceError:any;
    try {
      racePreview=await VirtualClassroomService.previewGrades(schedules[0].id,file,'Username','Final grade',uploadActor);
      try { raceResult=await VirtualClassroomService.confirmGrades(schedules[0].id,{preview_id:racePreview.preview_id!},uploadActor); }
      catch(error) { raceError=error; }
    } finally {
      if(originalSnapshot) dao.gradePreviewSnapshot=originalSnapshot;
      dao.gradeFingerprint=originalFingerprint;
    }
    const racedGrade=await one('SELECT calificacion_cuantitativa FROM matricula_componentes_snepa WHERE programacion_componente_id=$1',[schedules[0].id]);
    regressionResults.push({name:'B4 preview state consistency',passed:raceError?.statusCode===409 && Number(racedGrade.calificacion_cuantitativa)===87,
      detail:JSON.stringify({previewStatus:racePreview?.rows?.[0]?.status,result:raceResult,errorStatus:raceError?.statusCode,persistedGrade:racedGrade.calificacion_cuantitativa})});
    await q('UPDATE matricula_componentes_snepa SET calificacion_cuantitativa=85 WHERE programacion_componente_id=$1',[schedules[0].id]);
    const enrollmentTwo=await one('SELECT id FROM inscripciones WHERE aspirante_id=$1 AND cohorte_id=$2',[applicant.id,cohorts[1].id]);
    const nullGradeRow=await one(`INSERT INTO matricula_componentes_snepa(inscripcion_id,programacion_componente_id,componente_id,
      autoevaluacion_completada,coevaluacion_completada) VALUES($1,$2,$3,TRUE,TRUE) RETURNING id`,[enrollmentTwo.id,schedules[1].id,component.id]);
    const nullPreview=await VirtualClassroomService.previewGrades(schedules[1].id,file,'Username','Final grade',uploadActor);
    let nullError:any,nullResult:any;
    const initialGradeActor={id:admin.id,rol:'OPERATOR',permisos:['NOTA_IMPORTAR']};
    try { nullResult=await VirtualClassroomService.confirmGrades(schedules[1].id,{preview_id:nullPreview.preview_id!},initialGradeActor); }
    catch(error) { nullError=error; }
    const nullGrade=await one('SELECT id,calificacion_cuantitativa,autoevaluacion_completada,coevaluacion_completada,es_convalidada FROM matricula_componentes_snepa WHERE id=$1',[nullGradeRow.id]);
    const nullAudit=await one('SELECT nota_anterior,nota_nueva,motivo_modificacion FROM notas_snepa_logs WHERE matricula_componente_id=$1',[nullGradeRow.id]);
    regressionResults.push({name:'B3 existing row without final grade',passed:nullPreview.rows[0].status==='new' && !nullError && nullResult?.processed===1 && Number(nullGrade?.calificacion_cuantitativa)===85 && nullGrade?.autoevaluacion_completada===true && nullGrade?.coevaluacion_completada===true && nullGrade?.es_convalidada===false && nullAudit?.nota_anterior===null && Boolean(nullAudit?.motivo_modificacion),
      detail:JSON.stringify({previewStatus:nullPreview.rows[0].status,error:nullError?.message,result:nullResult,grade:nullGrade,audit:nullAudit})});
    await q('DELETE FROM notas_snepa_logs WHERE matricula_componente_id=$1',[nullGradeRow.id]);
    await q('DELETE FROM matricula_componentes_snepa WHERE id=$1',[nullGradeRow.id]);
    await q('DELETE FROM lotes_importacion_notas WHERE archivo_excel_url=$1',[`virtual-classroom:${nullPreview.preview_id}`]);
    const samePreview = await VirtualClassroomService.previewGrades(schedules[0].id,file,'Username','Final grade',uploadActor);
    assert.equal(samePreview.rows[0].status,'unchanged');
    const same = await VirtualClassroomService.confirmGrades(schedules[0].id,{preview_id:samePreview.preview_id!},uploadActor);
    assert.deepEqual({processed:same.processed,unchanged:same.unchanged},{processed:0,unchanged:1});
    checks.push('grade preview resolves verified username only, stores source bytes, and identical values are idempotent');
    const changedFile = { ...file,buffer:Buffer.from('Username,Final grade\nlucia.moodle,92\n') } as Express.Multer.File;
    const changedPreview = await VirtualClassroomService.previewGrades(schedules[0].id,changedFile,'Username','Final grade',uploadActor);
    assert.equal(changedPreview.rows[0].status,'change');
    await assert.rejects(VirtualClassroomService.confirmGrades(schedules[0].id,{preview_id:changedPreview.preview_id!},
      { id:admin.id,rol:'OPERATOR',permisos:['NOTA_IMPORTAR'] }),(error: any) => error.statusCode===403);
    const changed = await VirtualClassroomService.confirmGrades(schedules[0].id,{preview_id:changedPreview.preview_id!,reason:'Correction approved'},uploadActor);
    assert.equal(changed.processed,1);
    assert.deepEqual(await q('SELECT nota_anterior,nota_nueva,motivo_modificacion FROM notas_snepa_logs ORDER BY fecha_modificacion'),[
      { nota_anterior:null,nota_nueva:'85.00',motivo_modificacion:'Importación Moodle' },
      { nota_anterior:'85.00',nota_nueva:'92.00',motivo_modificacion:'Correction approved' },
    ]);
    checks.push('different grades require modifier permission and reason; audit retains before/after values');
    const rollbackFile = { ...file,buffer:Buffer.from('Username,Final grade\nlucia.moodle,95\n') } as Express.Multer.File;
    const rollbackPreview = await VirtualClassroomService.previewGrades(schedules[0].id,rollbackFile,'Username','Final grade',uploadActor);
    const beforeRollback = createHash('sha256').update(JSON.stringify([
      await q('SELECT * FROM lotes_importacion_notas ORDER BY id'),
      await q('SELECT * FROM matricula_componentes_snepa ORDER BY id'),
      await q('SELECT * FROM notas_snepa_logs ORDER BY id'),
      await q('SELECT consumed_at FROM virtual_classroom_grade_previews WHERE id=$1',[rollbackPreview.preview_id]),
    ])).digest('hex');
    await q("CREATE FUNCTION reject_virtual_classroom_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated audit failure'; END $$");
    await q('CREATE TRIGGER reject_virtual_classroom_audit BEFORE INSERT ON notas_snepa_logs FOR EACH ROW EXECUTE FUNCTION reject_virtual_classroom_audit()');
    await assert.rejects(VirtualClassroomService.confirmGrades(schedules[0].id,{preview_id:rollbackPreview.preview_id!,reason:'Atomic rollback check'},uploadActor),
      /Isolated audit failure/);
    const afterRollback = createHash('sha256').update(JSON.stringify([
      await q('SELECT * FROM lotes_importacion_notas ORDER BY id'),
      await q('SELECT * FROM matricula_componentes_snepa ORDER BY id'),
      await q('SELECT * FROM notas_snepa_logs ORDER BY id'),
      await q('SELECT consumed_at FROM virtual_classroom_grade_previews WHERE id=$1',[rollbackPreview.preview_id]),
    ])).digest('hex');
    assert.equal(afterRollback,beforeRollback);
    await q('DROP TRIGGER reject_virtual_classroom_audit ON notas_snepa_logs');
    await q('DROP FUNCTION reject_virtual_classroom_audit()');
    checks.push('audit failure rolls back grade, import lot, and preview consumption together');
    const stalePreview = await VirtualClassroomService.previewGrades(schedules[0].id,changedFile,'Username','Final grade',uploadActor);
    await q("UPDATE virtual_classroom_accounts SET username='lucia.other' WHERE person_type='user' AND person_id=$1",[linkedUser.id]);
    await assert.rejects(VirtualClassroomService.confirmGrades(schedules[0].id,{preview_id:stalePreview.preview_id!,reason:'Correction'},uploadActor),
      (error: any) => error.statusCode===409);
    assert.equal((await one('SELECT count(*)::int AS count FROM notas_snepa_logs')).count,2);
    await q('UPDATE programacion_componentes_cohorte SET actas_notas_cerradas=TRUE WHERE id=$1',[schedules[0].id]);
    await assert.rejects(VirtualClassroomService.previewGrades(schedules[0].id,file,'Username','Final grade',uploadActor),
      (error: any) => error.statusCode===400);
    checks.push('mapping changes invalidate previews and closed schedules reject import');
    assert.ok(createHash('sha256').update(exported).digest('hex'));
    assert.deepEqual(regressionResults.filter(result=>!result.passed),[],`Independent regression probes failed: ${JSON.stringify(regressionResults)}`);
    checks.push(...regressionResults.map(result=>result.name+' passed'));
  } finally {
    try { if (pool) await pool.end(); }
    finally {
      process.chdir(originalCwd);
      try { if (created) docker(['stop','-t','1',container]); }
      finally { await rm(scratch,{ recursive:true,force:true }); }
    }
  }
  console.log(JSON.stringify({ complete:true, database:'disposable PostgreSQL 16', checks },null,2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
