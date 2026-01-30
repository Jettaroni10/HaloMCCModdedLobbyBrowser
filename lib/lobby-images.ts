import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";

export const LOBBY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LOBBY_IMAGE_ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "lobbies");

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
  const filename = `${randomUUID()}.${extension}`;
  const relativePath = path.join("uploads", "lobbies", filename);
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    mapImageUrl: `/${relativePath.replace(/\\\\/g, "/")}`,
    absolutePath,
  };
}

export async function removeLobbyImage(mapImageUrl?: string | null) {
  if (!mapImageUrl) return;
  if (!mapImageUrl.startsWith("/uploads/lobbies/")) return;
  const relativePath = mapImageUrl.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  try {
    await fs.unlink(absolutePath);
  } catch {
    // Ignore missing files.
  }
}
