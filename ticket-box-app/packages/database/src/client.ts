import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Prisma's pool is configured through datasource URL parameters. Apply a
 * bounded default per process while still allowing deployment-specific URL
 * parameters to take precedence.
 */
function databaseUrlWithPoolBudget(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        String(positiveIntegerEnv("DATABASE_CONNECTION_LIMIT", 20)),
      );
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set(
        "pool_timeout",
        String(positiveIntegerEnv("DATABASE_POOL_TIMEOUT_SECONDS", 10)),
      );
    }
    return url.toString();
  } catch {
    console.warn(
      "[database] DATABASE_URL could not be parsed; Prisma pool defaults will be used.",
    );
    return rawUrl;
  }
}

const datasourceUrl = databaseUrlWithPoolBudget();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
