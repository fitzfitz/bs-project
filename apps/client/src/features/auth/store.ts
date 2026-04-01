import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  tenantRole?: { id: string; name: string; scope: string } | null;
  isCustomer?: boolean;
  organization?: OrgCurrency;
} | null;

interface SessionState {
  user: UserSession;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: UserSession, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserSession) => void;
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

      setUser: (user) => set({ user }),
      
      clearSession: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
      
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'tmng-session-storage',
    }
  )
);
