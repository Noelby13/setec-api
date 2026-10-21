import { AppError } from '../../middlewares/error.middleware';

/** Read at operation time so unconfigured deployments fail closed without fallback keys. */
export function signingSecret(kind: 'access' | 'refresh'): string {
  const name = kind === 'access' ? 'JWT_SECRET' : 'JWT_REFRESH_SECRET';
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(`Authentication configuration error: ${name} is required`, 503);
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new AppError('Authentication configuration error: access and refresh signing keys must differ', 503);
  }
  return value;
}
