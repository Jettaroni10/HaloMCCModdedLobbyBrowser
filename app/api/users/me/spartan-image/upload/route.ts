import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildUserImagePath, deleteUserImage, getSignedUserReadUrl } from "@/lib/user-images";
import { getBucket } from "@/lib/firebaseAdmin";
import { validateLobbyImageMeta } from "@/lib/lobby-images";
import { checkImageSafe } from "@/lib/vision";

export const runtime = "nodejs";

function getFileExt(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }
  if (!user.gamertag || user.needsGamertag) {
    return NextResponse.json({ error: "Gamertag required." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  const ext = getFileExt(file.name) || file.type.split("/")[1] || "webp";
  const validationError = validateLobbyImageMeta({
    contentType: file.type,
    size: file.size,
    ext,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const objectPath = buildUserImagePath(user.id, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  const bucket = getBucket();
  await bucket.file(objectPath).save(buffer, {
    contentType: file.type,
    resumable: false,
  });

  try {
    const review = await checkImageSafe(objectPath);
    if (!review.ok) {
      await deleteUserImage(objectPath);
      return NextResponse.json(
        { error: "Image rejected by content policy." },
        { status: 400 }
      );
    }
  } catch {
    await deleteUserImage(objectPath);
    return NextResponse.json(
      { error: "Image moderation failed." },
      { status: 500 }
    );
  }

  const previousPath = await prisma.user
    .findUnique({
      where: { id: user.id },
      select: { spartanImagePath: true },
    })
    .then((row) => row?.spartanImagePath ?? null);

  await prisma.user.update({
    where: { id: user.id },
    data: { spartanImagePath: objectPath },
  });

  if (previousPath && previousPath !== objectPath) {
    await deleteUserImage(previousPath);
  }

  const url = await getSignedUserReadUrl(objectPath);
  return NextResponse.json({ url });
}
