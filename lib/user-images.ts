import "server-only";
import path from "path";

type SignedUrlCacheEntry = {
  url: string;
  expiresAt: number;
};

const globalForSigned =
  globalThis as unknown as { userImageReadCache?: Map<string, SignedUrlCacheEntry> };
const readUrlCache =
  globalForSigned.userImageReadCache ?? new Map<string, SignedUrlCacheEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForSigned.userImageReadCache = readUrlCache;
}

async function getBucketLazy() {
  const { getBucket } = await import("./firebaseAdmin");
  return getBucket();
}

export function buildUserImagePath(userId: string, ext: string) {
  const normalizedExt = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
  const filename = `spartan-portrait-${Date.now()}.${normalizedExt}`;
  return path.posix.join("users", userId, filename);
}

export async function getSignedUserUploadUrl(params: {
  objectPath: string;
  contentType: string;
}) {
  const bucket = await getBucketLazy();
  const file = bucket.file(params.objectPath);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 10 * 60 * 1000,
    contentType: params.contentType,
  });
  return url;
}

export async function getSignedUserReadUrl(objectPath: string) {
  const now = Date.now();
  const cached = readUrlCache.get(objectPath);
  if (cached && cached.expiresAt - now > 60 * 1000) {
    return cached.url;
  }
  const bucket = await getBucketLazy();
  const file = bucket.file(objectPath);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  readUrlCache.set(objectPath, { url, expiresAt: now + 9 * 60 * 1000 });
  return url;
}

export async function deleteUserImage(objectPath: string) {
  const bucket = await getBucketLazy();
  try {
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
  } catch {
    // ignore
  }
}
