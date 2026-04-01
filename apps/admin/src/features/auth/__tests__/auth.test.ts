import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { useLogin } from "../api/use-auth";
import { useAuthMe } from "../api/use-auth-me";
import {
  useSessionStore,
  canAccessAdmin,
  hasPermission,
  hasAnyPermission,
} from "../store";

const API = "http://localhost:8787/api";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function routerWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      MemoryRouter,
      null,
      React.createElement(QueryClientProvider, { client: qc }, children)
    );
  };
}

function qcWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("auth feature", () => {
  beforeEach(() => {
    localStorage.removeItem("tmng-admin-session");
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  describe("useLogin", () => {
    it("stores session and tokens on success", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json({
            success: true,
            data: {
              user: {
                id: "u1",
                email: "a@b.com",
                firstName: "A",
                lastName: "B",
                tenantRoleId: "tr1",
                tenantRole: { name: "Owner", scope: "HQ" },
                staffProfile: null,
                isCustomer: false,
                permissions: {
                  TRANSACTION: {
                    canCreate: true,
                    canRead: true,
                    canUpdate: false,
                    canDelete: false,
                  },
                },
              },
              accessToken: "at",
              refreshToken: "rt",
            },
          })
        )
      );

      const { result } = renderHook(() => useLogin(), {
        wrapper: routerWrapper(qc),
      });

      await act(async () => {
        await result.current.mutateAsync({
          email: "a@b.com",
          password: "secret",
        });
      });

      await waitFor(() => {
        expect(useSessionStore.getState().accessToken).toBe("at");
        expect(useSessionStore.getState().user?.email).toBe("a@b.com");
      });
    });

    it("surfaces error when API returns HTTP 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json(
            { success: false, message: "Internal Server Error" },
            { status: 500 }
          )
        )
      );

      const { result } = renderHook(() => useLogin(), {
        wrapper: routerWrapper(qc),
      });

      await expect(
        result.current.mutateAsync({ email: "x", password: "y" })
      ).rejects.toThrow(/Internal Server Error|API request failed/i);
      expect(useSessionStore.getState().accessToken).toBeNull();
    });

    it("surfaces error when API returns success false", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json(
            { success: false, message: "Invalid credentials" },
            { status: 401 }
          )
        )
      );

      const { result } = renderHook(() => useLogin(), {
        wrapper: routerWrapper(qc),
      });

      await expect(
        result.current.mutateAsync({ email: "x", password: "y" })
      ).rejects.toThrow();
      expect(useSessionStore.getState().accessToken).toBeNull();
    });
  });

  describe("useAuthMe", () => {
    it("does not fetch without access token", () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.get(`${API}/auth/me`, () => {
          called = true;
          return HttpResponse.json({ success: true, data: {} });
        })
      );

      renderHook(() => useAuthMe(), { wrapper: qcWrapper(qc) });
      expect(called).toBe(false);
    });

    it("fetches and merges user fields into session", async () => {
      const qc = createQueryClient();
      useSessionStore.setState({
        accessToken: "tok",
        refreshToken: null,
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
      });

      server.use(
        http.get(`${API}/auth/me`, () =>
          HttpResponse.json({
            success: true,
            data: {
              id: "u1",
              email: "a@b.com",
              firstName: "A",
              lastName: "B",
              tenantRoleId: "tr1",
              tenantRole: { name: "Manager", scope: "BRANCH" },
              staffProfile: { id: "sp1", tier: "SENIOR" },
              isCustomer: false,
              permissions: {
                QUEUE_MANAGEMENT: {
                  canCreate: true,
                  canRead: true,
                  canUpdate: true,
                  canDelete: false,
                },
              },
            },
          })
        )
      );

      renderHook(() => useAuthMe(), { wrapper: qcWrapper(qc) });

      await waitFor(() => {
        const u = useSessionStore.getState().user;
        expect(u?.tenantRole?.scope).toBe("BRANCH");
        expect(u?.staffProfile?.id).toBe("sp1");
        expect(
          hasPermission(u?.permissions, "QUEUE_MANAGEMENT", "canUpdate")
        ).toBe(true);
      });
    });

    it("handles auth me HTTP 500", async () => {
      const qc = createQueryClient();
      useSessionStore.setState({
        accessToken: "tok",
        refreshToken: null,
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
      });

      server.use(
        http.get(`${API}/auth/me`, () =>
          HttpResponse.json(
            { success: false, message: "Internal Server Error" },
            { status: 500 }
          )
        )
      );

      const { result } = renderHook(() => useAuthMe(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("reports loading while auth me request is in flight", async () => {
      const qc = createQueryClient();
      useSessionStore.setState({
        accessToken: "tok",
        refreshToken: null,
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
      });

      server.use(
        http.get(`${API}/auth/me`, async () => {
          await new Promise((r) => setTimeout(r, 80));
          return HttpResponse.json({
            success: true,
            data: {
              id: "u1",
              email: "a@b.com",
              firstName: "A",
              lastName: "B",
              tenantRoleId: "tr1",
              tenantRole: { name: "Manager", scope: "BRANCH" },
              staffProfile: null,
              isCustomer: false,
              permissions: {},
            },
          });
        })
      );

      const { result } = renderHook(() => useAuthMe(), {
        wrapper: qcWrapper(qc),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("handles auth me request failure", async () => {
      const qc = createQueryClient();
      useSessionStore.setState({
        accessToken: "bad",
        refreshToken: null,
        user: {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
      });

      server.use(
        http.get(`${API}/auth/me`, () =>
          HttpResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
          )
        )
      );

      const { result } = renderHook(() => useAuthMe(), {
        wrapper: qcWrapper(qc),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("store helpers (RBAC)", () => {
    it("canAccessAdmin rejects customers and wrong scope", () => {
      expect(canAccessAdmin({ name: "C", scope: "HQ" }, false)).toBe(true);
      expect(canAccessAdmin({ name: "C", scope: "BRANCH" }, false)).toBe(true);
      expect(canAccessAdmin({ name: "C", scope: "CUSTOMER" }, false)).toBe(
        false
      );
      expect(canAccessAdmin({ name: "C", scope: "HQ" }, true)).toBe(false);
      expect(canAccessAdmin(undefined, false)).toBe(false);
    });

    it("hasPermission and hasAnyPermission", () => {
      const p = {
        X: {
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canDelete: false,
        },
      };
      expect(hasPermission(p, "X", "canRead")).toBe(true);
      expect(hasPermission(p, "X", "canCreate")).toBe(false);
      expect(hasPermission(undefined, "X")).toBe(false);
      expect(hasAnyPermission(p, "X")).toBe(true);
      expect(hasAnyPermission(p, "MISSING")).toBe(false);
    });
  });
});
