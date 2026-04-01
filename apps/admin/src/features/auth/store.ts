import { create } from "zustand";
import { persist } from "zustand/middleware";

type FeaturePermission = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

type OrgCurrency = {
  currency: string;
  currencySymbol: string;
  locale: string;
};

type UserSession = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantRoleId: string;
  branchId?: string | null;
  tenantRole?: { name: string; scope: string } | null;
  staffProfile?: { id: string; tier: string } | null;
  isCustomer?: boolean;
  permissions?: Record<string, FeaturePermission>;
  organization?: OrgCurrency;
} | null;

interface SessionState {
  user: UserSession;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: UserSession, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (updates: Partial<NonNullable<UserSession>>) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      updateUser: (updates) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...updates } : null,
        })),
      clearSession: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: "tmng-admin-session" }
  )
);

export function canAccessAdmin(
  tenantRole: { name: string; scope: string } | null | undefined,
  isCustomer?: boolean
): boolean {
  if (isCustomer) return false;
  const scope = tenantRole?.scope;
  return scope === "HQ" || scope === "BRANCH";
}

export function hasPermission(
  permissions: Record<string, FeaturePermission> | undefined,
  feature: string,
  action: "canCreate" | "canRead" | "canUpdate" | "canDelete" = "canRead"
): boolean {
  if (!permissions) return false;
  return permissions[feature]?.[action] ?? false;
}

export function hasAnyPermission(
  permissions: Record<string, FeaturePermission> | undefined,
  feature: string
): boolean {
  if (!permissions) return false;
  const p = permissions[feature];
  if (!p) return false;
  return p.canCreate || p.canRead || p.canUpdate || p.canDelete;
}
