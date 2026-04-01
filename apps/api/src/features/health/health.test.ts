import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import healthApp from "./health.index";

describe("health", () => {
  it("GET / returns 200 with success envelope", async () => {
    const res = await healthApp.request("http://test/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      message?: string;
      timestamp?: string;
    };
    expect(body.success).toBe(true);
    expect(body.message).toBeTruthy();
    expect(body.timestamp).toBeTruthy();
    expect(() => new Date(body.timestamp!).toISOString()).not.toThrow();
  });

  it("response body includes success, status ok, and ISO-8601 timestamp", async () => {
    const res = await healthApp.request("http://test/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      status: string;
      timestamp: string;
    };
    expect(body.success).toBe(true);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("GET /api/health via mounted path returns same shape", async () => {
    const root = new Hono();
    root.route("/api/health", healthApp);
    const res = await root.request("http://test/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      status: string;
      timestamp: string;
    };
    expect(body.success).toBe(true);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("timestamp parses to a valid UTC instant", async () => {
    const res = await healthApp.request("http://test/");
    const body = (await res.json()) as { timestamp: string };
    const d = new Date(body.timestamp);
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.toISOString()).toBe(body.timestamp);
  });

  it("responds with application/json", async () => {
    const res = await healthApp.request("http://test/");
    expect(res.headers.get("content-type")?.includes("application/json")).toBe(
      true,
    );
  });

  it("wrong method yields 404 from Hono", async () => {
    const res = await healthApp.request("http://test/", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("response includes uptime as a positive number", async () => {
    const res = await healthApp.request("http://test/");
    const body = (await res.json()) as { uptime: number };
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThan(0);
  });

  it("response includes memory stats with rss, heapUsed, heapTotal", async () => {
    const res = await healthApp.request("http://test/");
    const body = (await res.json()) as {
      memory: { rss: number; heapUsed: number; heapTotal: number };
    };
    expect(body.memory).toBeDefined();
    expect(typeof body.memory.rss).toBe("number");
    expect(typeof body.memory.heapUsed).toBe("number");
    expect(typeof body.memory.heapTotal).toBe("number");
  });

  it("response includes version string", async () => {
    const res = await healthApp.request("http://test/");
    const body = (await res.json()) as { version: string };
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });
});
