import { z } from 'zod';
import { accountFields, accountPassword } from '../auth/auth.schema';

export const createManagedUserSchema = z.object({
  ...accountFields, password: accountPassword, rolId: z.string().uuid(), activo: z.boolean().optional(),
}).strict();
export const updateManagedUserSchema = z.object({
  ...accountFields, rolId: z.string().uuid(), activo: z.boolean(),
}).partial().strict().refine(value => Object.keys(value).length > 0, 'At least one user field is required');
export const userIdSchema = z.object({ id: z.string().uuid() });
export const userSearchSchema = z.object({
  rol: z.string().trim().min(1).max(50).optional(),
  search: z.string().trim().max(150).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type ManagedUserInput = z.infer<typeof createManagedUserSchema>;
