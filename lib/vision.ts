import { ImageAnnotatorClient, protos } from "@google-cloud/vision";
import { getBucket, getBucketName } from "@/lib/firebaseAdmin";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const LIKELIHOOD_ORDER = [
  "UNKNOWN",
  "VERY_UNLIKELY",
  "UNLIKELY",
  "POSSIBLE",
  "LIKELY",
  "VERY_LIKELY",
] as const;

type Likelihood = (typeof LIKELIHOOD_ORDER)[number];
type VisionLikelihood =
  | protos.google.cloud.vision.v1.Likelihood
  | keyof typeof protos.google.cloud.vision.v1.Likelihood
  | null
  | undefined;

let visionClient: ImageAnnotatorClient | null = null;

function hasVisionConfig() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim().length > 0) return true;
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

function loadServiceAccount(): ServiceAccount {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim().length > 0) {
    return JSON.parse(json) as ServiceAccount;
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

function getVisionClient() {
  if (visionClient) return visionClient;
  const serviceAccount = loadServiceAccount();
  visionClient = new ImageAnnotatorClient({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });
  return visionClient;
}

function likelihoodAtLeast(value: Likelihood | undefined, min: Likelihood) {
  if (!value) return false;
  return LIKELIHOOD_ORDER.indexOf(value) >= LIKELIHOOD_ORDER.indexOf(min);
}

function toLikelihoodString(value: VisionLikelihood): Likelihood | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    return LIKELIHOOD_ORDER.includes(value as Likelihood)
      ? (value as Likelihood)
      : undefined;
  }
  const name =
    protos.google.cloud.vision.v1.Likelihood[
      value as protos.google.cloud.vision.v1.Likelihood
    ];
  return LIKELIHOOD_ORDER.includes(name as Likelihood)
    ? (name as Likelihood)
    : undefined;
}

export async function checkImageSafe(objectPath: string) {
  let bucketName = "";
  try {
    bucketName = getBucketName();
  } catch {
    bucketName = "";
  }
  if (!bucketName) {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, skipped: true };
    }
    throw new Error("FIREBASE_STORAGE_BUCKET is missing.");
  }
  if (!hasVisionConfig()) {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, skipped: true };
    }
    throw new Error("Firebase service account env vars are missing.");
  }

  const gcsUri = `gs://${bucketName}/${objectPath}`;
  const client = getVisionClient();
  let annotation: protos.google.cloud.vision.v1.ISafeSearchAnnotation | null;
  try {
    const [result] = await client.safeSearchDetection(gcsUri);
    annotation = result.safeSearchAnnotation;
  } catch (error) {
    try {
      const bucket = getBucket();
      const [buffer] = await bucket.file(objectPath).download();
      const [result] = await client.safeSearchDetection({
        image: { content: buffer },
      });
      annotation = result.safeSearchAnnotation;
    } catch {
      throw error;
    }
  }
  if (!annotation) {
    return { ok: true };
  }

  const adult = toLikelihoodString(annotation.adult as VisionLikelihood);
  const racy = toLikelihoodString(annotation.racy as VisionLikelihood);
  const violence = toLikelihoodString(annotation.violence as VisionLikelihood);

  if (likelihoodAtLeast(adult, "LIKELY")) {
    return { ok: false, reason: "adult" };
  }
  if (likelihoodAtLeast(racy, "LIKELY")) {
    return { ok: false, reason: "racy" };
  }
  if (likelihoodAtLeast(violence, "VERY_LIKELY")) {
    return { ok: false, reason: "violence" };
  }

  return { ok: true };
}
