import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import express from 'express';
import { httpRequest } from '../testing/http';
import { pool } from '../db/pool';
import { errorHandler } from './error.middleware';
import { requireRecordAccess, requireSelfAssignment } from './ownership.middleware';

afterEach(() => mock.restoreAll());

async function request(user: any, owner: string | null, permissions: string[] = []) {
  let queries = 0;
  mock.method(pool, 'query', async () => {
    queries++;
    return { rows: owner ? [{ usuario_id: owner }] : [] };
  });
  const app = express();
  app.use((req, _res, next) => { req.user = user; next(); });
  app.get('/:id', requireRecordAccess('enrollment', 'id', permissions), (_req, res) => res.json({ success: true }));
  app.use(errorHandler);
  const result = await httpRequest(app, '/00000000-0000-4000-8000-000000000001');
  return { ...result, queries };
}

test('a student can read their own record', async () => {
  assert.equal((await request({ id: 'owner', rol: 'ESTUDIANTE', permisos: [] }, 'owner')).status, 200);
});

test('another student cannot read a record and the stored state is unchanged', async () => {
  const data = { usuario_id: 'owner', amount: 15 };
  const before = JSON.stringify(data);
  const result = await request({ id: 'other', rol: 'ESTUDIANTE', permisos: [] }, data.usuario_id);
  assert.equal(result.status, 403);
  assert.equal(JSON.stringify(data), before);
  assert.equal(result.body.success, false);
});

test('missing and unauthenticated resources fail closed', async () => {
  assert.equal((await request({ id: 'owner', rol: 'ESTUDIANTE', permisos: [] }, null)).status, 404);
  mock.restoreAll();
  const result = await request(undefined, 'owner');
  assert.equal(result.status, 401);
  assert.equal(result.queries, 0);
});

test('only the resource-specific administrative permission bypasses ownership', async () => {
  const user = { id: 'cashier', rol: 'CAJERO', permisos: ['PAGO_VALIDAR'] };
  assert.equal((await request(user, 'owner', ['INSCRIPCION_VALIDAR'])).status, 403);
  mock.restoreAll();
  assert.equal((await request(user, 'owner', ['PAGO_VALIDAR'])).status, 200);
});

test('students cannot bind creation to another account', () => {
  let error: any;
  const req = { user: { id: 'owner', rol: 'ESTUDIANTE', permisos: [] }, body: { usuario_id: 'other' } };
  requireSelfAssignment(req as any, {} as any, value => { error = value; });
  assert.equal(error.statusCode, 403);
  assert.equal(req.body.usuario_id, 'other');
});

test('self assignment defaults to the current user without altering administrative delegation', () => {
  const req: any = { user: { id: 'owner', rol: 'ESTUDIANTE', permisos: [] }, body: {} };
  requireSelfAssignment(req, {} as any, error => { assert.equal(error, undefined); });
  assert.equal(req.body.usuario_id, 'owner');
});
