import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { pool } from '../../db/pool';
import { AuthDao } from '../auth/auth.dao';
import { isolatedHttp } from '../auth/http.test-helper';
import { VirtualClassroomService } from './virtual-classroom.service';

afterEach(() => mock.restoreAll());

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
  }] : [] } as any); });
  const http = isolatedHttp(app);
  const path = '/api/virtual-classroom/candidates';
  const anonymous = await http.request(path);
  assert.equal(anonymous.status, 401);
  const token = jwt.sign({ sub: userId, sid: 'session' }, process.env.JWT_SECRET);
  const response = await http.request(path, 'GET', undefined, token);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.programs, [{ id: '00000000-0000-4000-8000-000000000010', nombre: 'Programa Ágil' }]);
  assert.deepEqual(response.body.data.cohorts, [{ id: '00000000-0000-4000-8000-000000000011', programa_id: '00000000-0000-4000-8000-000000000010', codigo_cohorte: 'PEP-01' }]);
  assert.equal(response.body.data.schedules[0].componente_nombre, 'Gestión Pública');
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
  assert.match(queries.at(-1)!.sql,/pa\.usuario_id=\$6/);
  assert.equal(queries.at(-1)!.values[4],true);
  assert.equal(queries.at(-1)!.values[5],userId);
  assert.equal((await http.request(`/api/virtual-classroom/accounts/applicant:${userId}`,'PUT',{ username:'moodle.user',verified:true,firstname:'Ana',lastname:'Pérez',email:'ana@example.test' },token)).status,403);
});
