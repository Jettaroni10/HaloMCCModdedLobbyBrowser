import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLobbyFromPayload, LobbyCreateError } from "@/lib/lobby-create";
import {
  findCurrentLobbyForUser,
  findRecentLobbyForUser,
} from "@/lib/lobby-current";
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
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Unauthorized." },
      { status: 401 }
    );
  }
  if (user.isBanned) {
    return NextResponse.json(
      { ok: false, code: "BANNED", message: "Account is banned." },
      { status: 403 }
    );
  }
  if (!user.gamertag || user.needsGamertag) {
    return NextResponse.json(
      {
        ok: false,
        code: "GAMERTAG_REQUIRED",
        message: "Gamertag required before creating a lobby.",
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const checkOnly = searchParams.get("check") === "1";
  if (checkOnly) {
    const current = await findCurrentLobbyForUser(user.id);
    if (!current) {
      return NextResponse.json(
        {
          ok: false,
          code: "NO_CURRENT_LOBBY",
          message: "No active lobby found.",
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      lobbyId: current.lobby.id,
      reused: true,
    });
  }

  const body = (await readBody(request)) as Record<string, unknown>;
  const leaveResult = await leaveLobbyForUser({ userId: user.id });
  if (!leaveResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "LEAVE_FAILED",
        message: leaveResult.error,
      },
      { status: leaveResult.status }
    );
  }

  const recentLobby = await findRecentLobbyForUser(user.id);
  if (recentLobby) {
    return NextResponse.json({
      ok: true,
      lobbyId: recentLobby.id,
      reused: true,
    });
  }

  try {
    const lobby = await createLobbyFromPayload({ user, body });
    return NextResponse.json({ ok: true, lobbyId: lobby.id, reused: false });
  } catch (error) {
    if (error instanceof LobbyCreateError) {
      return NextResponse.json(
        {
          ok: false,
          code: error.code ?? "CREATE_FAILED",
          message: error.message,
        },
        { status: error.status }
      );
    }
    throw error;
  }
}
