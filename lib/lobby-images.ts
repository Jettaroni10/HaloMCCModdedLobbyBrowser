import path from "path";
import { getBucket } from "./firebaseAdmin";

export const LOBBY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LOBBY_IMAGE_ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

export function validateLobbyImageMeta(input: {
  contentType?: string;
  size?: number;
  ext?: string;
}) {
  const contentType = input.contentType ?? "";
  const size = input.size ?? 0;
  const ext = (input.ext ?? "").toLowerCase();

  if (!LOBBY_IMAGE_ALLOWED_TYPES.has(contentType)) {
    return "Unsupported image format. Use JPG, PNG, or WebP.";
  }
  if (!ALLOWED_EXTS.has(ext)) {
    return "Unsupported file extension.";
  }
  if (size <= 0 || size > LOBBY_IMAGE_MAX_BYTES) {
    return "Image is too large. Max 5 MB.";
  }

  return "";
}

export function buildLobbyImagePath(lobbyId: string, ext: string) {
  const normalizedExt = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
  const filename = `map-preview-${Date.now()}.${normalizedExt}`;
  return path.posix.join("lobbies", lobbyId, filename);
}

export async function getSignedUploadUrl(params: {
  objectPath: string;
  contentType: string;
}) {
  const bucket = getBucket();
  const file = bucket.file(params.objectPath);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 10 * 60 * 1000,
    contentType: params.contentType,
  });
  return url;
}

export async function getSignedReadUrl(objectPath: string) {
  const bucket = getBucket();
  const file = bucket.file(objectPath);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  return url;
}

export async function deleteLobbyImage(objectPath: string) {
  const bucket = getBucket();
  try {
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
  } catch {
    // ignore
  }
}
