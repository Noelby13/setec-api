import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { AuthDao, UserWithRole } from './auth.dao';
import { AppError } from '../../middlewares/error.middleware';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number; // in seconds (15m = 900s)
}

export interface UserProfileResponse {
  id: string;
  username: string | null;
  email: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  avatar_url: string | null;
  rol: string;
  activo: boolean;
  email_verificado: boolean;
  permisos: string[];
  created_at: Date;
}

export interface LoginResponse {
  user: UserProfileResponse;
  tokens: AuthTokens;
}

export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  private static readonly ACCESS_TOKEN_SECRET =
    process.env.JWT_SECRET || 'super_secret_jwt_access_token_key_snepa_setec_2026';
  private static readonly REFRESH_TOKEN_SECRET =
    process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_token_key_snepa_setec_2026';
  private static readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  private static readonly REFRESH_TOKEN_EXPIRES_IN = '7d';
  private static readonly ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
  private static readonly REFRESH_TOKEN_DAYS = 7;

  /**
   * Helper to hash refresh tokens deterministically using SHA-256 for database indexing.
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates JWT Access Token (15m) with sub, rol, and permissions array.
   */
  private static generateAccessToken(user: UserWithRole, permisos: string[]): string {
    const payload = {
      sub: user.id,
      rol: user.rol_nombre,
      permisos,
    };

    const options: SignOptions = {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN as unknown as number,
    };

    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, options);
  }

  /**
   * Generates JWT Refresh Token (7d).
   */
  private static generateRefreshToken(userId: string): string {
    const payload = {
      sub: userId,
      jti: crypto.randomUUID(),
    };

    const options: SignOptions = {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN as unknown as number,
    };

    return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, options);
  }

  /**
   * Authenticate user with password, issue access/refresh tokens and register session.
   */
  static async login(
    identifier: string,
    passwordPlain: string,
    context: SessionContext = {}
  ): Promise<LoginResponse> {
    const user = await AuthDao.findUserByEmailOrUsername(identifier);

    if (!user) {
      throw new AppError('Invalid email/username or password', 401);
    }

    if (!user.activo) {
      throw new AppError('User account is currently deactivated', 403);
    }

    const isPasswordValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email/username or password', 401);
    }

    const permisos = await AuthDao.getPermissionsByRoleId(user.rol_id);

    const accessToken = this.generateAccessToken(user, permisos);
    const refreshToken = this.generateRefreshToken(user.id);
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiracionToken = new Date();
    expiracionToken.setDate(expiracionToken.getDate() + this.REFRESH_TOKEN_DAYS);

    await AuthDao.createSession({
      usuario_id: user.id,
      direccion_ip: context.ipAddress || null,
      user_agent: context.userAgent || null,
      refresh_token_hash: refreshTokenHash,
      expiracion_token: expiracionToken,
    });

    const userProfile: UserProfileResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      nombres: user.nombres,
      apellidos: user.apellidos,
      telefono: user.telefono,
      avatar_url: user.avatar_url,
      rol: user.rol_nombre,
      activo: user.activo,
      email_verificado: user.email_verificado,
      permisos,
      created_at: user.created_at,
    };

    return {
      user: userProfile,
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      },
    };
  }

  /**
   * Refresh JWT access token using a valid, non-revoked refresh token with token rotation.
   */
  static async refreshToken(
    rawRefreshToken: string,
    context: SessionContext = {}
  ): Promise<AuthTokens> {
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(rawRefreshToken, this.REFRESH_TOKEN_SECRET) as JwtPayload;
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    if (!decoded || !decoded.sub) {
      throw new AppError('Malformed refresh token payload', 401);
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const session = await AuthDao.findActiveSessionByTokenHash(tokenHash);

    if (!session) {
      throw new AppError('Session is invalid, expired, or has been revoked', 401);
    }

    const user = await AuthDao.findUserById(session.usuario_id);
    if (!user || !user.activo) {
      throw new AppError('Associated user account is not active', 401);
    }

    const permisos = await AuthDao.getPermissionsByRoleId(user.rol_id);

    // Revoke old session for Refresh Token Rotation security
    await AuthDao.revokeSession(session.id);

    // Issue brand-new access and refresh token pair
    const newAccessToken = this.generateAccessToken(user, permisos);
    const newRefreshToken = this.generateRefreshToken(user.id);
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    const newExpiration = new Date();
    newExpiration.setDate(newExpiration.getDate() + this.REFRESH_TOKEN_DAYS);

    await AuthDao.createSession({
      usuario_id: user.id,
      direccion_ip: context.ipAddress || session.direccion_ip,
      user_agent: context.userAgent || session.user_agent,
      refresh_token_hash: newRefreshTokenHash,
      expiracion_token: newExpiration,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Revoke active session associated with the provided refresh token.
   */
  static async logout(rawRefreshToken?: string, userId?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await AuthDao.revokeSessionByHash(tokenHash);
    } else if (userId) {
      await AuthDao.revokeAllUserSessions(userId);
    }
  }

  /**
   * Retrieve current authenticated user profile and active permissions.
   */
  static async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await AuthDao.findUserById(userId);

    if (!user) {
      throw new AppError('User profile not found', 404);
    }

    const permisos = await AuthDao.getPermissionsByRoleId(user.rol_id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nombres: user.nombres,
      apellidos: user.apellidos,
      telefono: user.telefono,
      avatar_url: user.avatar_url,
      rol: user.rol_nombre,
      activo: user.activo,
      email_verificado: user.email_verificado,
      permisos,
      created_at: user.created_at,
    };
  }
}
