import type { PrismaClient } from "@prisma/client";
import { CONFIG_DEFAULTS } from "./config.schema";

const configCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export class ConfigService {
  /** Clears in-memory config cache (e.g. between Vitest cases that mock `platformConfig`). */
  static clearCache(): void {
    configCache.clear();
  }

  static async getAll(db: PrismaClient) {
    const rows = await db.platformConfig.findMany();
    const result: Record<string, { value: string; updatedBy: string | null; updatedAt: string }> = {};

    for (const [key, defaultVal] of Object.entries(CONFIG_DEFAULTS)) {
      const row = rows.find((r) => r.key === key);
      result[key] = {
        value: row?.value ?? defaultVal,
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt?.toISOString() ?? "",
      };
    }

    return result;
  }

  static async getValue(db: PrismaClient, key: string): Promise<string> {
    const cached = configCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const row = await db.platformConfig.findUnique({ where: { key } });
    const value = row?.value ?? CONFIG_DEFAULTS[key] ?? "";

    configCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
    return value;
  }

  static async updateValue(
    db: PrismaClient,
    key: string,
    value: string,
    updatedBy: string,
    organizationId: string
  ) {
    const row = await db.platformConfig.upsert({
      where: { key },
      update: { value, updatedBy },
      create: { key, value, updatedBy },
    });

    configCache.delete(key);

    await db.auditLog.create({
      data: {
        organizationId,
        action: "UPDATE",
        entityType: "PlatformConfig",
        entityId: key,
        details: { key, newValue: value },
        userId: updatedBy,
      },
    });

    return row;
  }

  static getNumericConfig(db: PrismaClient, key: string, fallback: number): Promise<number> {
    return this.getValue(db, key).then((v) => {
      const n = Number(v);
      return isNaN(n) ? fallback : n;
    });
  }
}
