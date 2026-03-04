import { LRUCache } from "lru-cache";
import type { MiddlewareHandler } from "hono";

const cache = new LRUCache<string, { body: string; status: number }>({
  max: 200,
  ttl: 30_000,
});

function buildKey(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

function findPrefix(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return `/${segments.slice(0, 2).join("/")}`;
}

export function cacheMiddleware(ttlMs = 30_000): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method;

    if (method !== "GET") {
      await next();
      const prefix = findPrefix(c.req.path);
      const toDelete = [...cache.keys()].filter((k) => k.startsWith(prefix));
      for (const k of toDelete) cache.delete(k);
      return;
    }

    const qs = c.req.url.includes("?") ? c.req.url.split("?")[1] : "";
    const key = buildKey(c.req.path, qs);
    const cached = cache.get(key);
    if (cached) {
      c.header("X-Cache", "HIT");
      return c.json(JSON.parse(cached.body), cached.status as 200);
    }

    await next();

    if (c.res.status === 200) {
      try {
        const cloned = c.res.clone();
        const body = await cloned.text();
        cache.set(key, { body, status: 200 }, { ttl: ttlMs });
      } catch {
        // cloning failed -- skip caching, response still flows through
      }
    }
    c.header("X-Cache", "MISS");
  };
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  const toDelete = [...cache.keys()].filter((k) => k.includes(pattern));
  for (const k of toDelete) cache.delete(k);
}
