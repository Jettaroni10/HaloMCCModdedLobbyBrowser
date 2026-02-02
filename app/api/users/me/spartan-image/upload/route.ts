import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  buildUserImagePath,
  deleteUserImage,
  getSignedUserReadUrl,
} from "@/lib/user-images";
import { getBucket, getBucketName } from "@/lib/firebaseAdmin";
import { validateLobbyImageMeta } from "@/lib/lobby-images";
import { checkImageBufferSafe } from "@/lib/vision";

export const runtime = "nodejs";

function getFileExt(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  let stage = "START";
  const hasStorageBucket = Boolean(process.env.FIREBASE_STORAGE_BUCKET);
  const hasServiceAccountJson = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );
  const hasServiceAccountParts = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
  const hasModerationKey = hasServiceAccountJson || hasServiceAccountParts;
  const bucketName = (() => {
    try {
      return getBucketName();
    } catch {
      return "";
    }
  })();

  const fail = (status: number, error: string, detail?: string) => {
    console.error("SPARTAN_IMAGE_UPLOAD_FAIL", {
      requestId,
      stage,
      status,
      error,
      detail,
    });
    return NextResponse.json(
      { ok: false, requestId, stage, error, detail },
      { status }
    );
  };

  try {
    console.info("SPARTAN_IMAGE_UPLOAD_START", { requestId });
    const user = await getCurrentUser();
    if (!user) {
      return fail(401, "Unauthorized.");
    }
    if (user.isBanned) {
      return fail(403, "Account is banned.");
    }
    if (!user.gamertag || user.needsGamertag) {
      return fail(403, "Gamertag required.");
    }
    stage = "AUTH_OK";
    console.info("SPARTAN_IMAGE_UPLOAD_AUTH_OK", {
      requestId,
      userId: user.id,
    });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      stage = "PARSE_FORMDATA_OK";
      return fail(400, "Missing file.");
    }
    stage = "PARSE_FORMDATA_OK";
    console.info("SPARTAN_IMAGE_UPLOAD_PARSE_FORMDATA_OK", {
      requestId,
      userId: user.id,
      hasFile: true,
    });

    const ext = getFileExt(file.name) || file.type.split("/")[1] || "webp";
    const validationError = validateLobbyImageMeta({
      contentType: file.type,
      size: file.size,
      ext,
    });
    if (validationError) {
      stage = "FILE_OK";
      return fail(400, validationError);
    }
    if (file.size <= 0) {
      stage = "FILE_OK";
      return fail(400, "Empty file.");
    }
    if (file.size > 5 * 1024 * 1024) {
      stage = "FILE_OK";
      return fail(413, "Image is too large. Max 5 MB.");
    }
    stage = "FILE_OK";
    console.info("SPARTAN_IMAGE_UPLOAD_FILE_OK", {
      requestId,
      userId: user.id,
      name: file.name,
      mime: file.type,
      size: file.size,
    });

    stage = "ENV_OK";
    console.info("SPARTAN_IMAGE_UPLOAD_ENV_OK", {
      requestId,
      bucketName,
      hasStorageBucket,
      hasModerationKey,
      hasServiceAccountJson,
      hasServiceAccountParts,
    });

    const objectPath = buildUserImagePath(user.id, ext);
    const buffer = Buffer.from(await file.arrayBuffer());

    stage = "MOD_START";
    try {
      const review = await checkImageBufferSafe(buffer);
      if (!review.ok) {
        stage = "MOD_FAIL";
        return fail(400, "Image not allowed.");
      }
      stage = "MOD_OK";
      console.info("SPARTAN_IMAGE_UPLOAD_MOD_OK", {
        requestId,
        userId: user.id,
      });
    } catch (error) {
      stage = "MOD_FAIL";
      console.error("SPARTAN_IMAGE_UPLOAD_MOD_FAIL", {
        requestId,
        userId: user.id,
        error,
      });
      return fail(503, "Moderation unavailable. Please try again.");
    }

    stage = "UPLOAD_START";
    console.info("SPARTAN_IMAGE_UPLOAD_UPLOAD_START", {
      requestId,
      userId: user.id,
      objectPath,
    });
    try {
      const bucket = getBucket();
      await bucket.file(objectPath).save(buffer, {
        contentType: file.type,
        resumable: false,
      });
    } catch (error) {
      stage = "UPLOAD_FAIL";
      const detail = error instanceof Error ? error.message : String(error);
      console.error("SPARTAN_IMAGE_UPLOAD_UPLOAD_FAIL", {
        requestId,
        userId: user.id,
        objectPath,
        error: detail,
      });
      if (detail.includes("does not exist")) {
        return fail(503, "Storage unavailable. Please try again.", detail);
      }
      return fail(500, "Upload failed. Please try again.", detail);
    }
    stage = "UPLOAD_OK";
    console.info("SPARTAN_IMAGE_UPLOAD_UPLOAD_OK", {
      requestId,
      userId: user.id,
      objectPath,
    });

    const previousPath = await prisma.user
      .findUnique({
        where: { id: user.id },
        select: { spartanImagePath: true },
      })
      .then((row) => row?.spartanImagePath ?? null);

    stage = "DB_START";
    console.info("SPARTAN_IMAGE_UPLOAD_DB_START", {
      requestId,
      userId: user.id,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { spartanImagePath: objectPath },
    });
    stage = "DB_OK";
    console.info("SPARTAN_IMAGE_UPLOAD_DB_OK", {
      requestId,
      userId: user.id,
    });

    if (previousPath && previousPath !== objectPath) {
      await deleteUserImage(previousPath);
    }

    const url = await getSignedUserReadUrl(objectPath);
    return NextResponse.json({ ok: true, requestId, url });
  } catch (error) {
    return fail(500, "Upload failed. Please try again.", String(error));
  }
}
