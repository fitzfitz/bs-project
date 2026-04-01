import { z } from "@hono/zod-openapi";
import {
  AuthProviderEnum,
  RoleScopeEnum,
  BranchSummarySchema,
  PermissionActionsSchema,
} from "../../utils/zod-prisma";

const TenantRoleInUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: RoleScopeEnum,
});

export const AuthUserResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  tenantRoleId: z.string(),
  branchId: z.string().nullable().optional(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string(),
  avatar: z.string().nullable().optional(),
  isCustomer: z.boolean(),
  isActive: z.boolean(),
  authProvider: AuthProviderEnum,
  emailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tenantRole: TenantRoleInUserSchema.nullable(),
  branch: BranchSummarySchema.nullable().optional(),
  permissions: z.record(z.string(), PermissionActionsSchema).optional(),
});

export const UpdateProfileResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  tenantRoleId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable().optional(),
  isCustomer: z.boolean(),
});

export const UserSearchResultSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export const registerSchema = z.object({
  orgSlug: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  orgSlug: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const googleAuthSchema = z.object({
  orgSlug: z.string().optional(),
  idToken: z.string().min(1, "Google ID token is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phone: z.string().optional(),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const notificationPreferencesSchema = z.object({
  emailOptIn: z.boolean(),
});

export const NotificationPreferencesResponseSchema = z.object({
  emailOptIn: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
