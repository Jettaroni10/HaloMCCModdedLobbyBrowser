import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { getFirebaseAdmin } from "./firebase-admin";

export const LOBBY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LOBBY_IMAGE_ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "lobbies");

function hasFirebaseStorage() {
  return Boolean(
    process.env.FIREBASE_STORAGE_BUCKET &&
      (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        (process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY))
  );
}

export function validateLobbyImage(file: File) {
  if (!LOBBY_IMAGE_ALLOWED_TYPES.has(file.type)) {
    return "Unsupported image format. Use JPG, PNG, or WebP.";
  }
  if (file.size > LOBBY_IMAGE_MAX_BYTES) {
    return "Image is too large. Max 5 MB.";
  }
  return "";
}

export async function saveLobbyImage(file: File) {
  const extension = LOBBY_IMAGE_ALLOWED_TYPES.get(file.type) ?? "jpg";
  const buffer = Buffer.from(await file.arrayBuffer());

  if (hasFirebaseStorage()) {
    const filename = `${randomUUID()}.${extension}`;
    const storagePath = path.posix.join("lobbies", filename);
    const admin = getFirebaseAdmin();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET as string;
    const bucket = admin.storage().bucket(bucketName);
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
      contentType: file.type,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    await fileRef.makePublic();
    return {
      mapImageUrl: `https://storage.googleapis.com/${bucketName}/${storagePath}`,
      absolutePath: storagePath,
    };
  }

  const filename = `${randomUUID()}.${extension}`;
  const relativeUrl = path.posix.join("uploads", "lobbies", filename);
  const absolutePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "lobbies",
    filename
  );

  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    mapImageUrl: `/${relativeUrl}`,
    absolutePath,
  };
}

export async function removeLobbyImage(mapImageUrl?: string | null) {
  if (!mapImageUrl) return;
  const normalizedUrl = mapImageUrl.replace(/\\/g, "/");
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (bucket) {
    const publicPrefix = `https://storage.googleapis.com/${bucket}/`;
    if (normalizedUrl.startsWith(publicPrefix)) {
      const storagePath = normalizedUrl.slice(publicPrefix.length);
      try {
        const admin = getFirebaseAdmin();
        await admin.storage().bucket(bucket).file(storagePath).delete();
      } catch {
        // ignore
      }
      return;
    }
    const firebasePrefix = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`;
    if (normalizedUrl.startsWith(firebasePrefix)) {
      const withoutPrefix = normalizedUrl.slice(firebasePrefix.length);
      const pathPart = withoutPrefix.split("?")[0] ?? "";
      const storagePath = decodeURIComponent(pathPart);
      try {
        const admin = getFirebaseAdmin();
        await admin.storage().bucket(bucket).file(storagePath).delete();
      } catch {
        // ignore
      }
      return;
    }
  }
  if (!normalizedUrl.startsWith("/uploads/lobbies/")) return;
  const relativePath = normalizedUrl.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  try {
    await fs.unlink(absolutePath);
  } catch {
    // Ignore missing files.
  }
}
