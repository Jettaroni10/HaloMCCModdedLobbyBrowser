import { prisma } from "@/lib/db";
import { emitLobbyRosterUpdated } from "@/lib/lobby-events";

export async function leaveLobbyMembership(params: {
  lobbyId: string;
  userId: string;
}) {
  const { lobbyId, userId } = params;
  const member = await prisma.lobbyMember.findUnique({
    where: { lobbyId_userId: { lobbyId, userId } },
  });
  if (!member) {
    return { ok: false as const, status: 404, error: "Not in roster." };
  }

  await prisma.$transaction([
    prisma.lobbyMember.delete({
      where: { lobbyId_userId: { lobbyId, userId } },
    }),
    prisma.conversationParticipant.deleteMany({
      where: {
        userId,
        conversation: { lobbyId, type: "LOBBY" },
      },
    }),
    prisma.joinRequest.updateMany({
      where: {
        lobbyId,
        requesterUserId: userId,
        status: "ACCEPTED",
      },
      data: {
        status: "DECLINED",
        decidedAt: new Date(),
        decidedByUserId: null,
      },
    }),
  ]);

  emitLobbyRosterUpdated({ lobbyId });

  return { ok: true as const };
}
