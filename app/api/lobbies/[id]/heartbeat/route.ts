import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addXp, hasXpEvent } from "@/lib/xp";
import { touchLobbyHeartbeat } from "@/lib/presence";
export const dynamic = "force-dynamic";

export async function POST(
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

  const now = new Date();
  const updated = await touchLobbyHeartbeat(params.id, now);

  const activeMinutes = (now.getTime() - lobby.createdAt.getTime()) / 60000;
  if (activeMinutes >= 20) {
    const activeMeta = { lobbyId: lobby.id };
    const alreadyAwarded = await hasXpEvent(
      user.id,
      "LOBBY_ACTIVE_20_MIN",
      activeMeta
    );
    if (!alreadyAwarded) {
      await addXp(user.id, 50, "LOBBY_ACTIVE_20_MIN", activeMeta);
    }
  }

  return NextResponse.json(updated);
}

