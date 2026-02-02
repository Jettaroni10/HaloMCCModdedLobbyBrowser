import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const connectionString = process.env.DATABASE_URL;
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

const modPackDelegates = prisma as typeof prisma & {
  mod?: { findFirst?: unknown };
  modPack?: { findFirst?: unknown };
  modPackMod?: { findFirst?: unknown };
};

const dmmf = (prisma as { _dmmf?: { modelMap?: Record<string, unknown> } })
  ?._dmmf as
  | {
      modelMap?: Record<
        string,
        {
          fields?: Array<{ name?: string }>;
        }
      >;
    }
  | undefined;

const lobbyFields = Array.isArray(dmmf?.modelMap?.Lobby?.fields)
  ? dmmf?.modelMap?.Lobby?.fields
  : [];
const hasModPackRelation =
  lobbyFields.length === 0
    ? true
    : lobbyFields.some((field) => field.name === "modPackId") &&
      lobbyFields.some((field) => field.name === "modPack");

export const modPacksSupported =
  hasModPackRelation &&
  typeof modPackDelegates.mod?.findFirst === "function" &&
  typeof modPackDelegates.modPack?.findFirst === "function" &&
  typeof modPackDelegates.modPackMod?.findFirst === "function";

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
