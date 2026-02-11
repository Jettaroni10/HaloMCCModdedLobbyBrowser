import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  buildLobbyImagePath,
  getSignedUploadUrl,
  validateLobbyImageMeta,
} from "@/lib/lobby-images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXT_BY_TYPE: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

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
    select: { id: true, hostUserId: true },
  });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }
  if (lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { contentType?: string; size?: number; ext?: string }
    | null;

  const contentType = body?.contentType ?? "";
  const size = typeof body?.size === "number" ? body.size : undefined;
  const ext = (body?.ext ?? "").replace(".", "").toLowerCase();

  const validationError = validateLobbyImageMeta({ contentType, size, ext });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const allowedExts = EXT_BY_TYPE[contentType] ?? [];
  if (!allowedExts.includes(ext)) {
    return NextResponse.json(
      { error: "File extension does not match content type." },
      { status: 400 }
    );
  }

  const objectPath = buildLobbyImagePath(lobby.id, ext);
  const uploadUrl = await getSignedUploadUrl({ objectPath, contentType });

  return NextResponse.json({ uploadUrl, objectPath });
}
