export type LoginRequest = { email: string; password: string };

export type LoginResponse = {
  success: true;
  data: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      tenantRoleId: string;
      tenantRole?: { name: string; scope: string };
      staffProfile?: { id: string; tier: string } | null;
      isCustomer?: boolean;
      permissions?: Record<string, { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }>;
    };
    accessToken: string;
    refreshToken: string;
  };
};
