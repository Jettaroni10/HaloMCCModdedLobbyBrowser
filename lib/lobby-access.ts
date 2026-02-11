import { prisma } from "@/lib/prisma";

export async function ensureLobbyChatAccess(
  lobbyId: string,
  userId: string
) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    select: { id: true, hostUserId: true },
  });
  if (!lobby) {
    return { ok: false as const, status: 404, error: "Lobby not found." };
  }

  const isHost = lobby.hostUserId === userId;
  if (isHost) {
    return { ok: true as const, lobby, isHost };
  }

  const member = await prisma.lobbyMember.findUnique({
    where: { lobbyId_userId: { lobbyId, userId } },
  });
  const acceptedRequest = await prisma.joinRequest.findFirst({
    where: { lobbyId, requesterUserId: userId, status: "ACCEPTED" },
  });

  if (!member && !acceptedRequest) {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  return { ok: true as const, lobby, isHost: false };
}
