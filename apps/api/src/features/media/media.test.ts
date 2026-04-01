import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockDb,
  mountFeatureWithDb,
  withPrismaScopeChain,
  signTestJwt,
  getTestBindings,
  mockTenantRolePermissions,
} from "../../test/helpers";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, UPLOAD_PREFIXES } from "./media.schema";
import mediaApp from "./media.index";

describe("media.schema", () => {
  it("ALLOWED_MIME_TYPES is subset of image types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
  });

  it("UPLOAD_PREFIXES includes avatars", () => {
    expect(UPLOAD_PREFIXES).toContain("avatars");
  });
});

describe("media HTTP", () => {
  let db: ReturnType<typeof createMockDb>;
  let app: ReturnType<typeof mountFeatureWithDb>;

  beforeEach(() => {
    db = withPrismaScopeChain(createMockDb());
    app = mountFeatureWithDb(mediaApp, db);
    mockTenantRolePermissions(db, []);
    vi.clearAllMocks();
  });

  it("returns 401 without auth on upload", async () => {
    const res = await app.request(
      "/upload?prefix=avatars",
      { method: "POST" },
      getTestBindings(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when S3 is not configured (no RBAC gate before storage check)", async () => {
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      scope: "HQ",
    });
    const fd = new FormData();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    fd.set("file", new File([bytes], "x.jpg", { type: "image/jpeg" }));

    const res = await app.request(
      "/upload?prefix=avatars",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      },
      getTestBindings(),
    );

    expect(res.status).toBe(503);
  });

  it("authenticated user with empty tenant permissions still gets 503 when S3 is not configured", async () => {
    mockTenantRolePermissions(db, []);
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      scope: "HQ",
    });
    const fd = new FormData();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    fd.set("file", new File([bytes], "x.jpg", { type: "image/jpeg" }));

    const res = await app.request(
      "/upload?prefix=avatars",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      },
      getTestBindings(),
    );

    expect(res.status).toBe(503);
  });

  it("returns 400 when multipart body is sent without multipart Content-Type", async () => {
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      scope: "HQ",
    });
    const res = await app.request(
      "/upload?prefix=avatars",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: "not-multipart",
      },
      {
        ...getTestBindings(),
        S3_ENDPOINT: "http://minio",
        S3_ACCESS_KEY: "k",
        S3_SECRET_KEY: "s",
        S3_BUCKET: "bucket",
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid upload prefix query", async () => {
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      scope: "HQ",
    });
    const fd = new FormData();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    fd.set("file", new File([bytes], "x.jpg", { type: "image/jpeg" }));

    const res = await app.request(
      "/upload?prefix=invalid-prefix",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      },
      {
        ...getTestBindings(),
        S3_ENDPOINT: "http://minio",
        S3_ACCESS_KEY: "k",
        S3_SECRET_KEY: "s",
        S3_BUCKET: "bucket",
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth on delete", async () => {
    const res = await app.request(
      "/?key=avatars/foo.jpg",
      { method: "DELETE" },
      getTestBindings(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when file field missing", async () => {
    const token = await signTestJwt({
      sub: "u1",
      organizationId: "org-1",
      tenantRoleId: "role-1",
      scope: "HQ",
    });
    const fd = new FormData();

    const res = await app.request("/upload?prefix=avatars", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    }, {
      ...getTestBindings(),
      S3_ENDPOINT: "http://minio",
      S3_ACCESS_KEY: "k",
      S3_SECRET_KEY: "s",
      S3_BUCKET: "bucket",
    });

    expect(res.status).toBe(400);
  });
});
