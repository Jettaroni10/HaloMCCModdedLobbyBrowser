import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addXp, countXpEvents } from "@/lib/xp";
import { emitLobbyMessageCreated } from "@/lib/lobby-events";

const MESSAGE_LIMIT = 500;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function ensureLobbyConversation(lobbyId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { lobbyId, type: "LOBBY" },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: { lobbyId, type: "LOBBY" },
    select: { id: true },
  });
}

async function ensureAccess(lobbyId: string, userId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    select: { id: true, hostUserId: true },
  });
  if (!lobby) {
    return { ok: false, error: "Lobby not found.", status: 404 };
  }
  const isHost = lobby.hostUserId === userId;
  if (isHost) {
    return { ok: true, lobby, isHost };
  }
  const member = await prisma.lobbyMember.findUnique({
    where: { lobbyId_userId: { lobbyId, userId } },
  });
  const acceptedRequest = await prisma.joinRequest.findFirst({
    where: { lobbyId, requesterUserId: userId, status: "ACCEPTED" },
  });
  if (!member && !acceptedRequest) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }
  return { ok: true, lobby, isHost: false };
}

export async function GET(
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

  const access = await ensureAccess(params.id, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const conversation = await ensureLobbyConversation(params.id);
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      sender: { select: { displayName: true, nametagColor: true } },
    },
  });

  return NextResponse.json(
    messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      senderDisplayName: message.sender.displayName,
      senderNametagColor: message.sender.nametagColor,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const access = await ensureAccess(params.id, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = (await request.json().catch(() => null)) as
    | { body?: string }
    | null;
  const messageBody =
    typeof body?.body === "string" ? body.body.trim().slice(0, MESSAGE_LIMIT) : "";

  if (!messageBody) {
    return NextResponse.json(
      { error: "Message cannot be empty." },
      { status: 400 }
    );
  }

  const conversation = await ensureLobbyConversation(params.id);

  await prisma.conversationParticipant.createMany({
    data: [{ conversationId: conversation.id, userId: user.id }],
    skipDuplicates: true,
  });

  const lastMessage = await prisma.message.findFirst({
    where: { conversationId: conversation.id, senderUserId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const created = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderUserId: user.id,
      body: messageBody,
    },
  });

  emitLobbyMessageCreated({
    lobbyId: params.id,
    message: {
      id: created.id,
      conversationId: created.conversationId,
      senderUserId: created.senderUserId,
      senderDisplayName: user.displayName,
      senderNametagColor: user.nametagColor,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    },
  });

  if (messageBody.length >= 3 && lastMessage?.body !== messageBody) {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await countXpEvents(user.id, "MESSAGE_SENT", since);
    if (recentCount < 20) {
      await addXp(user.id, 5, "MESSAGE_SENT", {
        conversationId: conversation.id,
      });
    }
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentParticipants = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      senderUserId: { not: user.id },
      createdAt: { gte: since24h },
    },
    distinct: ["senderUserId"],
    select: { senderUserId: true },
  });

  const today = startOfToday();
  for (const participant of recentParticipants) {
    const replyCount = await countXpEvents(
      participant.senderUserId,
      "MESSAGE_REPLY",
      today
    );
    if (replyCount >= 5) continue;
    await addXp(participant.senderUserId, 10, "MESSAGE_REPLY", {
      conversationId: conversation.id,
      replyFromUserId: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
