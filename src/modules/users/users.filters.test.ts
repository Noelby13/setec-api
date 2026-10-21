import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import express from 'express';
import { UsersDao } from './users.dao';
import { UsersService } from './users.service';
import { userSearchSchema } from './users.schema';
import { errorHandler } from '../../middlewares/error.middleware';
import { httpRequest } from '../../testing/http';

afterEach(() => mock.restoreAll());
test('student total is based on role-filtered accounts rather than all user accounts', async () => {
  mock.method(UsersDao, 'list', async (_search: string, _page: number, _limit: number, role?: string) => {
    const items = [{ id: 'student', rol_nombre: 'ESTUDIANTE' }, { id: 'teacher', rol_nombre: 'DOCENTE' }].filter(row => !role || row.rol_nombre === role);
    return { items, total: items.length };
  });
  const app = express();
  app.get('/', async (req, res, next) => {
    try {
      const query: any = userSearchSchema.parse(req.query);
      res.json({ success: true, data: await (UsersService.list as any)(query.search, query.page, query.limit, query.rol) });
    } catch (error) { next(error); }
  });
  app.use(errorHandler);
  const filtered = await httpRequest(app, '/?rol=ESTUDIANTE');
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.data.total, 1);
  assert.equal(filtered.body.data.items[0].rol, 'ESTUDIANTE');
  assert.equal((await httpRequest(app, '/')).body.data.total, 2);
});
