import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "./logger";

let cachedClient: PrismaClient | null = null;
let cachedPool: Pool | null = null;
let cachedUrl: string | null = null;

const DEFAULT_POOL_MAX = 10;

/**
 * Returns a singleton PrismaClient backed by a pg Pool.
 * The pool is rebuilt only when the DATABASE_URL changes.
 *
 * On first creation the pool fires a warmup query (`SELECT 1`) so that at
 * least one TCP connection is already established before real requests arrive.
 */
export function getPrisma(databaseUrl: string): PrismaClient {
  if (cachedClient && cachedUrl === databaseUrl) {
    return cachedClient;
  }

  if (cachedPool) {
    cachedPool.end().catch(() => {});
  }

  const poolMax = Number(process.env.DB_POOL_MAX) || DEFAULT_POOL_MAX;

  const pool = new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
  });

  pool.on("error", (err) => {
    logger.error({ err }, "pg.Pool idle client error");
  });

  pool.query("SELECT 1").then(() => {
    logger.info({ poolMax }, "Database pool warmed up");
  }).catch((err) => {
    logger.warn({ err }, "Database pool warmup failed (non-fatal)");
  });

  const adapter = new PrismaPg(pool);
  cachedClient = new PrismaClient({ adapter });
  cachedPool = pool;
  cachedUrl = databaseUrl;

  logger.info({ poolMax }, "Database pool created");

  return cachedClient;
}

export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  if (!cachedPool) {
    return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  }
  return {
    totalCount: cachedPool.totalCount,
    idleCount: cachedPool.idleCount,
    waitingCount: cachedPool.waitingCount,
  };
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
