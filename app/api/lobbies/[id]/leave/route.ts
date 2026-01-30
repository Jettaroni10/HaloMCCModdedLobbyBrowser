import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { emitLobbyRosterUpdated } from "@/lib/lobby-events";

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

  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }

  const member = await prisma.lobbyMember.findUnique({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
  });
  if (!member) {
    return NextResponse.json({ error: "Not in roster." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.lobbyMember.delete({
      where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
    }),
    prisma.conversationParticipant.deleteMany({
      where: {
        userId: user.id,
        conversation: { lobbyId: lobby.id, type: "LOBBY" },
      },
    }),
    prisma.joinRequest.updateMany({
      where: {
        lobbyId: lobby.id,
        requesterUserId: user.id,
        status: "ACCEPTED",
      },
      data: {
        status: "DECLINED",
        decidedAt: new Date(),
        decidedByUserId: null,
      },
    }),
  ]);

  emitLobbyRosterUpdated({ lobbyId: lobby.id });

  return NextResponse.json({ ok: true });
}
