import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import express from 'express';
import { EnrollmentDao } from './enrollment.dao';
import { EnrollmentController } from './enrollment.controller';
import { listEnrollmentsQuerySchema } from './enrollment.schema';
import { validateSchema } from '../../middlewares/validate.middleware';
import { errorHandler } from '../../middlewares/error.middleware';
import { httpRequest } from '../../testing/http';

afterEach(() => mock.restoreAll());
test('program filter narrows applications while unfiltered listing preserves its total', async () => {
  const program = '00000000-0000-4000-8000-000000000001';
  const rows = [{ id: 'first', programa_id: program }, { id: 'second', programa_id: 'other' }];
  mock.method(EnrollmentDao, 'listInscripciones', async (filters: any) => {
    const data = rows.filter(row => !filters.programa_id || row.programa_id === filters.programa_id);
    return { data, total: data.length };
  });
  const app = express();
  app.get('/', validateSchema({ query: listEnrollmentsQuerySchema }), EnrollmentController.listEnrollments);
  app.use(errorHandler);
  const filtered = await httpRequest(app, `/?programa_id=${program}`);
  assert.equal(filtered.status, 200);
  assert.deepEqual(filtered.body.data.map((row: any) => row.id), ['first']);
  assert.equal(filtered.body.pagination.total, 1);
  assert.equal((await httpRequest(app, '/')).body.pagination.total, 2);
});
