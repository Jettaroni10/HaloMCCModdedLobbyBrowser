import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { publishDmEvent } from "@/lib/realtime/ablyServer";
import { absoluteUrl } from "@/lib/url";

function normalizePair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
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

export async function POST(
  request: Request,
  { params }: { params: { gamertag: string } }
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
      { error: "Gamertag required." },
      { status: 403 }
    );
  }

  const gamertag = decodeURIComponent(params.gamertag ?? "").trim();
  if (!gamertag) {
    return NextResponse.json({ error: "Missing gamertag." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { gamertag: { equals: gamertag, mode: "insensitive" } },
    select: { id: true, gamertag: true, isBanned: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "Cannot invite yourself." }, { status: 400 });
  }
  if (target.isBanned) {
    return NextResponse.json({ error: "User unavailable." }, { status: 403 });
  }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerUserId: user.id, blockedUserId: target.id },
        { blockerUserId: target.id, blockedUserId: user.id },
      ],
    },
    select: { id: true },
  });
  if (blocked) {
    return NextResponse.json({ error: "Invite not allowed." }, { status: 403 });
  }

  const isFriend = await ensureFriendship(user.id, target.id);
  if (!isFriend) {
    return NextResponse.json(
      { error: "Invite requires friendship." },
      { status: 403 }
    );
  }

  const lobby = await prisma.lobby.findFirst({
    where: {
      hostUserId: user.id,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, title: true },
  });
  if (!lobby) {
    return NextResponse.json(
      { error: "No active lobby to invite from." },
      { status: 400 }
    );
  }

  const conversation = await ensureDmConversation(user.id, target.id);
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conversation.id, userId: user.id },
      { conversationId: conversation.id, userId: target.id },
    ],
    skipDuplicates: true,
  });

  const lobbyUrl = absoluteUrl(request, `/lobbies/${lobby.id}`);
  const body = `Invite: Join my lobby "${lobby.title}" — ${lobbyUrl}`;

  const created = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderUserId: user.id,
      body,
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

  return NextResponse.json({ ok: true });
}
