import { z } from "@hono/zod-openapi";

export const listUsersQuery = z.object({
  role: z.string().optional(),
  branchId: z.string().optional(),
  search: z.string().optional(),
  isActive: z.string().optional(),
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("20"),
});

export const updateRoleSchema = z.object({
  role: z.enum([
    "CUSTOMER",
    "BARBER",
    "CASHIER",
    "SUPERVISOR",
    "MANAGER",
    "SUPER_ADMIN",
  ]),
});

export const assignBranchSchema = z.object({
  branchId: z.string().min(1),
  position: z.string().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignBranchInput = z.infer<typeof assignBranchSchema>;
