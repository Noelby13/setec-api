import { z } from 'zod';
export const certificateIdSchema = z.object({ id: z.string().uuid() });
export const certificateTokenSchema = z.object({ token: z.string().uuid() });
export const revokeCertificateSchema = z.object({ motivo: z.string().trim().min(1).max(1000) }).strict();
export const registerCertificateSchema = z.object({}).strict().default({});
export const certificatePaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const certificateListSchema = certificatePaginationSchema.extend({
  search: z.string().trim().max(150).optional(),
  estado: z.enum(['VIGENTE', 'REVOCADO']).optional(),
});
