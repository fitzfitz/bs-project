import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useSessionStore } from "@/features/auth/store";
import { env } from "@/config/env";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type PaginationResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApiResponse<D> = {
  success: boolean;
  data: D;
  pagination?: PaginationResponse;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// -- Request interceptor: attach access token + org slug ---------------------

client.interceptors.request.use((config) => {
  const token = useSessionStore.getState().accessToken;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (env.VITE_ORG_SLUG) {
    config.headers["X-Org-Slug"] = env.VITE_ORG_SLUG;
  }
  return config;
});

// -- Silent token refresh ----------------------------------------------------

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, clearSession } = useSessionStore.getState();
  if (!refreshToken) {
    clearSession();
    throw new Error("No refresh token");
  }

  try {
    const res = await axios.post<
      ApiResponse<{ accessToken: string; refreshToken: string }>
    >(`${API_URL}/auth/refresh`, { refreshToken });

    const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data;
    useSessionStore.getState().setTokens(newAccess, newRefresh);
    return newAccess;
  } catch {
    clearSession();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
}

// -- Response interceptor: unwrap envelope + 401 retry -----------------------

client.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && body.success === false) {
      throw new ApiError(body.message || "API request failed", response.status);
    }
    return body;
  },
  async (error: AxiosError<{ success: false; message?: string }>) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      try {
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        return Promise.reject(error);
      }
    }

    const message =
      error.response?.data?.message || error.message || "Network error";
    const status = error.response?.status || 0;
    throw new ApiError(message, status);
  },
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    client.get<unknown, T>(url, config),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    client.post<unknown, T>(url, data, config),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    client.patch<unknown, T>(url, data, config),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    client.put<unknown, T>(url, data, config),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    client.delete<unknown, T>(url, config),
};
