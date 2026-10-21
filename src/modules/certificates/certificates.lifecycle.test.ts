import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { Duplex } from 'node:stream';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../../db/pool';
import { AuthUserPayload } from '../../middlewares/auth.middleware';
import { errorHandler } from '../../middlewares/error.middleware';
import { AuthDao } from '../auth/auth.dao';
import { GraduationDAO } from '../graduation/graduation.dao';
import { GraduationService } from '../graduation/graduation.service';
import { CertificatesDao, CertificateRecord } from './certificates.dao';
import { CertificatesService } from './certificates.service';
import { certificatesRouter } from './certificates.routes';

// A plain technical PDF fixture with a valid object/xref structure, never an institutional design.
function pdfFixture(text: string): Buffer {
  const content = `BT /F1 12 Tf 30 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let value = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(value)); value += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(value);
  value += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(value);
}
function rawHttp(app: express.Application, target: string, method = 'GET', body?: unknown, token?: string) {
  return new Promise<{ status: number; headers: string; bytes: Buffer; json: any }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    socket.on('error', reject);
    socket.on('finish', () => {
      const raw = Buffer.concat(chunks), split = raw.indexOf('\r\n\r\n'), headers = raw.subarray(0, split).toString(), bytes = raw.subarray(split + 4);
      try { resolve({ status: Number(headers.split(' ')[1]), headers, bytes, json: headers.includes('application/json') ? JSON.parse(bytes.toString()) : undefined }); }
      catch (error) { reject(error); }
    });
    createServer(app).emit('connection', socket);
    const payload = body === undefined ? '' : JSON.stringify(body);
    socket.push(`${method} ${target} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n${token ? `Authorization: Bearer ${token}\r\n` : ''}\r\n${payload}`);
  });
}

test('certificate registry lifecycle, immutable identity, integrity and transactional effects', async (t) => {
  const originalCwd = process.cwd();
  const scratch = await mkdtemp(path.join(tmpdir(), 'uncsm-certificates-'));
  await mkdir(path.join(scratch, 'uploads/documentos'), { recursive: true });
  const document = pdfFixture('Isolated test document');
  await writeFile(path.join(scratch, 'uploads/documentos/fixture.pdf'), document);
  process.chdir(scratch);
  const owner: AuthUserPayload = { id: randomUUID(), rol: 'ESTUDIANTE', permisos: [] };
  const outsider: AuthUserPayload = { id: randomUUID(), rol: 'ESTUDIANTE', permisos: [] };
  const issuer: AuthUserPayload = { id: randomUUID(), rol: 'COORDINADOR', permisos: ['TITULO_EMITIR'] };
  const revoker: AuthUserPayload = { id: randomUUID(), rol: 'REVOCADOR', permisos: ['CERTIFICADO_REVOCAR'] };
  let registryAvailable = true, failAudit = false;
  const source: any = { id: randomUUID(), inscripcion_id: randomUUID(), codigo_registro_titulo_emitido: 'LEGACY-CODE', fecha_emision: '2025-06-10', documento_final_url: '/uploads/documentos/fixture.pdf', tipo_documento_final: 'CERTIFICADO_APROBACION', aspirante_usuario_id: owner.id, aspirante_nombres: 'Original', aspirante_apellidos: 'Recipient', programa_nombre: 'Original Program', codigo_cohorte: 'COH-2025', inscripcion_estado: 'EGRESADO', idioma_egreso_requerido: 'NINGUNO', num_publicaciones_requeridas: 0 };
  let state: { records: CertificateRecord[]; events: any[]; dossier: any; enrollment: string } = { records: [], events: [], dossier: { ...source }, enrollment: 'GRADUADO_O_CERTIFICADO' };
  let snapshot = structuredClone(state);
  mock.method(pool, 'query', async () => { throw new Error('Unexpected direct database access in isolated test'); });
  const client = {
    query: async (sql: string) => {
      if (sql === 'BEGIN') snapshot = structuredClone(state);
      if (sql === 'ROLLBACK') state = structuredClone(snapshot);
      return { rows: [] };
    }, release() {},
  };
  mock.method(pool, 'connect', async () => client);
  mock.method(CertificatesDao, 'available', async () => registryAvailable);
  mock.method(CertificatesDao, 'sourceForRegistration', async (id: string) => id === state.dossier.id ? { ...state.dossier } : null);
  mock.method(CertificatesDao, 'byExpediente', async (id: string) => state.records.find(record => record.expediente_id === id) || null);
  mock.method(CertificatesDao, 'byId', async (id: string) => state.records.find(record => record.id === id) || null);
  mock.method(CertificatesDao, 'byToken', async (token: string) => state.records.find(record => record.token_publico === token) || null);
  mock.method(CertificatesDao, 'byDocumentPath', async (storedUrl: string) => state.records.filter(record => record.documento_url === storedUrl));
  mock.method(CertificatesDao, 'create', async (data: any) => {
    if (state.records.some(record => record.expediente_id === data.expediente_id)) throw Object.assign(new Error('duplicate'), { code: '23505' });
    const record = { ...data, id: randomUUID(), estado: 'VIGENTE', fecha_revocacion: null, motivo_revocacion: null, revocado_por_usuario_id: null };
    state.records.push(record); return record;
  });
  mock.method(CertificatesDao, 'addEvent', async (id: string, action: string, actor: string, reason: string | null) => {
    if (failAudit) throw new Error('isolated audit failure');
    state.events.push({ id: randomUUID(), certificado_id: id, accion: action, fecha: new Date(), actor_id: actor, motivo: reason });
  });
  mock.method(CertificatesDao, 'revoke', async (id: string, actor: string, reason: string) => {
    const record = state.records.find(item => item.id === id && item.estado === 'VIGENTE');
    if (!record) return null;
    Object.assign(record, { estado: 'REVOCADO', fecha_revocacion: new Date(), motivo_revocacion: reason, revocado_por_usuario_id: actor });
    return record;
  });
  mock.method(CertificatesDao, 'events', async (id: string) => state.events.filter(event => event.certificado_id === id));
  mock.method(CertificatesDao, 'list', async (filters: any) => {
    const records = state.records.filter(record => (!filters.ownerId || record.titular_usuario_id === filters.ownerId) && (!filters.estado || record.estado === filters.estado) && (!filters.search || record.titular_nombre.includes(filters.search)));
    return { records: records.slice((filters.page - 1) * filters.limit, filters.page * filters.limit), total: records.length };
  });
  const actors = [owner, outsider, issuer, revoker];
  process.env.JWT_SECRET = 'isolated-certificate-lifecycle-access'; process.env.JWT_REFRESH_SECRET = 'isolated-certificate-lifecycle-refresh';
  mock.method(AuthDao, 'findUserById', async (id: string) => { const actor = actors.find(item => item.id === id); return actor ? { id, activo: true, rol_id: id, rol_nombre: actor.rol } : null; });
  mock.method(AuthDao, 'getPermissionsByRoleId', async (id: string) => actors.find(item => item.id === id)?.permisos || []);
  mock.method(AuthDao, 'findActiveSessionById', async () => ({ id: 'test-session' }));
  const token = (actor: AuthUserPayload) => jwt.sign({ sub: actor.id, sid: randomUUID() }, process.env.JWT_SECRET!);
  const app = express(); app.use(express.json()); app.use('/api/certificates', certificatesRouter); app.use(errorHandler);
  const request = (target: string, method = 'GET', body?: unknown, actor?: AuthUserPayload) => rawHttp(app, `/api/certificates${target}`, method, body, actor ? token(actor) : undefined);
  try {
    await t.test('register rejects unauthorized actors and strict payload without changing state', async () => {
      const before = JSON.stringify(state);
      assert.equal((await request(`/expediente/${source.id}/register`, 'POST', {}, owner)).status, 403);
      assert.equal((await request(`/expediente/${source.id}/register`, 'POST', { titular_nombre: 'Forged' }, issuer)).status, 400);
      assert.equal(JSON.stringify(state), before);
    });
    await t.test('unissued, missing and header-only files cannot be registered', async () => {
      const original = { ...state.dossier };
      try {
        state.dossier = { ...original, fecha_emision: null };
        assert.equal((await request(`/expediente/${source.id}/register`, 'POST', {}, issuer)).status, 409);
        state.dossier = { ...original, documento_final_url: '/uploads/documentos/missing.pdf' };
        assert.equal((await request(`/expediente/${source.id}/register`, 'POST', {}, issuer)).status, 400);
        await writeFile(path.join(scratch, 'uploads/documentos/fake.pdf'), '%PDF-1.4\nThis is not an actual PDF\n%%EOF');
        state.dossier = { ...original, documento_final_url: '/uploads/documentos/fake.pdf' };
        assert.equal((await request(`/expediente/${source.id}/register`, 'POST', {}, issuer)).status, 400);
        assert.equal(state.records.length, 0); assert.equal(state.events.length, 0);
      } finally { state.dossier = original; }
    });
    await t.test('failed registration audit rolls back metadata and leaves issued dossier unchanged', async () => {
      const before = JSON.stringify(state); failAudit = true;
      await assert.rejects(CertificatesService.register(source.id, issuer), /isolated audit failure/);
      failAudit = false; assert.equal(JSON.stringify(state), before);
    });
    await t.test('legacy registration preserves issue date, creates one snapshot and one audit', async () => {
      const result = await request(`/expediente/${source.id}/register`, 'POST', {}, issuer);
      assert.equal(result.status, 201); assert.equal(result.json.data.fecha_emision, source.fecha_emision);
      assert.equal(result.json.data.puede_descargar, true); assert.equal(state.records.length, 1);
      assert.equal(state.records[0].documento_sha256, createHash('sha256').update(document).digest('hex'));
      assert.equal(state.events.length, 1); assert.equal(state.events[0].accion, 'REGISTRADO'); assert.equal(state.events[0].actor_id, issuer.id);
      assert.equal(state.dossier.codigo_registro_titulo_emitido, 'LEGACY-CODE');
      const before = JSON.stringify(state);
      assert.equal((await request(`/expediente/${source.id}/register`, 'POST', {}, issuer)).status, 409);
      assert.equal(JSON.stringify(state), before);
    });
    await t.test('own list enforces identity and administrative list and events respect explicit scope', async () => {
      assert.equal((await request('/me?page=1&limit=100', 'GET', undefined, owner)).json.total, 1);
      assert.equal((await request('/me', 'GET', undefined, outsider)).json.total, 0);
      assert.equal((await request(`/me?ownerId=${owner.id}`, 'GET', undefined, outsider)).status, 400);
      assert.equal((await request('/', 'GET', undefined, owner)).status, 403);
      assert.equal((await request('/?search=Original&estado=VIGENTE', 'GET', undefined, issuer)).json.total, 1);
      const events = await request(`/${state.records[0].id}/events`, 'GET', undefined, revoker);
      assert.equal(events.status, 200); assert.equal(events.json.data[0].accion, 'REGISTRADO');
    });
    await t.test('public verification uses immutable allowlisted metadata and never leaks private identifiers', async () => {
      source.aspirante_nombres = 'Changed'; state.dossier.aspirante_nombres = 'Changed';
      const record = state.records[0];
      const result = await request(`/verify/${record.token_publico}`);
      assert.equal(result.status, 200); assert.equal(result.json.data.titular_nombre, 'Original Recipient');
      assert.equal(result.json.data.integridad_verificada, true); assert.match(result.headers, /cache-control: no-store/i);
      assert.deepEqual(Object.keys(result.json.data).sort(), ['token_publico','estado','titular_nombre','programa_nombre','cohorte_codigo','tipo_documento','fecha_emision','fecha_revocacion','integridad_verificada'].sort());
      for (const secret of [record.id, owner.id, record.expediente_id, record.documento_url, record.documento_sha256]) assert.equal(JSON.stringify(result.json).includes(secret), false);
      assert.equal((await request(`/verify/${randomUUID()}`)).status, 404);
    });
    await t.test('download returns actual checked bytes to owner and administrator; external identity gets404', async () => {
      const id = state.records[0].id;
      assert.equal((await request(`/${id}/download`, 'GET', undefined, outsider)).status, 404);
      for (const actor of [owner, issuer, revoker]) {
        const result = await request(`/${id}/download`, 'GET', undefined, actor);
        assert.equal(result.status, 200); assert.deepEqual(result.bytes, document);
        assert.match(result.headers, /content-type: application\/pdf/i); assert.match(result.headers, /attachment; filename="?certificate-[0-9a-f-]+\.pdf"?/i);
      }
    });
    await t.test('tampered and missing documents fail public verification, download and legacy static guard', async () => {
      const record = state.records[0], file = path.join(scratch, 'uploads/documentos/fixture.pdf');
      for (const changed of [pdfFixture('Tampered isolated test document'), null]) {
        if (changed) await writeFile(file, changed); else await rm(file);
        const result = await request(`/verify/${record.token_publico}`);
        assert.equal(result.status, 409); assert.equal(result.json.data, undefined);
        assert.equal((await request(`/${record.id}/download`, 'GET', undefined, owner)).status, 409);
        await assert.rejects(CertificatesService.assertStoredDocumentDownloadAllowed(record.documento_url, owner), (error: any) => error.statusCode === 409);
        assert.equal((await request('/me', 'GET', undefined, owner)).json.data[0].puede_descargar, false);
      }
      await writeFile(file, document);
    });
    await t.test('issuance authority cannot revoke; invalid reasons and audit failure leave state unchanged', async () => {
      const id = state.records[0].id, before = JSON.stringify(state);
      assert.equal((await request(`/${id}/revoke`, 'POST', { motivo: 'Wrong actor' }, issuer)).status, 403);
      for (const body of [{ motivo: '   ' }, { motivo: 'Reason', estado: 'REVOCADO' }, { motivo: 'x'.repeat(1001) }]) assert.equal((await request(`/${id}/revoke`, 'POST', body, revoker)).status, 400);
      assert.equal(JSON.stringify(state), before);
      failAudit = true;
      await assert.rejects(CertificatesService.revoke(id, revoker, 'Test audit failure'), /isolated audit failure/);
      failAudit = false; assert.equal(JSON.stringify(state), before);
    });
    await t.test('revocation is atomic, audited, public, nondownloadable and cannot be repeated', async () => {
      const record = state.records[0], result = await request(`/${record.id}/revoke`, 'POST', { motivo: '  Institutional test correction  ' }, revoker);
      assert.equal(result.status, 200); assert.equal(result.json.data.estado, 'REVOCADO'); assert.equal(result.json.data.puede_descargar, false);
      assert.equal(state.events.at(-1).motivo, 'Institutional test correction'); assert.equal(state.events.at(-1).actor_id, revoker.id);
      const verify = await request(`/verify/${record.token_publico}`);
      assert.equal(verify.status, 200); assert.equal(verify.json.data.estado, 'REVOCADO'); assert.equal(verify.json.data.integridad_verificada, false);
      assert.equal(JSON.stringify(verify.json).includes('Institutional test correction'), false);
      assert.equal((await request(`/${record.id}/download`, 'GET', undefined, owner)).status, 409);
      await assert.rejects(CertificatesService.assertStoredDocumentDownloadAllowed(record.documento_url, owner), (error: any) => error.statusCode === 409);
      const before = JSON.stringify(state);
      assert.equal((await request(`/${record.id}/revoke`, 'POST', { motivo: 'Again' }, revoker)).status, 409);
      assert.equal(JSON.stringify(state), before);
    });
    await t.test('missing migration returns503 in new APIs while legacy reads report unavailable', async () => {
      registryAvailable = false; const before = JSON.stringify(state);
      assert.equal((await request('/me', 'GET', undefined, owner)).status, 503);
      assert.equal((await request(`/verify/${randomUUID()}`)).status, 503);
      assert.equal((await request(`/expediente/${source.id}/register`, 'POST', {}, issuer)).status, 503);
      assert.equal(JSON.stringify(state), before);
      assert.deepEqual(await CertificatesService.optionalForExpediente(source.id), { available: false, record: null });
      await CertificatesService.assertStoredDocumentDownloadAllowed('/uploads/documentos/legacy.pdf', owner);
      registryAvailable = true;
    });
    mock.method(GraduationDAO, 'getGraduationRequirementsContext', async () => ({ ...state.dossier }));
    mock.method(GraduationDAO, 'issueExpedienteDocument', async (_id: string, data: any) => { Object.assign(state.dossier, data); return { ...state.dossier }; });
    mock.method(GraduationDAO, 'updateInscripcionEstado', async (_id: string, status: string) => { state.enrollment = status; });
    await t.test('new issuance keeps existing gates and commits dossier, registry and event in one transaction', async () => {
      state.dossier = { ...source, id: randomUUID(), codigo_registro_titulo_emitido: null, fecha_emision: null, inscripcion_estado: 'EGRESADO' }; state.enrollment = 'EGRESADO';
      const before = JSON.stringify(state); failAudit = true;
      await assert.rejects(GraduationService.issueGraduationDocument(state.dossier.id, {} as any, source.documento_final_url, issuer.id), /isolated audit failure/);
      failAudit = false; assert.equal(JSON.stringify(state), before);
      registryAvailable = false;
      await assert.rejects(GraduationService.issueGraduationDocument(state.dossier.id, {} as any, source.documento_final_url, issuer.id), (error: any) => error.statusCode === 503);
      assert.equal(JSON.stringify(state), before); registryAvailable = true;
      const result = await GraduationService.issueGraduationDocument(state.dossier.id, {} as any, source.documento_final_url, issuer.id);
      assert.ok(result.expediente.fecha_emision); assert.equal(state.enrollment, 'GRADUADO_O_CERTIFICADO');
      assert.equal(state.records.length, 2); assert.equal(state.events.at(-1).accion, 'EMITIDO');
      assert.equal(state.records.at(-1)!.expediente_id, state.dossier.id);
      assert.equal(state.records.at(-1)!.fecha_emision, state.dossier.fecha_emision);
      const committed = JSON.stringify(state);
      await assert.rejects(GraduationService.issueGraduationDocument(state.dossier.id, {} as any, source.documento_final_url, issuer.id));
      assert.equal(JSON.stringify(state), committed);
    });
    await t.test('legacy verification cannot report revoked certificates valid or rewrite issued names', async () => {
      const record = state.records[0];
      mock.method(GraduationDAO, 'findExpedienteByCodigoRegistro', async () => ({ expediente_id: record.expediente_id, fecha_emision: record.fecha_emision, codigo_registro_titulo_emitido: 'LEGACY-CODE', aspirante_nombres: 'Changed', aspirante_apellidos: 'Name', programa_nombre: 'Changed program' }));
      const result = await GraduationService.verifyGraduationCode('LEGACY-CODE');
      assert.equal(result.autenticidad_verificada, false); assert.equal(result.estado_certificado, 'REVOCADO');
      assert.equal(`${result.estudiante.nombres} ${result.estudiante.apellidos}`.trim(), 'Original Recipient');
      assert.equal(result.programa.nombre, 'Original Program');
    });
    assert.deepEqual(await readFile(path.join(scratch, 'uploads/documentos/fixture.pdf')), document);
  } finally {
    mock.restoreAll(); process.chdir(originalCwd); await rm(scratch, { recursive: true, force: true });
  }
});
