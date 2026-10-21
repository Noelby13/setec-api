import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import express from 'express';
import { pool } from '../db/pool';
import { errorHandler } from './error.middleware';
import { requireTeachingAssignment } from './teaching.middleware';
import { httpRequest } from '../testing/http';

afterEach(() => mock.restoreAll());

for (const allowed of [true, false]) {
  test(`teacher assignment ${allowed ? 'permits own' : 'rejects another'} class`, async () => {
    mock.method(pool, 'query', async () => ({ rows: [{ allowed }] }));
    const app = express();
    app.use((req, _res, next) => { req.user = { id: 'teacher', rol: 'DOCENTE', permisos: ['NOTA_IMPORTAR'] }; next(); });
    app.get('/:programacionComponenteId', requireTeachingAssignment, (_req, res) => res.json({ allowed: true }));
    app.use(errorHandler);
    assert.equal((await httpRequest(app, '/00000000-0000-4000-8000-000000000001')).status, allowed ? 200 : 403);
  });
}
