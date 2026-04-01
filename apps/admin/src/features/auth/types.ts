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
