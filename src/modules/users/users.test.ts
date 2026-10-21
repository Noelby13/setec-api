import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { usersRouter } from './users.routes';
import { UsersDao, AssignableRole } from './users.dao';
import { AuthDao, UserWithRole } from '../auth/auth.dao';
import { errorHandler } from '../../middlewares/error.middleware';
import { isolatedHttp } from '../auth/http.test-helper';

process.env.JWT_SECRET = 'isolated-users-access';
process.env.JWT_REFRESH_SECRET = 'isolated-users-refresh';

test('administrative users HTTP authorization and writes', async (t) => {
  const roles: AssignableRole[] = [
    { id: randomUUID(), nombre: 'ESTUDIANTE', descripcion: null, permisos: [] },
    { id: randomUUID(), nombre: 'MANAGER', descripcion: null, permisos: ['USUARIO_GESTIONAR'] },
    { id: randomUUID(), nombre: 'DOCENTE', descripcion: null, permisos: ['NOTA_IMPORTAR'] },
    { id: randomUUID(), nombre: 'SUPER_ADMIN', descripcion: null, permisos: ['USUARIO_GESTIONAR', 'NOTA_IMPORTAR'] },
  ];
  function user(role: number, name: string): UserWithRole {
    return { id: randomUUID(), username: name, email: `${name}@example.test`, password_hash: 'private', nombres: name, apellidos: 'Test', telefono: null, avatar_url: null, rol_id: roles[role].id, rol_nombre: roles[role].nombre, activo: true, email_verificado: false, created_at: new Date(), updated_at: new Date() };
  }
  const student = user(0, 'student'), manager = user(1, 'manager'), admin = user(3, 'admin');
  const users = [student, manager, admin];
  const saved: Array<[any, string, any]> = [];
  const stub = (target: any, name: string, fn: any) => { saved.push([target, name, target[name]]); target[name] = fn; };
  const revoked: string[] = [];
  stub(AuthDao, 'findUserById', async (id: string) => users.find(u => u.id === id) || null);
  stub(AuthDao, 'getPermissionsByRoleId', async (id: string) => roles.find(r => r.id === id)?.permisos || []);
  stub(AuthDao, 'findActiveSessionById', async () => ({ id: 'session' }));
  stub(AuthDao, 'createUser', async (data: any) => {
    if (users.some(u => u.email === data.email)) throw Object.assign(new Error('duplicate'), { code: '23505' });
    const created = { ...user(0, 'new'), ...data, rol_nombre: roles.find(r => r.id === data.rol_id)!.nombre };
    users.push(created); return created;
  });
  stub(AuthDao, 'revokeAllUserSessions', async (id: string) => { revoked.push(id); });
  stub(UsersDao, 'roles', async () => roles);
  stub(UsersDao, 'list', async (search: string, page: number, limit: number) => {
    const items = users.filter(u => u.email.includes(search));
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length };
  });
  stub(UsersDao, 'update', async (id: string, _expected: string, changes: any) => {
    const target = users.find(u => u.id === id)!;
    Object.assign(target, changes);
    if (changes.rolId) { target.rol_id = changes.rolId; target.rol_nombre = roles.find(r => r.id === changes.rolId)!.nombre; }
    return true;
  });
  const app = express(); app.use(express.json()); app.use('/api/users', usersRouter); app.use(errorHandler);
  const { request, close } = isolatedHttp(app);
  const token = (u: UserWithRole) => jwt.sign({ sub: u.id, rol: u.rol_nombre, sid: randomUUID(), permisos: ['USUARIO_GESTIONAR'] }, process.env.JWT_SECRET!);
  try {
    await t.test('anonymous and student administrative reads and writes are denied', async () => {
      for (const path of ['/api/users', '/api/users/roles']) {
        assert.equal((await request(path)).status, 401);
        assert.equal((await request(path, 'GET', undefined, token(student))).status, 403);
      }
      const before = JSON.stringify(users);
      assert.equal((await request(`/api/users/${student.id}`, 'PATCH', { activo: false })).status, 401);
      assert.equal((await request(`/api/users/${student.id}`, 'PATCH', { activo: false }, token(student))).status, 403);
      assert.equal(JSON.stringify(users), before);
    });
    await t.test('manager sees and assigns only roles within current authority', async () => {
      const result = await request('/api/users/roles', 'GET', undefined, token(manager));
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.data.map((r: any) => r.nombre), ['ESTUDIANTE', 'MANAGER']);
      for (const role of [roles[2], roles[3]]) {
        assert.equal((await request(`/api/users/${student.id}`, 'PATCH', { rolId: role.id }, token(manager))).status, 403);
        assert.equal(student.rol_id, roles[0].id);
      }
    });
    await t.test('administrative create validates strict fields, hashes password, rejects duplicates', async () => {
      const input = { email: 'created@example.test', password: 'password123', nombres: 'Created', apellidos: 'Test', rolId: roles[0].id };
      assert.equal((await request('/api/users', 'POST', { ...input, permisos: ['ALL'] }, token(admin))).status, 400);
      const result = await request('/api/users', 'POST', input, token(admin));
      assert.equal(result.status, 201);
      assert.equal(result.body.data.rol, 'ESTUDIANTE');
      assert.equal(result.body.data.password_hash, undefined);
      assert.equal(await bcrypt.compare(input.password, users[3].password_hash), true);
      assert.equal((await request('/api/users', 'POST', input, token(admin))).status, 409);
      assert.equal(users.length, 4);
    });
    await t.test('list search and pagination never expose password hashes', async () => {
      const result = await request('/api/users?search=student&page=1&limit=5', 'GET', undefined, token(admin));
      assert.equal(result.status, 200);
      assert.equal(result.body.data.total, 1);
      assert.equal(result.body.data.items[0].email, student.email);
      assert.equal(result.body.data.items[0].password_hash, undefined);
      assert.equal((await request('/api/users?limit=10000', 'GET', undefined, token(admin))).status, 400);
    });
    await t.test('self role/status changes and protected super administrator changes are rejected', async () => {
      const before = JSON.stringify(users);
      for (const changes of [{ activo: false }, { rolId: roles[0].id }]) {
        assert.equal((await request(`/api/users/${manager.id}`, 'PATCH', changes, token(manager))).status, 403);
        assert.equal((await request(`/api/users/${admin.id}`, 'PATCH', changes, token(manager))).status, 403);
        assert.equal((await request(`/api/users/${admin.id}`, 'PATCH', changes, token(admin))).status, 403);
      }
      assert.equal(JSON.stringify(users), before);
    });
    await t.test('authorized edits, activation and role assignment persist and revoke sessions', async () => {
      assert.equal((await request(`/api/users/${student.id}`, 'PATCH', { nombres: 'Edited', activo: false }, token(admin))).status, 200);
      assert.equal(student.nombres, 'Edited'); assert.equal(student.activo, false);
      assert.ok(revoked.includes(student.id));
      assert.equal((await request(`/api/users/${student.id}`, 'PATCH', { activo: true, rolId: roles[2].id }, token(admin))).status, 200);
      assert.equal(student.activo, true); assert.equal(student.rol_id, roles[2].id);
    });
  } finally { close(); for (const [target, name, fn] of saved) target[name] = fn; }
});
