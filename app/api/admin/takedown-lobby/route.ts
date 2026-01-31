import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { normalizeText } from "@/lib/validation";
import { deleteLobbyImage } from "@/lib/lobby-images";

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readBody(request);
  const lobbyId = normalizeText(body.lobbyId, 64);

  if (!lobbyId) {
    return NextResponse.json({ error: "lobbyId is required." }, { status: 400 });
  }

  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }

  const updated = await prisma.lobby.update({
    where: { id: lobbyId },
    data: { isActive: false, mapImagePath: null },
  });

  if (lobby.mapImagePath) {
    await deleteLobbyImage(lobby.mapImagePath);
  }

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json(updated);
  }
  return NextResponse.redirect(new URL("/admin", request.url));
}

