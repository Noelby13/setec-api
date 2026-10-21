import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthDao } from '../auth/auth.dao';
import { certificatesRouter } from './certificates.routes';
import { errorHandler } from '../../middlewares/error.middleware';
import { isolatedHttp } from '../auth/http.test-helper';

afterEach(() => mock.restoreAll());

test('certificate HTTP boundary authenticates and limits public requests', async () => {
  process.env.JWT_SECRET = 'isolated-certificate-access';
  process.env.JWT_REFRESH_SECRET = 'isolated-certificate-refresh';
  const userId = randomUUID();
  mock.method(AuthDao, 'findUserById', async () => ({ id: userId, activo: true, rol_nombre: 'ESTUDIANTE', rol_id: 'student' }));
  mock.method(AuthDao, 'getPermissionsByRoleId', async () => []);
  mock.method(AuthDao, 'findActiveSessionById', async () => ({ id: 'session' }));
  const token = jwt.sign({ sub: userId, sid: randomUUID() }, process.env.JWT_SECRET);
  const app = express(); app.use(express.json()); app.use('/api/certificates', certificatesRouter); app.use(errorHandler);
  const { request, close } = isolatedHttp(app);
  try {
    const id = randomUUID();
    assert.equal((await request('/api/certificates/me')).status, 401);
    assert.equal((await request('/api/certificates', 'GET', undefined, token)).status, 403);
    assert.equal((await request(`/api/certificates/${id}/events`, 'GET', undefined, token)).status, 403);
    assert.equal((await request(`/api/certificates/${id}/revoke`, 'POST', { motivo: 'Test' }, token)).status, 403);
    assert.equal((await request(`/api/certificates/expediente/${id}/register`, 'POST', {}, token)).status, 403);
    assert.equal((await request('/api/certificates/verify/not-a-uuid')).status, 400);
  } finally { close(); }
});
