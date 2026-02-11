import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findCurrentLobbyForUser, toCurrentLobbyPayload } from "@/lib/lobby-current";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Unauthorized." },
      { status: 401 }
    );
  }

  const current = await findCurrentLobbyForUser(user.id);
  if (!current) {
    return NextResponse.json(
      { ok: false, code: "NO_CURRENT_LOBBY", message: "No active lobby found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    isHost: current.isHost,
    lobby: toCurrentLobbyPayload(current),
  });
}
