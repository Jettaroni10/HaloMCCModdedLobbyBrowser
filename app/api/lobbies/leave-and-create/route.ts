import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLobbyFromPayload, LobbyCreateError } from "@/lib/lobby-create";
import { findCurrentLobbyForUser } from "@/lib/lobby-current";
import { leaveLobbyMembership } from "@/lib/lobby-membership";

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }
  if (!user.gamertag || user.needsGamertag) {
    return NextResponse.json(
      { error: "Gamertag required before creating a lobby." },
      { status: 403 }
    );
  }

  const body = (await readBody(request)) as Record<string, unknown>;
  const currentLobby = await findCurrentLobbyForUser(user.id);

  if (currentLobby) {
    if (currentLobby.isHost) {
      await prisma.lobby.update({
        where: { id: currentLobby.lobby.id },
        data: { isActive: false },
      });
      await prisma.joinRequest.updateMany({
        where: {
          lobbyId: currentLobby.lobby.id,
          status: "PENDING",
        },
        data: { status: "DECLINED", decidedAt: new Date() },
      });
    } else {
      const result = await leaveLobbyMembership({
        lobbyId: currentLobby.lobby.id,
        userId: user.id,
      });
      if (!result.ok && result.status !== 404) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
    }
  }

  try {
    const lobby = await createLobbyFromPayload({ user, body });
    return NextResponse.json({ newLobbyId: lobby.id });
  } catch (error) {
    if (error instanceof LobbyCreateError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }
}
