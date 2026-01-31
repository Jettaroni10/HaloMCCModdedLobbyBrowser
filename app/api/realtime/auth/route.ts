import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureLobbyChatAccess } from "@/lib/lobby-access";
import { createLobbyTokenRequest } from "@/lib/realtime/ablyServer";

export const runtime = "nodejs";

function getLobbyId(request: Request) {
  const { searchParams } = new URL(request.url);
  const lobbyId = searchParams.get("lobbyId");
  return lobbyId ?? "";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const lobbyId = getLobbyId(request);
  if (!lobbyId) {
    return NextResponse.json({ error: "Missing lobbyId." }, { status: 400 });
  }

  const access = await ensureLobbyChatAccess(lobbyId, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tokenRequest = await createLobbyTokenRequest({
    lobbyId,
    clientId: user.id,
  });
  return NextResponse.json(tokenRequest);
}

export async function GET(request: Request) {
  return POST(request);
}
