import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addXp, countXpEvents } from "@/lib/xp";
import { publishDmEvent } from "@/lib/realtime/ablyServer";
import { filterProfanity } from "@/lib/profanity";

const MESSAGE_LIMIT = 500;

function normalizePair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function ensureFriendship(userId: string, targetId: string) {
  const [userAId, userBId] = normalizePair(userId, targetId);
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });
  return Boolean(friendship);
}

async function ensureDmConversation(userId: string, targetId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      type: "DM",
      participants: { some: { userId } },
      AND: { participants: { some: { userId: targetId } } },
    },
    select: { id: true },
  });
  if (conversation) return conversation;

  return prisma.conversation.create({
    data: {
      type: "DM",
      participants: {
        create: [{ userId }, { userId: targetId }],
      },
    },
    select: { id: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
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
      { error: "Gamertag required to access messages." },
      { status: 403 }
    );
  }

  const targetId = params.userId;
  const isFriend = await ensureFriendship(user.id, targetId);
  if (!isFriend) {
    return NextResponse.json({ error: "Friends only." }, { status: 403 });
  }

  const conversation = await ensureDmConversation(user.id, targetId);
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      sender: { select: { gamertag: true, nametagColor: true, srLevel: true } },
    },
  });

  return NextResponse.json({
    conversationId: conversation.id,
    messages: messages.map((message) => ({
      id: message.id,
      conversationId: conversation.id,
      senderUserId: message.senderUserId,
      senderGamertag: message.sender.gamertag,
      senderNametagColor: message.sender.nametagColor,
      senderSrLevel: message.sender.srLevel ?? 1,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
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
      { error: "Gamertag required to send messages." },
      { status: 403 }
    );
  }

  const targetId = params.userId;
  const isFriend = await ensureFriendship(user.id, targetId);
  if (!isFriend) {
    return NextResponse.json({ error: "Friends only." }, { status: 403 });
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
  const filteredBody = filterProfanity(messageBody);

  const conversation = await ensureDmConversation(user.id, targetId);
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conversation.id, userId: user.id },
      { conversationId: conversation.id, userId: targetId },
    ],
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

  await publishDmEvent({
    conversationId: conversation.id,
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

  const today = startOfToday();
  const replyCount = await countXpEvents(targetId, "MESSAGE_REPLY", today);
  if (replyCount < 5) {
    const sentRecently = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        senderUserId: targetId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (sentRecently) {
      await addXp(targetId, 10, "MESSAGE_REPLY", {
        conversationId: conversation.id,
        replyFromUserId: user.id,
      });
    }
  }

  return NextResponse.json({
    ...messagePayload,
  });
}
