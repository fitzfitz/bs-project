import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginFormValues = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  firstName: z.string().min(2, "First name is too short"),
  lastName: z.string().min(2, "Last name is too short"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterFormValues = z.infer<typeof RegisterSchema>;

export type PermissionActions = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  tenantRoleId: string;
  organizationId: string;
  branchId?: string | null;
  isCustomer?: boolean;
  avatar?: string | null;
  isActive?: boolean;
  authProvider?: string;
  emailVerified?: boolean;
  emailOptIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
  branch?: { id: string; name: string } | null;
  tenantRole?: { id: string; name: string; scope: string } | null;
  staffProfile?: { id: string; tier: string } | null;
  permissions?: Record<string, PermissionActions>;
};

export type LoginResponse = {
  success: true;
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };
};

export type RegisterResponse = {
  success: true;
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };
};
