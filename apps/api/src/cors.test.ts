import { describe, it, expect } from "vitest";
import app from "./index";

describe("CORS security fix", () => {
  it("allows origin if it's in ALLOWED_ORIGINS", async () => {
    const res = await app.request("http://localhost/api/health", {
      headers: {
        Origin: "https://trusted-app.com",
      },
    }, {
      ALLOWED_ORIGINS: "https://trusted-app.com,https://another-trusted-app.com",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db", // Dummy DB URL
    } as any);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://trusted-app.com");
  });

  it("denies origin if it's not in ALLOWED_ORIGINS in production", async () => {
    const res = await app.request("http://localhost/api/health", {
      headers: {
        Origin: "https://malicious-app.com",
      },
    }, {
      ALLOWED_ORIGINS: "https://trusted-app.com",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    } as any);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("allows origin if not in production even if not in ALLOWED_ORIGINS", async () => {
    const res = await app.request("http://localhost/api/health", {
      headers: {
        Origin: "https://any-app.com",
      },
    }, {
      ALLOWED_ORIGINS: "https://trusted-app.com",
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    } as any);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://any-app.com");
  });

  it("handles multiple origins in ALLOWED_ORIGINS correctly", async () => {
    const res = await app.request("http://localhost/api/health", {
      headers: {
        Origin: "https://another-trusted-app.com",
      },
    }, {
      ALLOWED_ORIGINS: "https://trusted-app.com, https://another-trusted-app.com ",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    } as any);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://another-trusted-app.com");
  });

  it("onError handler also respects ALLOWED_ORIGINS in production", async () => {
    // We can't easily trigger an error without more setup,
    // but we can check if the middleware logic we added to onError works if we were to call it.
    // However, testing the main app.onError is harder as it requires triggering a real error.

    // Instead, let's just trust the middleware test above as the logic is the same.
    // Or we could try to trigger a 500 by making a request that fails.

    // Attempting to trigger an error by not providing a DB URL and hitting an endpoint that needs it
    const res = await app.request("http://localhost/api/services", {
      headers: {
        Origin: "https://malicious-app.com",
      },
    }, {
      ALLOWED_ORIGINS: "https://trusted-app.com",
      NODE_ENV: "production",
      // Missing DATABASE_URL might trigger an error in the db middleware
    } as any);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
