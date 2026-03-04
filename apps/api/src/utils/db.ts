import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

let cachedClient: PrismaClient | null = null;
let cachedPool: Pool | null = null;
let cachedUrl: string | null = null;

/**
 * Returns a singleton PrismaClient backed by a pg Pool.
 * The pool is rebuilt only when the DATABASE_URL changes.
 *
 * On first creation the pool fires a warmup query (`SELECT 1`) so that at
 * least one TCP connection is already established before real requests arrive.
 * This prevents the "cold-start stampede" where many concurrent requests all
 * wait for connection establishment and get killed by the Workers runtime.
 */
export function getPrisma(databaseUrl: string): PrismaClient {
  if (cachedClient && cachedUrl === databaseUrl) {
    return cachedClient;
  }

  if (cachedPool) {
    cachedPool.end().catch(() => {});
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
  });

  pool.on("error", (err) => {
    console.error("[pg.Pool] idle client error:", err.message);
  });

  const adapter = new PrismaPg(pool);
  cachedClient = new PrismaClient({ adapter });
  cachedPool = pool;
  cachedUrl = databaseUrl;
  return cachedClient;
}

/**
 * Only call this for truly fatal scenarios (e.g. credential rotation).
 * Normal transient connection errors should NOT invalidate the pool —
 * pg.Pool handles reconnection internally.
 */
export function invalidateDbCache(): void {
  const pool = cachedPool;
  cachedClient = null;
  cachedPool = null;
  cachedUrl = null;
  if (pool) {
    pool.end().catch(() => {});
  }
}

export function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    (msg.includes("timeout") &&
      (msg.includes("connect") || msg.includes("connection"))) ||
    msg.includes("Connection terminated") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("socket hang up")
  );
}
