import "server-only";

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_STORAGE_BUCKET",
  "ABLY_API_KEY",
  "CRON_SECRET",
] as const;

const OPTIONAL_ENV_VARS = [
  "ADMIN_EMAILS",
  "DEV_USER_ID",
  "NEXT_PUBLIC_GA_ID",
  "PERF_LOGS",
] as const;

function checkEnv() {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || String(process.env[key]).trim().length === 0
  );

  if (process.env.NODE_ENV !== "production") {
    const missingOptional = OPTIONAL_ENV_VARS.filter(
      (key) => !process.env[key] || String(process.env[key]).trim().length === 0
    );
    if (missing.length > 0 || missingOptional.length > 0) {
      // Dev-only visibility for local parity with Netlify dev.
      console.warn("ENV_MISSING", {
        required: missing,
        optional: missingOptional,
      });
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

const globalForEnv =
  globalThis as unknown as { __envChecked?: boolean | undefined };

if (!globalForEnv.__envChecked) {
  checkEnv();
  globalForEnv.__envChecked = true;
}
