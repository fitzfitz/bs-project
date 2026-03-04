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

export type LoginResponse = {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      tenantRoleId: string;
      tenantRole?: { name: string; scope: string };
      isCustomer?: boolean;
    };
    accessToken: string;
    refreshToken: string;
  };
};

export type RegisterResponse = {
  success: boolean;
  data: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tenantRoleId: string;
    tenantRole?: { name: string; scope: string };
    isCustomer?: boolean;
  };
};
