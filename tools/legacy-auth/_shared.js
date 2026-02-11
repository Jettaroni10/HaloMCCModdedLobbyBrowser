const fs = require("fs");
const path = require("path");
const { prisma } = require("../../lib/prisma.cjs");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;
    const [rawKey, rawValue] = part.slice(2).split("=");
    if (rawValue !== undefined) {
      args[rawKey] = rawValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[rawKey] = next;
      i += 1;
      continue;
    }
    args[rawKey] = true;
  }
  return args;
}

function requireEnv(keys) {
  const missing = keys.filter(
    (key) => !process.env[key] || String(process.env[key]).trim().length === 0
  );
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function parseDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return date;
}

function getAuthMigrationDate() {
  const raw = process.env.AUTH_MIGRATION_DATE;
  return parseDate(raw, "AUTH_MIGRATION_DATE");
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonLine(filePath, payload) {
  ensureDir(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  prisma,
  parseArgs,
  requireEnv,
  getAuthMigrationDate,
  writeJsonLine,
  sleep,
};
