import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateSchema } from '../../middlewares/validate.middleware';
import { requireAuth } from '../../middlewares/auth.middleware';
import { loginSchema, refreshTokenSchema } from './auth.schema';

export const authRouter = Router();

/**
 * Public Authentication Routes
 */
authRouter.post('/login', validateSchema(loginSchema), AuthController.login);
authRouter.post('/refresh', validateSchema(refreshTokenSchema), AuthController.refreshToken);

/**
 * Protected Authentication Routes
 */
authRouter.post('/logout', AuthController.logout);
authRouter.get('/profile', requireAuth, AuthController.getProfile);
authRouter.get('/me', requireAuth, AuthController.getProfile);

export default authRouter;
