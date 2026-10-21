import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { validateSchema } from '../../middlewares/validate.middleware';
import { UsersService } from './users.service';
import { createManagedUserSchema, updateManagedUserSchema, userIdSchema, userSearchSchema } from './users.schema';

export const usersRouter = Router();
usersRouter.use(requireAuth, requirePermission('USUARIO_GESTIONAR'));
usersRouter.get('/roles', async (req, res, next) => {
  try { res.json({ success: true, data: await UsersService.roles(req.user!) }); }
  catch (error) { next(error); }
});
usersRouter.get('/', validateSchema({ query: userSearchSchema }), async (req, res, next) => {
  try {
    const query = userSearchSchema.parse(req.query);
    res.json({ success: true, data: await UsersService.list(query.search, query.page, query.limit, query.rol) });
  } catch (error) { next(error); }
});
usersRouter.post('/', validateSchema(createManagedUserSchema), async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await UsersService.create(req.user!, req.body) }); }
  catch (error) { next(error); }
});
usersRouter.patch('/:id', validateSchema({ params: userIdSchema, body: updateManagedUserSchema }), async (req, res, next) => {
  try { res.json({ success: true, data: await UsersService.update(req.user!, req.params.id as string, req.body) }); }
  catch (error) { next(error); }
});
