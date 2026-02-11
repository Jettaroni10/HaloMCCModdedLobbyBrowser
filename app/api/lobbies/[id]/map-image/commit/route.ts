import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteLobbyImage } from "@/lib/lobby-images";
import { checkImageSafe } from "@/lib/vision";
export const dynamic = "force-dynamic";

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

  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
  });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }
  if (lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { objectPath?: string }
    | null;
  const objectPath =
    typeof body?.objectPath === "string" ? body.objectPath.trim() : "";

  const expectedPrefix = `lobbies/${lobby.id}/`;
  if (!objectPath || !objectPath.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid object path." },
      { status: 400 }
    );
  }

  const previousPath = lobby.mapImagePath;
  try {
    const review = await checkImageSafe(objectPath);
    if (!review.ok) {
      await deleteLobbyImage(objectPath);
      return NextResponse.json(
        { error: "Image rejected by content policy." },
        { status: 400 }
      );
    }
  } catch {
    await deleteLobbyImage(objectPath);
    return NextResponse.json(
      { error: "Image moderation failed." },
      { status: 500 }
    );
  }

  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { mapImagePath: objectPath },
  });

  if (previousPath && previousPath !== objectPath) {
    await deleteLobbyImage(previousPath);
  }

  return NextResponse.json({ ok: true });
}
