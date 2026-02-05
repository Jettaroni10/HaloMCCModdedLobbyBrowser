const path = require("path");
const {
  prisma,
  parseArgs,
  requireEnv,
  writeJsonLine,
} = require("./_shared");

const LEGACY_REASON = "pre-firebase-migration";

async function main() {
  requireEnv(["DATABASE_URL"]);

  const args = parseArgs(process.argv);
  const mode = args.hard ? "hard" : "soft";
  const dryRun = Boolean(args["dry-run"] || args.dryRun);
  const limit = args.limit ? Number(args.limit) : null;
  const logFile =
    args["log-file"] ||
    path.join(
      __dirname,
      "logs",
      `${mode}-delete-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`
    );

  if (mode === "hard" && args.confirm !== "DELETE") {
    throw new Error('Hard delete requires --confirm=DELETE');
  }

  const now = new Date();

  const where =
    mode === "soft"
      ? {
          authStatus: "LEGACY",
          legacyReason: LEGACY_REASON,
          firebaseUid: null,
        }
      : {
          authStatus: "DISABLED",
          legacyReason: LEGACY_REASON,
          firebaseUid: null,
        };

  const candidates = await prisma.user.findMany({
    where,
    select: { id: true, email: true, createdAt: true, disabledAt: true },
    take: limit ?? undefined,
  });

  const summary = {
    mode,
    dryRun,
    limit,
    candidates: candidates.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  writeJsonLine(logFile, { type: "summary", ...summary });
  candidates.forEach((user) =>
    writeJsonLine(logFile, { type: "candidate", user })
  );

  if (dryRun || candidates.length === 0) {
    console.log(`No changes applied. Log: ${logFile}`);
    return;
  }

  if (mode === "soft") {
    const ids = candidates.map((user) => user.id);
    const result = await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { authStatus: "DISABLED", disabledAt: now },
    });
    writeJsonLine(logFile, { type: "soft_delete", updated: result.count });
    console.log(`Soft-disabled ${result.count} users. Log: ${logFile}`);
    return;
  }

  const ids = candidates.map((user) => user.id);
  const batchSize = 25;
  let deleted = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const result = await prisma.user.deleteMany({
      where: { id: { in: batch } },
    });
    deleted += result.count;
    writeJsonLine(logFile, {
      type: "hard_delete_batch",
      batchSize: batch.length,
      deleted: result.count,
    });
  }

  writeJsonLine(logFile, { type: "hard_delete", deleted });
  console.log(`Hard-deleted ${deleted} users. Log: ${logFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
