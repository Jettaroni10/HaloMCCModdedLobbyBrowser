import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addXp, countXpEvents } from "@/lib/xp";
import { emitLobbyMessageCreated } from "@/lib/lobby-events";
import { publishLobbyEvent } from "@/lib/realtime/ablyServer";
import { ensureLobbyChatAccess } from "@/lib/lobby-access";
import { logPerf } from "@/lib/perf";
import { filterProfanity, isOnlyProfanity } from "@/lib/profanity";

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
  if (!user.gamertag || user.needsGamertag) {
    return NextResponse.json(
      { error: "Gamertag required to access chat." },
      { status: 403 }
    );
  }

  const access = await ensureLobbyChatAccess(params.id, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const conversation = await ensureLobbyConversation(params.id);
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      sender: { select: { gamertag: true, nametagColor: true, srLevel: true } },
    },
  });

  return NextResponse.json(
    messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      senderGamertag: message.sender.gamertag,
      senderNametagColor: message.sender.nametagColor,
      senderSrLevel: message.sender.srLevel ?? 1,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const perfStart = Date.now();
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (user.isBanned) {
      return NextResponse.json({ error: "Account is banned." }, { status: 403 });
    }
    if (!user.gamertag || user.needsGamertag) {
      return NextResponse.json(
        { error: "Gamertag required to send chat messages." },
        { status: 403 }
      );
    }

    const access = await ensureLobbyChatAccess(params.id, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await request.json().catch(() => null)) as
      | { body?: string }
      | null;
    const messageBody =
      typeof body?.body === "string"
        ? body.body.trim().slice(0, MESSAGE_LIMIT)
        : "";

    if (!messageBody) {
      return NextResponse.json(
        { error: "Message cannot be empty." },
        { status: 400 }
      );
    }
    const filteredBody = filterProfanity(messageBody);
    if (isOnlyProfanity(messageBody, filteredBody)) {
      return NextResponse.json(
        { error: "Message contains only blocked words." },
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
        body: filteredBody,
      },
    });

    const messagePayload = {
      id: created.id,
      conversationId: created.conversationId,
      senderUserId: created.senderUserId,
      senderGamertag: user.gamertag,
      senderNametagColor: user.nametagColor,
      senderSrLevel: user.srLevel ?? 1,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    };

    emitLobbyMessageCreated({
      lobbyId: params.id,
      message: messagePayload,
    });

    await publishLobbyEvent({
      lobbyId: params.id,
      event: "message:new",
      payload: messagePayload,
    });

    if (filteredBody.length >= 3 && lastMessage?.body !== filteredBody) {
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

    return NextResponse.json({
      ok: true,
      message: messagePayload,
    });
  } finally {
    logPerf("chat send", perfStart, { lobbyId: params.id });
  }
}
