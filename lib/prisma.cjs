const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const globalForPrisma = globalThis;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

const pool =
  globalForPrisma.__prismaPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaPool = pool;
}

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    adapter: new PrismaPg(pool),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

module.exports = { prisma };
