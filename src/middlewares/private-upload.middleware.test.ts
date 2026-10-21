import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import express from 'express';
import { pool } from '../db/pool';
import { authorizePrivateUpload, protectUploads, requireOwnedFileReferences } from './private-upload.middleware';
import { errorHandler } from './error.middleware';
import { httpRequest } from '../testing/http';

afterEach(() => mock.restoreAll());

function appFor(user?: any) {
  const app = express();
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use(authorizePrivateUpload);
  app.use((_req, res) => res.json({ allowed: true }));
  app.use(errorHandler);
  return app;
}

test('an owner may download a linked private PDF but another student cannot', async () => {
  mock.method(pool, 'query', async () => ({ rows: [{ usuario_id: 'owner', permiso: 'TITULO_EMITIR' }] }));
  assert.equal((await httpRequest(appFor({ id: 'owner', rol: 'ESTUDIANTE', permisos: [] }), '/documentos/file.pdf')).status, 200);
  assert.equal((await httpRequest(appFor({ id: 'other', rol: 'ESTUDIANTE', permisos: [] }), '/documentos/file.pdf')).status, 403);
});

test('cashier cannot download identity documents using payment permission', async () => {
  mock.method(pool, 'query', async () => ({ rows: [{ usuario_id: 'owner', permiso: 'INSCRIPCION_VALIDAR' }] }));
  assert.equal((await httpRequest(appFor({ id: 'cashier', rol: 'CAJERO', permisos: ['PAGO_VALIDAR'] }), '/documentos/identity.pdf')).status, 403);
});

test('unlinked files and whole-class grade files fail closed for students', async () => {
  mock.method(pool, 'query', async () => ({ rows: [] }));
  const app = appFor({ id: 'owner', rol: 'ESTUDIANTE', permisos: [] });
  assert.equal((await httpRequest(app, '/documentos/unlinked.pdf')).status, 403);
  assert.equal((await httpRequest(app, '/actas_excel/class.xlsx')).status, 403);
});

test('promotional files remain public and personal documents require a session', async () => {
  const app = express();
  app.use(protectUploads);
  app.use((_req, res) => res.json({ allowed: true }));
  app.use(errorHandler);
  assert.equal((await httpRequest(app, '/programas/brochure.pdf')).status, 200);
  assert.equal((await httpRequest(app, '/documentos/identity.pdf')).status, 401);
});

test('a student cannot manufacture file ownership by assigning another students URL', async () => {
  mock.method(pool, 'query', async () => ({ rows: [{ usuario_id: 'other', permiso: 'INSCRIPCION_VALIDAR' }] }));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'owner', rol: 'ESTUDIANTE', permisos: [] }; next(); });
  app.put('/', requireOwnedFileReferences(['cedula_identidad_pdf_url']), (_req, res) => res.json({ saved: true }));
  app.use(errorHandler);
  const response = await httpRequest(app, '/', 'PUT', { cedula_identidad_pdf_url: '/uploads/documentos/other.pdf' });
  assert.equal(response.status, 403);
  assert.equal(response.body.saved, undefined);
});
