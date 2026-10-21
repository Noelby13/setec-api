import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { isolatedHttp } from './http.test-helper';
import { AuthDao, UserWithRole } from './auth.dao';
import { authRouter } from './auth.routes';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { errorHandler } from '../../middlewares/error.middleware';

process.env.JWT_SECRET = 'isolated-access-key';
process.env.JWT_REFRESH_SECRET = 'isolated-refresh-key';

// Exercise the real HTTP router without importing the application or opening a database connection.
test('identity HTTP security and account lifecycle', async (t) => {
  const studentRole = randomUUID();
  const student: UserWithRole = {
    id: randomUUID(), username: 'student', email: 'student@example.test',
    password_hash: await bcrypt.hash('password123', 4), nombres: 'Test', apellidos: 'Student',
    telefono: null, avatar_url: null, rol_id: studentRole, rol_nombre: 'ESTUDIANTE',
    activo: true, email_verificado: false, created_at: new Date(), updated_at: new Date(),
  };
  const users = [student];
  const saved = new Map<string, unknown>();
  function stub(name: string, value: unknown) {
    saved.set(name, (AuthDao as any)[name]);
    (AuthDao as any)[name] = value;
  }
  const sessions: any[] = [];
  stub('findUserById', async (id: string) => users.find(u => u.id === id) || null);
  stub('findUserByEmailOrUsername', async (value: string) => users.find(u => u.email === value || u.username === value) || null);
  let livePermissions: string[] = [];
  stub('getPermissionsByRoleId', async () => livePermissions);
  stub('findRoleByName', async () => ({ id: studentRole, nombre: 'ESTUDIANTE' }));
  stub('createUser', async (data: any) => {
    if (users.some(u => u.email === data.email || (data.username && u.username === data.username))) {
      throw Object.assign(new Error('duplicate'), { code: '23505' });
    }
    const user = { ...student, ...data, id: randomUUID(), rol_nombre: 'ESTUDIANTE' };
    users.push(user);
    return user;
  });
  stub('createSession', async (data: any) => {
    const session = { ...data, id: randomUUID(), is_token_revocado: false };
    sessions.push(session);
    return session;
  });
  stub('findActiveSessionById', async (id: string, userId: string) => sessions.find(s => s.id === id && s.usuario_id === userId && !s.is_token_revocado) || null);
  stub('findActiveSessionByTokenHash', async (hash: string) => sessions.find(s => s.refresh_token_hash === hash && !s.is_token_revocado) || null);
  stub('revokeSessionByHash', async (hash: string) => sessions.filter(s => s.refresh_token_hash === hash).forEach(s => s.is_token_revocado = true));
  stub('revokeAllUserSessions', async (id: string) => sessions.filter(s => s.usuario_id === id).forEach(s => s.is_token_revocado = true));
  stub('consumeSession', async (id: string) => {
    const session = sessions.find(s => s.id === id && !s.is_token_revocado);
    if (!session) return false;
    session.is_token_revocado = true; return true;
  });
  stub('revokeSession', async (id: string) => sessions.filter(s => s.id === id).forEach(s => s.is_token_revocado = true));
  stub('updateProfile', async (id: string, changes: any) => Object.assign(users.find(u => u.id === id)!, changes));
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.get('/protected', requireAuth, requirePermission('USUARIO_GESTIONAR'), (_req, res) => { res.json({ success: true }); });
  app.use(errorHandler);
  const { request, close } = isolatedHttp(app);
  try {
    const registration = { email: 'new@example.test', password: 'password123', nombres: 'New', apellidos: 'Student' };
    await t.test('public registration rejects every privileged field and leaves records unchanged', async () => {
      for (const field of ['rolId', 'role', 'permissions', 'activo', 'email_verificado']) {
        const result = await request('/api/auth/register', 'POST', { ...registration, [field]: randomUUID() });
        assert.equal(result.status, 400);
        assert.equal(users.length, 1);
      }
    });
    await t.test('public registration hashes the password and resolves student role', async () => {
      const result = await request('/api/auth/register', 'POST', registration);
      assert.equal(result.status, 201);
      assert.equal(result.body.success, true);
      assert.equal(result.body.data.rol, 'ESTUDIANTE');
      assert.equal(result.body.data.password_hash, undefined);
      assert.equal(users.length, 2);
      assert.equal(users[1].rol_id, studentRole);
      assert.equal(await bcrypt.compare(registration.password, users[1].password_hash), true);
    });
    await t.test('duplicate registration returns conflict without another record', async () => {
      const result = await request('/api/auth/register', 'POST', registration);
      assert.equal(result.status, 409);
      assert.equal(users.length, 2);
    });
    await t.test('registration rejects empty names and oversized bcrypt passwords', async () => {
      const before = users.length;
      for (const input of [{ nombres: '   ' }, { password: 'é'.repeat(37) }]) {
        assert.equal((await request('/api/auth/register', 'POST', { ...registration, email: 'other@example.test', ...input })).status, 400);
        assert.equal(users.length, before);
      }
    });
    await t.test('missing student role disables registration without creating an account', async () => {
      const roleFinder = (AuthDao as any).findRoleByName;
      (AuthDao as any).findRoleByName = async () => null;
      try {
        const before = users.length;
        assert.equal((await request('/api/auth/register', 'POST', { ...registration, email: 'other@example.test' })).status, 503);
        assert.equal(users.length, before);
      } finally { (AuthDao as any).findRoleByName = roleFinder; }
    });
    let accessToken = '';
    let refreshToken = '';
    await t.test('existing login success envelope and invalid credentials are preserved', async () => {
      const bad = await request('/api/auth/login', 'POST', { identifier: student.email, password: 'wrong' });
      assert.equal(bad.status, 401);
      const result = await request('/api/auth/login', 'POST', { identifier: student.email, password: 'password123' });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.user.email, student.email);
      assert.equal(result.body.data.tokens.tokenType, 'Bearer');
      assert.equal(result.body.data.tokens.expiresIn, 900);
      accessToken = result.body.data.tokens.accessToken;
      refreshToken = result.body.data.tokens.refreshToken;
    });
    await t.test('self profile update permits names and rejects escalation without mutation', async () => {
      const result = await request('/api/auth/profile', 'PATCH', { nombres: 'Updated' }, accessToken);
      assert.equal(result.status, 200);
      assert.equal(student.nombres, 'Updated');
      for (const changes of [{ rolId: randomUUID() }, { activo: false }, { permisos: ['USUARIO_GESTIONAR'] }, { password: 'new-password' }]) {
        const before = JSON.stringify(student);
        assert.equal((await request('/api/auth/profile', 'PATCH', changes, accessToken)).status, 400);
        assert.equal(JSON.stringify(student), before);
      }
    });
    await t.test('live account and permissions override stale JWT claims', async () => {
      const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
      const forgedStale = jwt.sign({ sub: student.id, rol: 'SUPER_ADMIN', permisos: ['USUARIO_GESTIONAR'], sid: decoded.sid }, process.env.JWT_SECRET!);
      assert.equal((await request('/protected', 'GET', undefined, forgedStale)).status, 403);
      student.activo = false;
      assert.equal((await request('/api/auth/profile', 'GET', undefined, accessToken)).status, 401);
      student.activo = true;
      assert.equal((await request('/api/auth/profile', 'GET', undefined, accessToken)).status, 200);
    });
    await t.test('permission removal and account deletion take effect on an existing token', async () => {
      livePermissions = ['USUARIO_GESTIONAR'];
      assert.equal((await request('/protected', 'GET', undefined, accessToken)).status, 200);
      livePermissions = [];
      assert.equal((await request('/protected', 'GET', undefined, accessToken)).status, 403);
      users.shift();
      assert.equal((await request('/api/auth/profile', 'GET', undefined, accessToken)).status, 401);
      users.unshift(student);
    });
    await t.test('legacy tokens without session binding require a new login', async () => {
      const legacy = jwt.sign({ sub: student.id, rol: student.rol_nombre }, process.env.JWT_SECRET!);
      assert.equal((await request('/api/auth/profile', 'GET', undefined, legacy)).status, 401);
    });
    await t.test('refresh preserves envelope and rotates both session-bound tokens', async () => {
      assert.equal((await request('/api/auth/refresh', 'POST', { refreshToken: 'invalid' })).status, 401);
      const oldAccess = accessToken, oldRefresh = refreshToken;
      const result = await request('/api/auth/refresh', 'POST', { refreshToken });
      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.equal(result.body.data.tokenType, 'Bearer');
      accessToken = result.body.data.accessToken; refreshToken = result.body.data.refreshToken;
      assert.notEqual(accessToken, oldAccess); assert.notEqual(refreshToken, oldRefresh);
      assert.equal((await request('/api/auth/profile', 'GET', undefined, oldAccess)).status, 401);
      assert.equal((await request('/api/auth/profile', 'GET', undefined, accessToken)).status, 200);
      assert.equal((await request('/api/auth/refresh', 'POST', { refreshToken: oldRefresh })).status, 401);
    });
    await t.test('concurrent refresh consumes the old session exactly once', async () => {
      const results = await Promise.all([
        request('/api/auth/refresh', 'POST', { refreshToken }),
        request('/api/auth/refresh', 'POST', { refreshToken }),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 401]);
      const success = results.find(result => result.status === 200)!;
      accessToken = success.body.data.accessToken; refreshToken = success.body.data.refreshToken;
      assert.equal((await request('/api/auth/profile', 'GET', undefined, accessToken)).status, 200);
    });
    await t.test('missing or equal signing keys fail closed before session mutation', async () => {
      const access = process.env.JWT_SECRET, refresh = process.env.JWT_REFRESH_SECRET;
      const before = JSON.stringify(sessions);
      try {
        delete process.env.JWT_SECRET;
        let result = await request('/api/auth/login', 'POST', { identifier: student.email, password: 'password123' });
        assert.equal(result.status, 503); assert.match(result.body.message, /JWT_SECRET is required/);
        assert.equal((await request('/api/auth/profile', 'GET', undefined, accessToken)).status, 503);
        process.env.JWT_SECRET = access;
        delete process.env.JWT_REFRESH_SECRET;
        result = await request('/api/auth/refresh', 'POST', { refreshToken });
        assert.equal(result.status, 503); assert.match(result.body.message, /JWT_REFRESH_SECRET is required/);
        process.env.JWT_REFRESH_SECRET = access;
        assert.equal((await request('/api/auth/login', 'POST', { identifier: student.email, password: 'password123' })).status, 503);
        assert.equal(JSON.stringify(sessions), before);
      } finally { process.env.JWT_SECRET = access; process.env.JWT_REFRESH_SECRET = refresh; }
    });
    await t.test('logout invalidates session-bound access token', async () => {
      assert.equal((await request('/api/auth/logout', 'POST', { refreshToken })).status, 200);
      assert.equal((await request('/api/auth/profile', 'GET', undefined, accessToken)).status, 401);
    });
    await t.test('bearer-only logout authenticates and revokes sessions', async () => {
      const login = await request('/api/auth/login', 'POST', { username: student.username, password: 'password123' });
      assert.equal(login.status, 200);
      const bearer = login.body.data.tokens.accessToken;
      assert.equal((await request('/api/auth/logout', 'POST', {}, bearer)).status, 200);
      assert.equal((await request('/api/auth/profile', 'GET', undefined, bearer)).status, 401);
    });
  } finally {
    close();
    for (const [name, value] of saved) (AuthDao as any)[name] = value;
  }
});
