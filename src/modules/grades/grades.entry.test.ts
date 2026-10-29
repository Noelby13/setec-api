import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../../db/pool';
import { AuthDao } from '../auth/auth.dao';
import { isolatedHttp } from '../auth/http.test-helper';
import { errorHandler } from '../../middlewares/error.middleware';
import { gradesRouter } from './grades.routes';

afterEach(() => mock.restoreAll());
const scheduleId = '00000000-0000-4000-8000-000000000001';
const enrollmentId = '00000000-0000-4000-8000-000000000002';
const gradeId = '00000000-0000-4000-8000-000000000003';
const userId = '00000000-0000-4000-8000-000000000004';
const base = `/grades/component/${scheduleId}/students`;
const payload = { calificacion_cuantitativa: 0, motivo_modificacion: 'Registro individual' };

function fixture() {
  process.env.JWT_SECRET = 'isolated-grade-tests';
  process.env.JWT_REFRESH_SECRET = 'isolated-grade-refresh';
  const state: any = {
    schedule: { id: scheduleId, cohorte_id: 'cohort', componente_id: 'component', docente_usuario_id: userId, actas_notas_cerradas: false },
    enrollment: { id: enrollmentId, cohorte_id: 'cohort' },
    grade: null, logs: [], queries: [], allowed: true, role: 'DOCENTE',
    permissions: ['NOTA_IMPORTAR', 'NOTA_MODIFICAR'], auditFailure: false,
  };
  mock.method(AuthDao, 'findUserById', async () => ({ id: userId, activo: true, rol_nombre: state.role, rol_id: 'role' }));
  mock.method(AuthDao, 'getPermissionsByRoleId', async () => state.permissions);
  mock.method(AuthDao, 'findActiveSessionById', async () => ({ id: 'session' }));
  const query = async (sql: string, values: any[] = []): Promise<any> => {
    state.queries.push(sql);
    if (sql.includes('SELECT EXISTS')) return { rows: [{ allowed: state.allowed }] };
    if (sql.includes('LEFT JOIN matricula_componentes_snepa')) return { rows: [{ ...state.grade, id: state.grade?.id ?? null, inscripcion_id: enrollmentId, nombres: 'Ana', apellidos: 'Pérez', calificacion_cuantitativa: state.grade?.calificacion_cuantitativa ?? null }] };
    if (sql.includes('FROM programacion_componentes_cohorte')) return { rows: state.schedule ? [state.schedule] : [] };
    if (sql.includes('FROM inscripciones')) return { rows: state.enrollment ? [state.enrollment] : [] };
    if (sql.includes('INSERT INTO matricula_componentes_snepa')) {
      if (state.grade) return { rows: [] };
      state.grade = { id: gradeId, inscripcion_id: values[0], programacion_componente_id: values[1], componente_id: values[2], calificacion_cuantitativa: values[3], valoracion_cualitativa: values[4], aprobado: values[8] };
      return { rows: [state.grade] };
    }
    if (sql.includes('FROM matricula_componentes_snepa')) return { rows: state.grade ? [state.grade] : [] };
    if (sql.includes('UPDATE matricula_componentes_snepa')) {
      Object.assign(state.grade, { calificacion_cuantitativa: values[0], valoracion_cualitativa: values[1], aprobado: values[5] });
      return { rows: [state.grade] };
    }
    if (sql.includes('INSERT INTO notas_snepa_logs')) {
      if (state.auditFailure) throw new Error('audit unavailable');
      const log = { matricula_componente_id: values[0], nota_anterior: values[1], nota_nueva: values[2], motivo_modificacion: values[5] };
      state.logs.push(log); return { rows: [log] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  mock.method(pool, 'query', query);
  mock.method(pool, 'connect', async () => {
    const before = structuredClone({ grade: state.grade, logs: state.logs });
    return { release() {}, query: async (sql: string, values?: any[]) => {
      if (sql === 'ROLLBACK') { Object.assign(state, before); return { rows: [] }; }
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      return query(sql, values);
    } };
  });
  const app = express(); app.use(express.json()); app.use('/grades', gradesRouter); app.use(errorHandler);
  const http = isolatedHttp(app);
  const token = jwt.sign({ sub: userId, sid: scheduleId }, process.env.JWT_SECRET);
  return { state, request: (path = base, method = 'GET', body?: unknown, authenticated = true) => http.request(path, method, body, authenticated ? token : undefined) };
}

test('roster includes pending students without creating grade records', async () => {
  const { state, request } = fixture();
  const response = await request();
  assert.equal(response.status, 200); assert.equal(response.body.data[0].id, null);
  assert.equal(response.body.data[0].inscripcion_id, enrollmentId); assert.equal(state.grade, null);
});
test('individual zero grade persists with audit; duplicate creation cannot overwrite', async () => {
  const { state, request } = fixture();
  const created = await request(`${base}/${enrollmentId}`, 'POST', payload);
  assert.equal(created.status, 201); assert.equal(state.grade.calificacion_cuantitativa, 0);
  assert.equal(state.grade.valoracion_cualitativa, 'APRENDIZAJE_INICIAL'); assert.equal(state.grade.aprobado, false);
  assert.equal(state.logs[0].nota_anterior, null); assert.equal(state.logs[0].nota_nueva, 0);
  const before = JSON.stringify([state.grade, state.logs]);
  assert.equal((await request(`${base}/${enrollmentId}`, 'POST', { ...payload, calificacion_cuantitativa: 99 })).status, 409);
  assert.equal(JSON.stringify([state.grade, state.logs]), before);
});
for (const failure of ['closed', 'foreign cohort', 'missing schedule', 'missing enrollment', 'reassigned teacher', 'audit']) {
  test(`individual creation rejects ${failure} without persisting changes`, async () => {
    const { state, request } = fixture();
    if (failure === 'closed') state.schedule.actas_notas_cerradas = true;
    if (failure === 'foreign cohort') state.enrollment.cohorte_id = 'other';
    if (failure === 'missing schedule') state.schedule = null;
    if (failure === 'missing enrollment') state.enrollment = null;
    if (failure === 'reassigned teacher') state.schedule.docente_usuario_id = 'other';
    if (failure === 'audit') state.auditFailure = true;
    const before = JSON.stringify([state.grade, state.logs]);
    const response = await request(`${base}/${enrollmentId}`, 'POST', payload);
    assert.equal(response.status, failure === 'audit' ? 500 : failure.startsWith('missing') ? 404 : failure === 'reassigned teacher' ? 403 : 400);
    assert.equal(JSON.stringify([state.grade, state.logs]), before);
  });
}
test('roster and creation enforce authentication, permissions and teaching assignment', async () => {
  const { state, request } = fixture();
  for (const [path, method, body] of [[base, 'GET', undefined], [`${base}/${enrollmentId}`, 'POST', payload]] as const) {
    assert.equal((await request(path, method, body, false)).status, 401);
    state.permissions = []; assert.equal((await request(path, method, body)).status, 403);
    state.permissions = ['NOTA_IMPORTAR', 'NOTA_MODIFICAR']; state.allowed = false;
    assert.equal((await request(path, method, body)).status, 403); state.allowed = true;
  }
  assert.equal(state.grade, null);
});
test('creation rejects missing, out-of-range grades and blank audit reasons', async () => {
  const { state, request } = fixture();
  for (const body of [{ motivo_modificacion: 'Registro' }, { ...payload, calificacion_cuantitativa: -1 }, { ...payload, calificacion_cuantitativa: 101 }, { ...payload, motivo_modificacion: '     ' }]) {
    assert.equal((await request(`${base}/${enrollmentId}`, 'POST', body)).status, 400);
  }
  assert.equal(state.grade, null); assert.equal(state.logs.length, 0);
});
test('existing PATCH preserves calculation and audit while enforcing closed schedules', async () => {
  const { state, request } = fixture(); state.role = 'SUPER_ADMIN';
  state.grade = { id: gradeId, programacion_componente_id: scheduleId, calificacion_cuantitativa: '75.00', valoracion_cualitativa: 'APRENDIZAJE_FUNDAMENTAL', aprobado: true };
  assert.equal((await request(`/grades/${gradeId}`, 'PATCH', { ...payload, calificacion_cuantitativa: 92 })).status, 200);
  assert.equal(state.grade.valoracion_cualitativa, 'APRENDIZAJE_AVANZADO'); assert.equal(state.logs[0].nota_anterior, 75);
  assert.equal(state.logs[0].nota_nueva, 92); assert.equal(state.grade.aprobado, true);
  state.schedule.actas_notas_cerradas = true;
  const before = JSON.stringify([state.grade, state.logs]);
  assert.equal((await request(`/grades/${gradeId}`, 'PATCH', payload)).status, 400);
  assert.equal(JSON.stringify([state.grade, state.logs]), before);
});


test('existing component listing and import validation retain their public behavior', async () => {
  const { request } = fixture();
  const listed = await request(`/grades/component/${scheduleId}`);
  assert.equal(listed.status, 200); assert.deepEqual(listed.body.data, []);
  const imported = await request(`/grades/import/${scheduleId}`, 'POST');
  assert.equal(imported.status, 400); assert.match(imported.body.message, /archivo_excel/);
});

test("PATCH audit failure rolls back grade and leaves prior audit unchanged", async () => {
  const { state, request } = fixture();
  state.role = "SUPER_ADMIN";
  state.grade = {
    id: gradeId,
    programacion_componente_id: scheduleId,
    calificacion_cuantitativa: 75,
    valoracion_cualitativa: "APRENDIZAJE_FUNDAMENTAL",
    aprobado: true,
  };
  state.auditFailure = true;
  const before = JSON.stringify([state.grade, state.logs]);
  assert.equal(
    (await request(`/grades/${gradeId}`, "PATCH", payload)).status,
    500,
  );
  assert.equal(JSON.stringify([state.grade, state.logs]), before);
});
test("PATCH takes schedule lock then rereads grade under row lock before recording audit", async () => {
  const { state, request } = fixture();
  state.role = "SUPER_ADMIN";
  state.grade = {
    id: gradeId,
    programacion_componente_id: scheduleId,
    calificacion_cuantitativa: 75,
    valoracion_cualitativa: "APRENDIZAJE_FUNDAMENTAL",
    aprobado: true,
  };
  const response = await request(`/grades/${gradeId}`, "PATCH", payload);
  assert.equal(response.status, 200);
  const scheduleLock = state.queries.findIndex((q: string) =>
    q.includes("FOR UPDATE OF pcc"),
  );
  const gradeLock = state.queries.findIndex((q: string) =>
    q.includes("FOR UPDATE OF mcs"),
  );
  const write = state.queries.findIndex((q: string) =>
    q.includes("UPDATE matricula_componentes_snepa"),
  );
  assert.ok(scheduleLock >= 0 && gradeLock > scheduleLock && write > gradeLock);
});
