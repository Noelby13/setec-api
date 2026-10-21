import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import express from 'express';
import { httpRequest } from '../../testing/http';
import { pool } from '../../db/pool';
import { EnrollmentDao } from './enrollment.dao';
import { EnrollmentController } from './enrollment.controller';
import { errorHandler } from '../../middlewares/error.middleware';

afterEach(() => mock.restoreAll());

async function submit(state: string, duplicate = false, applicantId?: string) {
  const persisted: any[] = [];
  const client = { query: async () => ({ rows: [] }), release() {} };
  mock.method(pool, 'connect', async () => client);
  mock.method(EnrollmentDao, 'findAspiranteByUserId', async () => ({ id: 'own-applicant' }));
  mock.method(EnrollmentDao, 'findByAspiranteAndCohorte', async () => duplicate ? { id: 'existing' } : null);
  mock.method(EnrollmentDao, 'getCohorteWithProgramForUpdate', async () => ({ estado_cohorte: state, requiere_titulo_grado_rn: false, cupo_maximo: 10, cupos_actuales_verificados: 0 }));
  mock.method(EnrollmentDao, 'countActiveEnrollmentsInCohorte', async () => 0);
  mock.method(EnrollmentDao, 'createInscripcion', async (data: any) => { persisted.push(data); return { id: 'created', ...data }; });
  mock.method(EnrollmentDao, 'findDetailedById', async () => ({ id: 'created', ...persisted[0] }));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'student', rol: 'ESTUDIANTE', permisos: [] }; next(); });
  app.post('/', EnrollmentController.createEnrollment);
  app.use(errorHandler);
  const result = await httpRequest(app, '/', 'POST', { cohorte_id: 'cohort', aspirante_id: applicantId, rol_participacion: 'ESTUDIANTE_EVALUADO' });
  return { ...result, persisted };
}

for (const state of ['PLANIFICADA', 'QUORUM_ALCANZADO_COBRANDO', 'EN_EJECUCION', 'FINALIZADA_PENDIENTE_EVAL', 'EVALUADA_SETEC', 'CANCELADA']) {
  test(`cohort ${state} cannot receive new applications`, async () => {
    const result = await submit(state);
    assert.equal(result.status, 400);
    assert.deepEqual(result.persisted, []);
  });
}

test('an open cohort creates only a documentary-review application', async () => {
  const result = await submit('INSCRIPCION_ABIERTA');
  assert.equal(result.status, 201);
  assert.equal(result.body.data.estado, 'EN_REVISION_DOCUMENTAL');
  assert.equal(result.persisted[0].aspirante_id, 'own-applicant');
});

test('duplicate application returns conflict without a new record', async () => {
  const result = await submit('INSCRIPCION_ABIERTA', true);
  assert.equal(result.status, 409);
  assert.deepEqual(result.persisted, []);
});

test('students cannot create an application for another applicant', async () => {
  const result = await submit('INSCRIPCION_ABIERTA', false, 'someone-else');
  assert.equal(result.status, 403);
  assert.deepEqual(result.persisted, []);
});

test('own application history exposes real pagination without changing the owner filter', async () => {
  let filters: any;
  mock.method(EnrollmentDao, 'findAspiranteByUserId', async () => ({ id: 'own-applicant' }));
  mock.method(EnrollmentDao, 'listInscripciones', async (input: any) => { filters = input; return { data: [{ id: 'page-two' }], total: 101 }; });
  const app = express();
  app.use((req, _res, next) => { req.user = { id: 'student', rol: 'ESTUDIANTE', permisos: [] }; next(); });
  app.get('/', EnrollmentController.getMyEnrollments);
  app.use(errorHandler);
  const response = await httpRequest(app, '/?page=2&limit=100');
  assert.equal(response.status, 200);
  assert.equal(filters.aspirante_id, 'own-applicant');
  assert.equal(filters.page, 2);
  assert.deepEqual(response.body.pagination, { total: 101, page: 2, limit: 100, totalPages: 2 });
});
