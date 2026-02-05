const path = require("path");
const {
  prisma,
  parseArgs,
  requireEnv,
  getAuthMigrationDate,
  writeJsonLine,
} = require("./_shared");

const LEGACY_REASON = "pre-firebase-migration";

async function main() {
  requireEnv(["DATABASE_URL", "AUTH_MIGRATION_DATE"]);

  const args = parseArgs(process.argv);
  const sampleSize = Number(args.sample ?? 10);
  const logFile =
    args["log-file"] ||
    path.join(
      __dirname,
      "logs",
      `audit-legacy-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`
    );

  const migrationDate = getAuthMigrationDate();

  // Legacy predicate:
  // - No firebaseUid
  // - Created before AUTH_MIGRATION_DATE
  // - Never linked to Firebase (firebaseUid still null)
  const legacyWhere = {
    firebaseUid: null,
    createdAt: { lt: migrationDate },
    authStatus: { in: ["ACTIVE", "LEGACY"] },
    OR: [{ authProvider: null }, { authProvider: "LEGACY" }],
  };

  const totalUsers = await prisma.user.count();
  const legacyCount = await prisma.user.count({ where: legacyWhere });
  const alreadyLegacy = await prisma.user.count({
    where: { authStatus: "LEGACY", legacyReason: LEGACY_REASON },
  });

  const sample = await prisma.user.findMany({
    where: legacyWhere,
    select: {
      id: true,
      email: true,
      createdAt: true,
      authStatus: true,
      authProvider: true,
      legacyReason: true,
    },
    orderBy: { createdAt: "asc" },
    take: sampleSize,
  });

  const summary = {
    totalUsers,
    legacyCandidates: legacyCount,
    alreadyLegacy,
    sampleSize,
  };

  console.log(JSON.stringify(summary, null, 2));
  writeJsonLine(logFile, { type: "summary", ...summary });
  sample.forEach((user) => writeJsonLine(logFile, { type: "sample", user }));
  console.log(`Wrote audit log to ${logFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
