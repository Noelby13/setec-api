import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export interface RequestValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validateSchema(schema: ZodSchema | RequestValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if ('parseAsync' in schema || 'parse' in schema) {
        req.body = await (schema as ZodSchema).parseAsync(req.body);
      } else {
        const { body, query, params } = schema as RequestValidationSchemas;
        if (body) {
          req.body = await body.parseAsync(req.body);
        }
        if (query) {
          const parsedQuery = (await query.parseAsync(req.query)) as Request['query'];
          Object.defineProperty(req, 'query', {
            value: parsedQuery,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
        if (params) {
          const parsedParams = (await params.parseAsync(req.params)) as Request['params'];
          Object.defineProperty(req, 'params', {
            value: parsedParams,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const validateRequest = validateSchema;
