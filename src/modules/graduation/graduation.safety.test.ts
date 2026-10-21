import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, mock } from 'node:test';
import express from 'express';
import { pool } from '../../db/pool';
import { GraduationService } from './graduation.service';
import { GraduationDAO } from './graduation.dao';
import { GraduationController } from './graduation.controller';
import { errorHandler } from '../../middlewares/error.middleware';
import { httpRequest } from '../../testing/http';
import { CertificatesDao } from '../certificates/certificates.dao';

beforeEach(() => mock.method(CertificatesDao, 'available', async () => false));
afterEach(() => mock.restoreAll());

test('public verification includes only minimum certificate metadata', async () => {
  mock.method(GraduationDAO, 'findExpedienteByCodigoRegistro', async () => ({ fecha_emision: '2026-10-21', codigo_registro_titulo_emitido: 'CODE', aspirante_nombres: 'Test', aspirante_apellidos: 'Student', numero_identificacion: 'PRIVATE', tipo_identificacion: 'PRIVATE', documento_final_url: '/uploads/documentos/private.pdf' }));
  const app = express();
  app.get('/:codigoRegistro', GraduationController.verifyGraduationCode);
  app.use(errorHandler);
  const result = await httpRequest(app, '/CODE');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.estudiante, { nombres: 'Test', apellidos: 'Student' });
  assert.equal(JSON.stringify(result.body).includes('PRIVATE'), false);
  assert.equal(result.body.data.documento_digital_url, undefined);
});

test('nonexistent certificates do not verify', async () => {
  mock.method(GraduationDAO, 'findExpedienteByCodigoRegistro', async () => null);
  await assert.rejects(GraduationService.verifyGraduationCode('missing'), (error: any) => error.statusCode === 404);
});

test('matriculation alone never authorizes issuance or changes persisted state', async () => {
  const writes: string[] = [];
  mock.method(pool, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  mock.method(GraduationDAO, 'getGraduationRequirementsContext', async () => ({ inscripcion_id: 'enrollment', inscripcion_estado: 'MATRICULADO_ACTIVO', idioma_egreso_requerido: 'NINGUNO', num_publicaciones_requeridas: 0 }));
  mock.method(GraduationDAO, 'issueExpedienteDocument', async () => { writes.push('issued'); return {}; });
  mock.method(GraduationDAO, 'updateInscripcionEstado', async () => { writes.push('status'); });
  await assert.rejects(GraduationService.issueGraduationDocument('dossier', {} as any, '/uploads/documentos/official.pdf', 'admin'), (error: any) => error.statusCode === 409);
  assert.deepEqual(writes, []);
});

test('an eligible graduate cannot be certified using a nonexistent PDF path', async () => {
  const writes: string[] = [];
  mock.method(pool, 'connect', async () => ({ query: async () => ({ rows: [] }), release() {} }));
  mock.method(GraduationDAO, 'getGraduationRequirementsContext', async () => ({ inscripcion_id: 'enrollment', inscripcion_estado: 'EGRESADO', idioma_egreso_requerido: 'NINGUNO', num_publicaciones_requeridas: 0 }));
  mock.method(GraduationDAO, 'issueExpedienteDocument', async () => { writes.push('issued'); return {}; });
  mock.method(GraduationDAO, 'updateInscripcionEstado', async () => { writes.push('status'); });
  await assert.rejects(GraduationService.issueGraduationDocument('dossier', {} as any, '/uploads/documentos/does-not-exist.pdf', 'admin'), (error: any) => error.statusCode === 400);
  assert.deepEqual(writes, []);
});
