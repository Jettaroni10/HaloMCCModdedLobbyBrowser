import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  buildLobbyImagePath,
  deleteLobbyImage,
  getSignedReadUrl,
  validateLobbyImageMeta,
} from "@/lib/lobby-images";
import { getBucket } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function getFileExt(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    select: { id: true, hostUserId: true, mapImagePath: true },
  });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }
  if (lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

  const objectPath = buildLobbyImagePath(lobby.id, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  const bucket = getBucket();
  await bucket.file(objectPath).save(buffer, {
    contentType: file.type,
    resumable: false,
  });

  if (lobby.mapImagePath) {
    await deleteLobbyImage(lobby.mapImagePath);
  }

  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { mapImagePath: objectPath },
  });

  const url = await getSignedReadUrl(objectPath);
  return NextResponse.json({ url });
}
