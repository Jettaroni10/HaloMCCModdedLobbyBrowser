import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  removeLobbyImage,
  saveLobbyImage,
  validateLobbyImage,
} from "@/lib/lobby-images";

export const runtime = "nodejs";

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

  const lobby = await prisma.lobby.findUnique({ where: { id: params.id } });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }
  if (lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("mapImage") ?? formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No image file provided." },
      { status: 400 }
    );
  }

  const validationError = validateLobbyImage(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const previousUrl = lobby.mapImageUrl;
  let savedUrl: string | null = null;

  try {
    const saved = await saveLobbyImage(file);
    savedUrl = saved.mapImageUrl;
    const updated = await prisma.lobby.update({
      where: { id: params.id },
      data: { mapImageUrl: savedUrl },
    });
    await removeLobbyImage(previousUrl);
    return NextResponse.json({ mapImageUrl: updated.mapImageUrl });
  } catch (error) {
    if (savedUrl) {
      await removeLobbyImage(savedUrl);
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const lobby = await prisma.lobby.findUnique({ where: { id: params.id } });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }
  if (lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const previousUrl = lobby.mapImageUrl;
  const updated = await prisma.lobby.update({
    where: { id: params.id },
    data: { mapImageUrl: null },
  });
  await removeLobbyImage(previousUrl);

  return NextResponse.json({ mapImageUrl: updated.mapImageUrl });
}
