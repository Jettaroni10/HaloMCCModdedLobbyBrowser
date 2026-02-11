import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureLobbyChatAccess } from "@/lib/lobby-access";
import { ensureDmChatAccess } from "@/lib/dm-access";
import { createRealtimeTokenRequest } from "@/lib/realtime/ablyServer";

export const runtime = "nodejs";

const LOBBY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getLobbyId(request: Request) {
  const { searchParams } = new URL(request.url);
  const lobbyId = searchParams.get("lobbyId");
  return lobbyId ?? "";
}

function getDmId(request: Request) {
  const { searchParams } = new URL(request.url);
  const dmId = searchParams.get("dmId");
  return dmId ?? "";
}

function getBrowseTelemetry(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("browseTelemetry") ?? "";
  return raw === "1" || raw.toLowerCase() === "true";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    const response = NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  if (!user.gamertag || user.needsGamertag) {
    const response = NextResponse.json(
      { error: "Gamertag required." },
      { status: 403 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const lobbyId = getLobbyId(request);
  const dmId = getDmId(request);
  const browseTelemetry = getBrowseTelemetry(request);
  if (lobbyId) {
    if (!LOBBY_ID_PATTERN.test(lobbyId)) {
      const response = NextResponse.json(
        { error: "Invalid lobbyId." },
        { status: 400 }
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const access = await ensureLobbyChatAccess(lobbyId, user.id);
    if (!access.ok) {
      const response = NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }

  if (dmId) {
    if (!LOBBY_ID_PATTERN.test(dmId)) {
      const response = NextResponse.json(
        { error: "Invalid dmId." },
        { status: 400 }
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    const access = await ensureDmChatAccess(dmId, user.id);
    if (!access.ok) {
      const response = NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }

  const tokenRequest = await createRealtimeTokenRequest({
    lobbyId: lobbyId || undefined,
    dmId: dmId || undefined,
    clientId: user.id,
    browseTelemetry,
  });
  const response = NextResponse.json(tokenRequest);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const response = await POST(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
