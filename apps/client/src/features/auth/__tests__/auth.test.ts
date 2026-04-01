import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { renderHook, waitFor, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { useAuth } from "../api/use-auth";
import { useSessionStore } from "../store";
import { LoginSchema, RegisterSchema } from "../types";

const API = "http://localhost:8787/api";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function routerWrapper(
  qc: QueryClient,
  initialEntry: string | { pathname: string; state?: unknown } = "/",
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      React.createElement(QueryClientProvider, { client: qc }, children),
    );
  };
}

describe("auth feature", () => {
  beforeEach(() => {
    localStorage.removeItem("tmng-session-storage");
    useSessionStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  });

  describe("useSessionStore", () => {
    it("setSession and isAuthenticated", () => {
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "at",
        "rt",
      );
      expect(useSessionStore.getState().isAuthenticated()).toBe(true);
      expect(useSessionStore.getState().user?.email).toBe("a@b.com");
    });

    it("setTokens updates only tokens", () => {
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "a1",
        "r1",
      );
      useSessionStore.getState().setTokens("a2", "r2");
      expect(useSessionStore.getState().accessToken).toBe("a2");
      expect(useSessionStore.getState().refreshToken).toBe("r2");
    });

    it("setUser merges user fields", () => {
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "at",
        "rt",
      );
      useSessionStore.getState().setUser({
        id: "u1",
        email: "a@b.com",
        firstName: "Ann",
        lastName: "B",
        tenantRoleId: "tr1",
      });
      expect(useSessionStore.getState().user?.firstName).toBe("Ann");
    });

    it("clearSession removes all session fields", () => {
      useSessionStore.getState().setSession(
        {
          id: "u1",
          email: "a@b.com",
          firstName: "A",
          lastName: "B",
          tenantRoleId: "tr1",
        },
        "at",
        "rt",
      );
      useSessionStore.getState().clearSession();
      expect(useSessionStore.getState().isAuthenticated()).toBe(false);
      expect(useSessionStore.getState().user).toBeNull();
    });
  });

  describe("LoginSchema / RegisterSchema", () => {
    it("accepts valid login payload", () => {
      const r = LoginSchema.safeParse({
        email: "a@b.com",
        password: "12345678",
      });
      expect(r.success).toBe(true);
    });

    it("rejects short password on login", () => {
      const r = LoginSchema.safeParse({ email: "a@b.com", password: "short" });
      expect(r.success).toBe(false);
    });

    it("accepts valid register payload", () => {
      const r = RegisterSchema.safeParse({
        firstName: "Jo",
        lastName: "Do",
        email: "j@d.com",
        password: "12345678",
      });
      expect(r.success).toBe(true);
    });

    it("rejects short first name on register", () => {
      const r = RegisterSchema.safeParse({
        firstName: "J",
        lastName: "Do",
        email: "j@d.com",
        password: "12345678",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("useAuth login", () => {
    it("stores session on successful login", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json({
            success: true,
            data: {
              user: {
                id: "u1",
                email: "c@b.com",
                firstName: "C",
                lastName: "D",
                tenantRoleId: "tr1",
                isCustomer: true,
              },
              accessToken: "atok",
              refreshToken: "rtok",
            },
          }),
        ),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: routerWrapper(qc),
      });

      act(() => {
        result.current.login({
          email: "c@b.com",
          password: "12345678",
        });
      });

      await waitFor(() => {
        expect(useSessionStore.getState().accessToken).toBe("atok");
        expect(useSessionStore.getState().user?.id).toBe("u1");
      });
    });

    it("surfaces error when login fails", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json(
            { success: false, message: "Invalid credentials" },
            { status: 401 },
          ),
        ),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: routerWrapper(qc),
      });

      await act(async () => {
        result.current.login({ email: "x@y.com", password: "12345678" });
      });

      await waitFor(() => expect(result.current.loginError).toBeTruthy());
      expect(useSessionStore.getState().accessToken).toBeNull();
    });

    it("surfaces error when login returns 500", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json(
            { success: false, message: "Internal error" },
            { status: 500 },
          ),
        ),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: routerWrapper(qc),
      });

      await act(async () => {
        result.current.login({ email: "x@y.com", password: "12345678" });
      });

      await waitFor(() => expect(result.current.loginError).toBeTruthy());
      expect(useSessionStore.getState().accessToken).toBeNull();
    });

    it("exposes isLoggingIn while pending", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/login`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            success: true,
            data: {
              user: {
                id: "u1",
                email: "a@b.com",
                firstName: "A",
                lastName: "B",
                tenantRoleId: "tr1",
              },
              accessToken: "a",
              refreshToken: "r",
            },
          });
        }),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: routerWrapper(qc),
      });

      act(() => {
        result.current.login({ email: "a@b.com", password: "12345678" });
      });

      await waitFor(() => expect(result.current.isLoggingIn).toBe(true));
      await waitFor(() => expect(result.current.isLoggingIn).toBe(false));
    });
  });

  describe("useAuth register", () => {
    it("calls register endpoint on mutate", async () => {
      const qc = createQueryClient();
      let called = false;
      server.use(
        http.post(`${API}/auth/register`, async () => {
          called = true;
          return HttpResponse.json({
            success: true,
            data: {
              id: "u-new",
              email: "n@b.com",
              firstName: "N",
              lastName: "W",
              tenantRoleId: "tr1",
            },
          });
        }),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: routerWrapper(qc),
      });

      act(() => {
        result.current.register({
          email: "n@b.com",
          password: "12345678",
          firstName: "N",
          lastName: "W",
        });
      });

      await waitFor(() => expect(called).toBe(true));
    });

    it("surfaces register error on failure", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/register`, () =>
          HttpResponse.json(
            { success: false, message: "Email taken" },
            { status: 409 },
          ),
        ),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: routerWrapper(qc),
      });

      act(() => {
        result.current.register({
          email: "taken@b.com",
          password: "12345678",
          firstName: "T",
          lastName: "K",
        });
      });

      await waitFor(() => expect(result.current.registerError).toBeTruthy());
    });

    it("exposes isRegistering while register is pending", async () => {
      const qc = createQueryClient();
      server.use(
        http.post(`${API}/auth/register`, async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            success: true,
            data: {
              id: "u-new",
              email: "n@b.com",
              firstName: "N",
              lastName: "W",
              tenantRoleId: "tr1",
            },
          });
        }),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: routerWrapper(qc),
      });

      act(() => {
        result.current.register({
          email: "n@b.com",
          password: "12345678",
          firstName: "N",
          lastName: "W",
        });
      });

      await waitFor(() => expect(result.current.isRegistering).toBe(true));
      await waitFor(() => expect(result.current.isRegistering).toBe(false));
    });
  });
});
