import { z } from "zod";

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
