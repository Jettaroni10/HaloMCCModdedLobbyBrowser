import { prisma } from "@/lib/prisma";
import { emitLobbyRosterUpdated } from "@/lib/lobby-events";
import { findCurrentLobbyForUser } from "@/lib/lobby-current";

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

export async function closeHostedLobby(params: {
  lobbyId: string;
  userId: string;
}) {
  const { lobbyId, userId } = params;
  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) {
    return { ok: false as const, status: 404, error: "Lobby not found." };
  }
  if (lobby.hostUserId !== userId) {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  await prisma.lobby.update({
    where: { id: lobbyId },
    data: { isActive: false },
  });

  return { ok: true as const };
}

export async function leaveLobbyForUser(params: {
  userId: string;
  lobbyId?: string;
}) {
  const { userId, lobbyId } = params;

  if (lobbyId) {
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      select: { id: true, hostUserId: true },
    });
    if (!lobby) {
      return { ok: false as const, status: 404, error: "Lobby not found." };
    }
    if (lobby.hostUserId === userId) {
      const result = await closeHostedLobby({ lobbyId, userId });
      return result.ok
        ? { ok: true as const, action: "closed" as const, lobbyId }
        : result;
    }
    const result = await leaveLobbyMembership({ lobbyId, userId });
    return result.ok
      ? { ok: true as const, action: "left" as const, lobbyId }
      : result;
  }

  const currentLobby = await findCurrentLobbyForUser(userId);
  if (!currentLobby) {
    return { ok: true as const, action: "none" as const };
  }
  if (currentLobby.isHost) {
    const result = await closeHostedLobby({
      lobbyId: currentLobby.lobby.id,
      userId,
    });
    return result.ok
      ? {
          ok: true as const,
          action: "closed" as const,
          lobbyId: currentLobby.lobby.id,
        }
      : result;
  }
  const result = await leaveLobbyMembership({
    lobbyId: currentLobby.lobby.id,
    userId,
  });
  return result.ok
    ? {
        ok: true as const,
        action: "left" as const,
        lobbyId: currentLobby.lobby.id,
      }
    : result;
}
