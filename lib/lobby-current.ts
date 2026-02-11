import { prisma } from "@/lib/db";

type LobbyWithCount = {
  id: string;
  title: string;
  slotsTotal: number | null;
  telemetryStatus: string | null;
  hostUserId: string;
  _count: { members: number };
};

export type CurrentLobbyPayload = {
  id: string;
  name: string;
  rosterCount: number;
  maxPlayers?: number | null;
  status?: string | null;
};

export type CurrentLobbyResult = {
  lobby: LobbyWithCount;
  isHost: boolean;
  rosterCount: number;
};

export async function findRecentLobbyForUser(
  userId: string,
  windowMs = 8000
): Promise<LobbyWithCount | null> {
  const now = new Date();
  const threshold = new Date(now.getTime() - windowMs);
  const lobby = (await prisma.lobby.findFirst({
    where: {
      hostUserId: userId,
      isActive: true,
      createdAt: { gte: threshold },
      expiresAt: { gt: now },
    },
    include: { _count: { select: { members: true } } },
  })) as LobbyWithCount | null;

  return lobby ?? null;
}

export async function findCurrentLobbyForUser(
  userId: string
): Promise<CurrentLobbyResult | null> {
  const now = new Date();

  const hosting = (await prisma.lobby.findFirst({
    where: {
      hostUserId: userId,
      isActive: true,
      expiresAt: { gt: now },
    },
    include: { _count: { select: { members: true } } },
  })) as LobbyWithCount | null;

  if (hosting) {
    return {
      lobby: hosting,
      isHost: true,
      rosterCount: hosting._count.members,
    };
  }

  const membership = await prisma.lobbyMember.findFirst({
    where: {
      userId,
      lobby: {
        isActive: true,
        expiresAt: { gt: now },
      },
    },
    include: {
      lobby: { include: { _count: { select: { members: true } } } },
    },
  });

  if (!membership?.lobby) return null;
  const lobby = membership.lobby as LobbyWithCount;

  return {
    lobby,
    isHost: lobby.hostUserId === userId,
    rosterCount: lobby._count.members,
  };
}

export function toCurrentLobbyPayload(
  result: CurrentLobbyResult
): CurrentLobbyPayload {
  const maxPlayers =
    typeof result.lobby.slotsTotal === "number"
      ? result.lobby.slotsTotal
      : null;
  return {
    id: result.lobby.id,
    name: result.lobby.title,
    rosterCount: result.rosterCount,
    maxPlayers,
    status: result.lobby.telemetryStatus ?? null,
  };
}
