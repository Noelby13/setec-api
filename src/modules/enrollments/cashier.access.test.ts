import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import express from 'express';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentController } from './enrollment.controller';
import { errorHandler } from '../../middlewares/error.middleware';
import { httpRequest } from '../../testing/http';

afterEach(() => mock.restoreAll());

test('cashier discovery preserves totals and redacts sensitive academic fields', async () => {
  mock.method(EnrollmentService, 'listEnrollments', async () => ({ total: 30, page: 1, limit: 20, data: [{ id: 'record', codigo_expediente: 'EXP', estado: 'PENDIENTE_PAGO', aspirante_nombres: 'Student', aspirante_identificacion: 'PRIVATE', titulo_denominacion: 'PRIVATE' }] }));
  const app = express();
  app.get('/', EnrollmentController.listCashierEnrollments);
  app.use(errorHandler);
  const result = await httpRequest(app, '/');
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 30);
  assert.equal(result.body.data[0].codigo_expediente, 'EXP');
  assert.equal(JSON.stringify(result.body).includes('PRIVATE'), false);
});
