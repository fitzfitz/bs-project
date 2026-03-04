import { create } from "zustand";
import { persist } from "zustand/middleware";

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
