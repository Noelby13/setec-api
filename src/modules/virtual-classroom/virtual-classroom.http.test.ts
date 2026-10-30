import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { pool } from '../../db/pool';
import { AuthDao } from '../auth/auth.dao';
import { isolatedHttp } from '../auth/http.test-helper';
import { VirtualClassroomService } from './virtual-classroom.service';

afterEach(() => mock.restoreAll());

test('category is validated and forwarded unchanged through candidates, preview, and export HTTP endpoints', async () => {
  process.env.JWT_SECRET = 'virtual-classroom-category-http-tests';
  process.env.JWT_REFRESH_SECRET = 'virtual-classroom-category-refresh-tests';
  const userId = '00000000-0000-4000-8000-000000000004';
  const auth = { role: 'SUPER_ADMIN', permissions: [] as string[] };
  const calls: any[] = [];
  let candidateSql = '';
  let candidateValues: unknown[] = [];
  mock.method(AuthDao, 'findUserById', async () => ({ id: userId, activo: true, rol_nombre: auth.role, rol_id: 'role' }));
  mock.method(AuthDao, 'getPermissionsByRoleId', async () => auth.permissions);
  mock.method(AuthDao, 'findActiveSessionById', async () => ({ id: 'session' }));
  mock.method(VirtualClassroomService,'previewExport',async (...args:any[])=>{ calls.push(['preview',...args]); return { courses:[],people:[],issues:[] }; });
  mock.method(VirtualClassroomService,'createExport',async (...args:any[])=>{ calls.push(['export',...args]); return { content:Buffer.from('ok'),filename:'x.csv',contentType:'text/csv',export:{id:'export'} }; });
  mock.method(pool,'query',async (sql:string,values:unknown[]=[])=>{
    candidateSql=sql; candidateValues=values;
    return { rows:[
      { programa_id:'00000000-0000-4000-8000-000000000010',programa_nombre:'Programa',cohorte_id:'00000000-0000-4000-8000-000000000011',
        codigo_cohorte:'P-1',schedule_id:'00000000-0000-4000-8000-000000000012',componente_nombre:'Componente',fecha_inicio:'2026-11-01',
        fecha_fin:'2026-11-30',docente_nombre:'Docente',actas_notas_cerradas:false,estado_cohorte:'INSCRIPCION_ABIERTA',effective_category:'00123' },
      { programa_id:'00000000-0000-4000-8000-000000000010',programa_nombre:'Programa',cohorte_id:'00000000-0000-4000-8000-000000000013',
        codigo_cohorte:'P-2',schedule_id:'00000000-0000-4000-8000-000000000014',componente_nombre:'Componente',fecha_inicio:'2026-11-01',
        fecha_fin:'2026-11-30',docente_nombre:'Docente',actas_notas_cerradas:false,estado_cohorte:'INSCRIPCION_ABIERTA',effective_category:'Otra' },
    ] } as any;
  });
  const http = isolatedHttp(app);
  const token = jwt.sign({ sub: userId, sid: 'session' }, process.env.JWT_SECRET);
  const ids = ['00000000-0000-4000-8000-000000000012'];
  const candidates=await http.request('/api/virtual-classroom/candidates?category=%2000123%20', 'GET', undefined, token);
  assert.equal(candidates.status,200);
  assert.deepEqual(candidates.body.data.categories,[{value:'00123',course_count:1},{value:'Otra',course_count:1}]);
  assert.deepEqual(candidates.body.data.schedules.map((schedule:any)=>[schedule.id,schedule.category]),[['00000000-0000-4000-8000-000000000012','00123']]);
  assert.match(candidateSql,/COALESCE\(NULLIF\(btrim\(current_course\.category\)/);
  assert.equal(candidateValues[0],null);
  assert.equal((await http.request('/api/virtual-classroom/candidates?category=%20', 'GET', undefined, token)).status,400);
  assert.equal((await http.request('/api/virtual-classroom/exports/preview','POST',{schedule_ids:ids,category:'00123'},token)).status,200);
  assert.equal((await http.request('/api/virtual-classroom/exports','POST',{schedule_ids:ids,format:'users_csv',category:'00123'},token)).status,200);
  assert.deepEqual(calls[0],['preview',ids,'00123']);
  assert.deepEqual(calls[1],['export',ids,'users_csv',calls[1][3],'00123']);
});

test('virtual classroom routes require an authenticated user and expose candidates', async () => {
  process.env.JWT_SECRET = 'virtual-classroom-http-tests';
  process.env.JWT_REFRESH_SECRET = 'virtual-classroom-refresh-tests';
  const userId = '00000000-0000-4000-8000-000000000004';
  const auth = { role: 'SUPER_ADMIN', permissions: [] as string[] };
  const queries: { sql: string; values: unknown[] }[] = [];
  const accountCalls: any[] = [];
  mock.method(AuthDao, 'findUserById', async () => ({ id: userId, activo: true, rol_nombre: auth.role, rol_id: 'role' }));
  mock.method(AuthDao, 'getPermissionsByRoleId', async () => auth.permissions);
  mock.method(AuthDao, 'findActiveSessionById', async () => ({ id: 'session' }));
  mock.method(VirtualClassroomService,'configureAccount',async (...args:any[])=>{ accountCalls.push(args); return args[1]; });
  mock.method(pool, 'query', async (sql: string, values: unknown[] = []) => { queries.push({sql,values});
    if(sql.includes('INSERT INTO virtual_classroom_courses')) return { rows:[{ shortname:values[1],category:values[2],teacher_role:values[3] }] } as any;
    if(sql.includes('lower(btrim(pcc.codigo_aula_virtual_externa))')) return { rows:[] } as any;
    return ({ rows: sql.includes('FROM programacion_componentes_cohorte pcc') ? [{
    programa_id: '00000000-0000-4000-8000-000000000010', programa_nombre: 'Programa Ágil',
    cohorte_id: '00000000-0000-4000-8000-000000000011', codigo_cohorte: 'PEP-01',
    schedule_id: '00000000-0000-4000-8000-000000000012', componente_nombre: 'Gestión Pública',
    fecha_inicio: '2026-11-01', fecha_fin: '2026-11-30', docente_nombre: 'Ana Pérez', actas_notas_cerradas: false,
    estado_cohorte: 'INSCRIPCION_ABIERTA',
  }] : [] } as any); });
  const http = isolatedHttp(app);
  const path = '/api/virtual-classroom/candidates';
  const anonymous = await http.request(path);
  assert.equal(anonymous.status, 401);
  const token = jwt.sign({ sub: userId, sid: 'session' }, process.env.JWT_SECRET);
  const response = await http.request(path, 'GET', undefined, token);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.programs, [{ id: '00000000-0000-4000-8000-000000000010', nombre: 'Programa Ágil' }]);
  assert.deepEqual(response.body.data.cohorts, [{ id: '00000000-0000-4000-8000-000000000011', programa_id: '00000000-0000-4000-8000-000000000010', codigo_cohorte: 'PEP-01', estado_cohorte: 'INSCRIPCION_ABIERTA' }]);
  assert.equal(response.body.data.schedules[0].componente_nombre, 'Gestión Pública');
  assert.equal(response.body.data.cohorts[0].estado_cohorte, 'INSCRIPCION_ABIERTA');
  assert.equal(response.body.data.schedules[0].estado_cohorte, 'INSCRIPCION_ABIERTA');
  assert.match(queries.at(-1)!.sql,/estado_cohorte IN \('INSCRIPCION_ABIERTA','QUORUM_ALCANZADO_COBRANDO','EN_EJECUCION'\)/);
  assert.equal(queries.at(-1)!.values[0],null);
  assert.equal(queries.at(-1)!.values[1],null);
  assert.equal((await http.request(`${path}?estado_cohorte=FINALIZADA_PENDIENTE_EVAL`, 'GET', undefined, token)).status,200);
  assert.equal(queries.at(-1)!.values[4],'FINALIZADA_PENDIENTE_EVAL');
  assert.equal(queries.at(-1)!.values[5],false);
  assert.equal((await http.request(`${path}?estado_cohorte=INVALIDO`, 'GET', undefined, token)).status,400);
  assert.equal((await http.request(`${path}?from=2026-10-29`, 'GET', undefined, token)).status,200);
  assert.equal(queries.at(-1)!.values[4],null);
  assert.equal(queries.at(-1)!.values[5],false);
  assert.equal(queries.at(-1)!.values[0],'2026-10-29');
  assert.equal(queries.at(-1)!.values[1],'2026-11-28');
  assert.equal((await http.request(`${path}?to=2026-11-30`, 'GET', undefined, token)).status,200);
  assert.equal(queries.at(-1)!.values[0],new Date().toISOString().slice(0,10));
  assert.equal(queries.at(-1)!.values[1],'2026-11-30');
  assert.equal((await http.request(`${path}?from=2026-12-01&to=2026-11-30`, 'GET', undefined, token)).status,400);
  assert.equal((await http.request(`${path}?from=2026-10-29&estado_cohorte=CANCELADA`, 'GET', undefined, token)).status,200);
  assert.equal(queries.at(-1)!.values[4],'CANCELADA');
  assert.equal(queries.at(-1)!.values[5],false);
  assert.equal((await http.request(`${path}?from=not-a-date`, 'GET', undefined, token)).status, 400);
  assert.equal((await http.request('/api/virtual-classroom/exports/preview', 'POST', { schedule_ids: [] }, token)).status, 400);
  const course = await http.request('/api/virtual-classroom/courses/00000000-0000-4000-8000-000000000012','PUT',
    { shortname:'VCLASS-1',category:'Posgrados',teacher_role:'editingteacher',fullname:'Nombre editable',summary:'Resumen editable' },token);
  assert.equal(course.status,200,'valid course mapping must be accepted');
  assert.equal(course.body.data.shortname,'VCLASS-1');
  const courseWrite = queries.find(query => query.sql.includes('INSERT INTO virtual_classroom_courses'))!;
  assert.deepEqual(courseWrite.values.slice(4,6),['Nombre editable','Resumen editable']);
  assert.equal((await http.request(`/api/virtual-classroom/accounts/applicant:${userId}`,'PUT',
    { username:'moodle.user',verified:true,firstname:'',lastname:'Prueba',email:'no-es-correo' },token)).status,400);
  const account = await http.request(`/api/virtual-classroom/accounts/applicant:${userId}`,'PUT',
    { username:'moodle.user',verified:true,firstname:'Ana',lastname:'Pérez',email:'ana@example.test' },token);
  assert.equal(account.status,200);
  assert.equal(account.body.data.email,'ana@example.test');
  assert.deepEqual(accountCalls[0].slice(0,2),[`applicant:${userId}`,
    { username:'moodle.user',verified:true,firstname:'Ana',lastname:'Pérez',email:'ana@example.test' }]);
  auth.role = 'DOCENTE'; auth.permissions = [];
  assert.equal((await http.request(path, 'GET', undefined, token)).status, 403);
  auth.permissions = ['NOTA_IMPORTAR'];
  assert.equal((await http.request(`${path}?from=2026-10-29&to=2026-11-30`, 'GET', undefined, token)).status, 200);
  assert.match(queries.at(-1)!.sql,/pa\.usuario_id=\$8/);
  assert.equal(queries.at(-1)!.values[6],true);
  assert.equal(queries.at(-1)!.values[7],userId);
  assert.equal((await http.request(`/api/virtual-classroom/accounts/applicant:${userId}`,'PUT',{ username:'moodle.user',verified:true,firstname:'Ana',lastname:'Pérez',email:'ana@example.test' },token)).status,403);
});
