import admin from "firebase-admin";

type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function normalizeBucketName(value: string) {
  let trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("gs://")) {
    trimmed = trimmed.replace("gs://", "");
  }
  if (trimmed.startsWith("https://storage.googleapis.com/")) {
    trimmed = trimmed.replace("https://storage.googleapis.com/", "");
  }
  if (trimmed.includes("/")) {
    trimmed = trimmed.split("/")[0];
  }
  return trimmed;
}

export function getBucketName() {
  const envBucket = normalizeBucketName(
    process.env.FIREBASE_STORAGE_BUCKET ?? ""
  );
  if (envBucket) return envBucket;

  const projectId = (process.env.FIREBASE_PROJECT_ID ?? "").trim();
  if (projectId) {
    return `${projectId}.appspot.com`;
  }

  throw new Error("FIREBASE_STORAGE_BUCKET is missing.");
}

function loadServiceAccount(): FirebaseServiceAccount {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim().length > 0) {
    return JSON.parse(json) as FirebaseServiceAccount;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(
    /\\n/g,
    "\n"
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase service account env vars are missing.");
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = loadServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    storageBucket: getBucketName(),
  });
}

export function getBucket() {
  const bucketName = getBucketName();
  getAdminApp();
  return admin.storage().bucket(bucketName);
}
