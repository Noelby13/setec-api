import { z } from 'zod';

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Email or username is required').optional(),
    email: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.username), {
    message: 'Email, username, or identifier must be provided',
    path: ['identifier'],
  });

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const accountFields = {
  email: z.string().trim().toLowerCase().email('Invalid email address').max(150),
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  telefono: z.string().trim().max(30).optional(),
};
// bcrypt processes at most 72 bytes. Reject longer input instead of silently truncating it.
export const accountPassword = z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must not exceed 72 bytes');
export const registerUserSchema = z.object({ ...accountFields, password: accountPassword }).strict();
export const selfProfileSchema = z.object(accountFields).partial().strict()
  .refine(value => Object.keys(value).length > 0, 'At least one profile field is required');
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type SelfProfileInput = z.infer<typeof selfProfileSchema>;
