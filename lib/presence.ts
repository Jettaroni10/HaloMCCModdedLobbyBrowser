import { prisma } from "@/lib/prisma";
import { findCurrentLobbyForUser } from "@/lib/lobby-current";
import { closeHostedLobby, leaveLobbyForUser } from "@/lib/lobby-membership";

const PRESENCE_TTL_MS = 35 * 1000;
const LOBBY_HEARTBEAT_EXTENSION_MS = 30 * 60 * 1000;
const DEBUG_PRESENCE = process.env.NODE_ENV !== "production";

function debugPresence(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_PRESENCE) return;
  if (payload) {
    console.info(`[presence] ${message}`, payload);
    return;
  }
  console.info(`[presence] ${message}`);
}

type PresenceInput = {
  userId: string;
  overlayInstanceId?: string | null;
  currentLobbyId?: string | null;
  isHosting?: boolean;
  haloRunning?: boolean;
};

export async function touchLobbyHeartbeat(lobbyId: string, now = new Date()) {
  const expiresAt = new Date(now.getTime() + LOBBY_HEARTBEAT_EXTENSION_MS);
  return prisma.lobby.update({
    where: { id: lobbyId },
    data: {
      lastHeartbeatAt: now,
      expiresAt,
    },
  });
}

export async function upsertUserPresence(input: PresenceInput) {
  const now = new Date();
  const record = await prisma.userPresence.upsert({
    where: { userId: input.userId },
    update: {
      overlayInstanceId: input.overlayInstanceId ?? null,
      currentLobbyId: input.currentLobbyId ?? null,
      isHosting: Boolean(input.isHosting),
      haloRunning: Boolean(input.haloRunning),
      lastSeenAt: now,
    },
    create: {
      userId: input.userId,
      overlayInstanceId: input.overlayInstanceId ?? null,
      currentLobbyId: input.currentLobbyId ?? null,
      isHosting: Boolean(input.isHosting),
      haloRunning: Boolean(input.haloRunning),
      lastSeenAt: now,
    },
  });

  debugPresence("heartbeat", {
    userId: input.userId,
    lobbyId: input.currentLobbyId ?? null,
    isHosting: Boolean(input.isHosting),
    haloRunning: Boolean(input.haloRunning),
  });

  return record;
}

async function cleanupLobbyForHost(lobbyId: string, userId: string) {
  const result = await closeHostedLobby({ lobbyId, userId });
  if (!result.ok) {
    return { action: "none" as const, lobbyId };
  }
  return { action: "closed" as const, lobbyId };
}

async function cancelUserPendingRequests(userId: string) {
  await prisma.joinRequest.updateMany({
    where: { requesterUserId: userId, status: "PENDING" },
    data: { status: "DECLINED", decidedAt: new Date(), decidedByUserId: null },
  });
}

export async function cleanupUserPresence(params: {
  userId: string;
  reason?: string;
}) {
  const { userId } = params;
  const current = await findCurrentLobbyForUser(userId);
  let action: "none" | "left" | "closed" = "none";
  let lobbyId: string | null = null;

  if (current?.lobby?.id) {
    lobbyId = current.lobby.id;
    if (current.isHost) {
      await cleanupLobbyForHost(lobbyId, userId);
      action = "closed";
    } else {
      const result = await leaveLobbyForUser({ userId, lobbyId });
      if (result.ok) {
        action = result.action === "left" ? "left" : "closed";
      }
    }
  }

  await cancelUserPendingRequests(userId);

  await prisma.$transaction([
    prisma.lobbyMember.deleteMany({ where: { userId } }),
    prisma.conversationParticipant.deleteMany({
      where: { userId, conversation: { type: "LOBBY" } },
    }),
  ]);

  await prisma.userPresence
    .delete({ where: { userId } })
    .catch(() => null);

  debugPresence("cleanup", {
    userId,
    reason: params.reason ?? null,
    action,
    lobbyId,
  });

  return { ok: true, action, lobbyId };
}

export async function cleanupStalePresence() {
  const now = new Date();
  const threshold = new Date(now.getTime() - PRESENCE_TTL_MS);
  const stale = await prisma.userPresence.findMany({
    where: { lastSeenAt: { lt: threshold } },
    select: { userId: true },
  });

  let cleaned = 0;
  for (const record of stale) {
    await cleanupUserPresence({ userId: record.userId, reason: "ttl" });
    cleaned += 1;
  }

  if (cleaned > 0) {
    debugPresence("cleanup-stale", { cleaned });
  }

  return { cleaned };
}

export const presenceConfig = {
  ttlMs: PRESENCE_TTL_MS,
};
