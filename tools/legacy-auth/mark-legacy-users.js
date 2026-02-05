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
  const dryRun = Boolean(args["dry-run"] || args.dryRun);
  const sampleSize = Number(args.sample ?? 10);
  const logFile =
    args["log-file"] ||
    path.join(
      __dirname,
      "logs",
      `mark-legacy-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`
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

  const candidates = await prisma.user.findMany({
    where: legacyWhere,
    select: {
      id: true,
      email: true,
      createdAt: true,
      authStatus: true,
      authProvider: true,
    },
  });

  const sample = candidates.slice(0, sampleSize);
  const summary = {
    dryRun,
    legacyCandidates: candidates.length,
    sampleSize,
  };

  console.log(JSON.stringify(summary, null, 2));
  writeJsonLine(logFile, { type: "summary", ...summary });
  sample.forEach((user) => writeJsonLine(logFile, { type: "sample", user }));

  if (dryRun || candidates.length === 0) {
    console.log(`No updates applied. Log: ${logFile}`);
    return;
  }

  const ids = candidates.map((user) => user.id);
  const result = await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: {
      authStatus: "LEGACY",
      legacyReason: LEGACY_REASON,
      disabledAt: null,
    },
  });

  writeJsonLine(logFile, { type: "update", updated: result.count });
  console.log(`Marked ${result.count} users as LEGACY. Log: ${logFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
