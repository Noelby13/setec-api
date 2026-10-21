import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface PostgresDatabaseError extends Error {
  code?: string;
  detail?: string;
  table?: string;
  constraint?: string;
  column?: string;
}

export function errorHandler(
  err: Error | AppError | ZodError | PostgresDatabaseError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Custom Operational Errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: formattedErrors,
    });
    return;
  }

  // 3. PostgreSQL Native Error Codes
  const pgErr = err as PostgresDatabaseError;
  if (pgErr.code) {
    switch (pgErr.code) {
      case '23505': // unique_violation
        res.status(409).json({
          success: false,
          code: 'PG_UNIQUE_VIOLATION',
          message: 'A duplicate record already exists with the provided unique information.',
          detail: pgErr.detail,
          constraint: pgErr.constraint,
        });
        return;

      case '23503': // foreign_key_violation
        res.status(400).json({
          success: false,
          code: 'PG_FOREIGN_KEY_VIOLATION',
          message: 'Referenced entity does not exist or has dependent relationships.',
          detail: pgErr.detail,
          constraint: pgErr.constraint,
        });
        return;

      case '23514': // check_violation
        res.status(400).json({
          success: false,
          code: 'PG_CHECK_VIOLATION',
          message: 'The operation violated a database constraint check.',
          detail: pgErr.detail,
          constraint: pgErr.constraint,
        });
        return;

      default:
        break;
    }
  }

  // 4. Unhandled / Internal Server Errors
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { error: err.message, stack: err.stack } : {}),
  });
}
