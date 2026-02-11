import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLobbyFromPayload, LobbyCreateError } from "@/lib/lobby-create";
import { findRecentLobbyForUser } from "@/lib/lobby-current";
import { leaveLobbyForUser } from "@/lib/lobby-membership";

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
  const leaveResult = await leaveLobbyForUser({ userId: user.id });
  if (!leaveResult.ok) {
    return NextResponse.json(
      { error: leaveResult.error },
      { status: leaveResult.status }
    );
  }

  const recentLobby = await findRecentLobbyForUser(user.id);
  if (recentLobby) {
    return NextResponse.json({ newLobbyId: recentLobby.id });
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
