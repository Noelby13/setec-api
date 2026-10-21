import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateSchema } from '../../middlewares/validate.middleware';
import { requireAuth } from '../../middlewares/auth.middleware';
import { loginSchema, refreshTokenSchema, registerUserSchema, selfProfileSchema } from './auth.schema';

export const authRouter = Router();

/**
 * Public Authentication Routes
 */
authRouter.post('/register', validateSchema(registerUserSchema), AuthController.register);
authRouter.post('/login', validateSchema(loginSchema), AuthController.login);
authRouter.post('/refresh', validateSchema(refreshTokenSchema), AuthController.refreshToken);

/**
 * Protected Authentication Routes
 */
// Refresh-token logout remains public so an expired access token can still be revoked.
// Bearer-only logout authenticates the live session before revoking the user's sessions.
authRouter.post('/logout', (req, res, next) => {
  if (!req.body?.refreshToken && !req.headers['x-refresh-token'] && req.headers.authorization) {
    return requireAuth(req, res, next);
  }
  next();
}, AuthController.logout);
authRouter.get('/profile', requireAuth, AuthController.getProfile);
authRouter.get('/me', requireAuth, AuthController.getProfile);

export default authRouter;

authRouter.patch('/profile', requireAuth, validateSchema(selfProfileSchema), AuthController.updateProfile);
