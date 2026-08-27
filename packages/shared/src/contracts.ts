import { z } from 'zod';
import { ORG_ROLES } from './rbac';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * Deliberately length-first rather than a symbol-class gauntlet: long
 * passphrases beat short complex passwords, and SME users abandon signup
 * when rules get fussy.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200)
  .refine((v) => v.trim().length >= 10, 'Password cannot be mostly whitespace');

export const nameSchema = z.string().trim().min(1).max(120);

export const orgNameSchema = z.string().trim().min(2).max(120);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  orgName: orgNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  name: nameSchema.optional(),
  role: z.enum(ORG_ROLES),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  name: nameSchema.optional(),
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(ORG_ROLES),
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const updateOrgSchema = z.object({
  name: orgNameSchema.optional(),
});
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().datetime().optional(),
  action: z.string().max(80).optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().uuid().optional(),
});
export type ChatInput = z.infer<typeof chatSchema>;

/** URL-safe org slug derived from a display name. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'org';
}
