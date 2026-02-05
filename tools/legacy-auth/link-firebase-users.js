const path = require("path");
const admin = require("firebase-admin");
const {
  prisma,
  parseArgs,
  requireEnv,
  writeJsonLine,
  sleep,
} = require("./_shared");

const LEGACY_REASON = "pre-firebase-migration";

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  requireEnv([
    "DATABASE_URL",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ]);

  const args = parseArgs(process.argv);
  const dryRun = Boolean(args["dry-run"] || args.dryRun);
  const delayMs = Number(args["delay-ms"] ?? 200);
  const limit = args.limit ? Number(args.limit) : null;
  const logFile =
    args["log-file"] ||
    path.join(
      __dirname,
      "logs",
      `link-firebase-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`
    );

  initFirebaseAdmin();
  const auth = admin.auth();

  const legacyUsers = await prisma.user.findMany({
    where: {
      authStatus: "LEGACY",
      legacyReason: LEGACY_REASON,
      firebaseUid: null,
    },
    select: { id: true, email: true },
    take: limit ?? undefined,
  });

  const summary = {
    dryRun,
    legacyUsers: legacyUsers.length,
    delayMs,
    limit,
  };
  console.log(JSON.stringify(summary, null, 2));
  writeJsonLine(logFile, { type: "summary", ...summary });

  let linked = 0;
  let missing = 0;

  for (const user of legacyUsers) {
    if (!user.email) {
      writeJsonLine(logFile, {
        type: "skip",
        id: user.id,
        reason: "missing_email",
      });
      continue;
    }

    try {
      const record = await auth.getUserByEmail(user.email);
      if (!dryRun) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            firebaseUid: record.uid,
            authStatus: "ACTIVE",
            legacyReason: null,
            disabledAt: null,
          },
        });
      }
      linked += 1;
      writeJsonLine(logFile, {
        type: "linked",
        id: user.id,
        email: user.email,
        firebaseUid: record.uid,
      });
    } catch (error) {
      const code =
        typeof error === "object" &&
        error &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "unknown";
      if (code === "auth/user-not-found") {
        missing += 1;
        writeJsonLine(logFile, {
          type: "missing",
          id: user.id,
          email: user.email,
        });
      } else {
        writeJsonLine(logFile, {
          type: "error",
          id: user.id,
          email: user.email,
          code,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const result = { linked, missing };
  writeJsonLine(logFile, { type: "result", ...result });
  console.log(`Linked: ${linked}, missing: ${missing}. Log: ${logFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
