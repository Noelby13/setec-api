import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginInput, RefreshTokenInput } from './auth.schema';
import { AppError } from '../../middlewares/error.middleware';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.status(201).json({ success: true, message: 'Student account created', data: await AuthService.register(req.body) }); }
    catch (error) { next(error); }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.json({ success: true, data: await AuthService.updateProfile(req.user!.id, req.body) }); }
    catch (error) { next(error); }
  }

  /**
   * Handle user login.
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as LoginInput;
      const identifier = body.identifier || body.email || body.username;

      if (!identifier) {
        throw new AppError('Identifier (email or username) is required', 400);
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip;
      const userAgent = req.get('user-agent');

      const result = await AuthService.login(identifier, body.password, {
        ipAddress: clientIp,
        userAgent,
      });

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token using refresh token.
   * POST /api/auth/refresh
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip;
      const userAgent = req.get('user-agent');

      const tokens = await AuthService.refreshToken(refreshToken, {
        ipAddress: clientIp,
        userAgent,
      });

      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke active session on logout.
   * POST /api/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken =
        (req.body?.refreshToken as string | undefined) ||
        (req.headers['x-refresh-token'] as string | undefined);
      const userId = req.user?.id;

      await AuthService.logout(refreshToken, userId);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve current authenticated user profile.
   * GET /api/auth/profile
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new AppError('Authentication required', 401);
      }

      const profile = await AuthService.getProfile(req.user.id);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
}
