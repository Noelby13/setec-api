import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import express from 'express';
import { ApplicantDao } from './applicant.dao';
import { ApplicantController } from './applicant.controller';
import { updateAcademicDegreeSchema } from './applicant.schema';
import { validateSchema } from '../../middlewares/validate.middleware';
import { errorHandler } from '../../middlewares/error.middleware';
import { httpRequest } from '../../testing/http';

afterEach(() => mock.restoreAll());
test('correcting a submitted degree returns it to review without creating another record', async () => {
  const persisted: any = { id: 'degree', denominacion_titulo: 'Previous title', estado_validacion: 'VALIDADO' };
  mock.method(ApplicantDao, 'getAcademicDegreeById', async () => ({ ...persisted }));
  mock.method(ApplicantDao, 'updateAcademicDegree', async (_id: string, data: any) => {
    Object.assign(persisted, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
    return { ...persisted };
  });
  const app = express();
  app.use(express.json());
  app.put('/:degreeId', validateSchema({ body: updateAcademicDegreeSchema }), ApplicantController.updateAcademicDegree);
  app.use(errorHandler);
  const result = await httpRequest(app, '/degree', 'PUT', { denominacion_titulo: 'Corrected title' });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.id, 'degree');
  assert.equal(result.body.data.estado_validacion, 'PENDIENTE');
  assert.equal(persisted.denominacion_titulo, 'Corrected title');
  persisted.estado_validacion = 'VALIDADO';
  const unchanged = await httpRequest(app, '/degree', 'PUT', {});
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.body.data.estado_validacion, 'VALIDADO');
  const before = JSON.stringify(persisted);
  const forbidden = await httpRequest(app, '/degree', 'PUT', { estado_validacion: 'VALIDADO' });
  assert.equal(forbidden.status, 400);
  assert.equal(JSON.stringify(persisted), before);
});
