import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    include: {
      userA: { select: { id: true, handle: true, displayName: true, steamName: true } },
      userB: { select: { id: true, handle: true, displayName: true, steamName: true } },
    },
  });

  const friends = friendships.map((friendship) => {
    const other =
      friendship.userAId === user.id ? friendship.userB : friendship.userA;
    return {
      id: other.id,
      handle: other.handle,
      displayName: other.displayName,
      steamName: other.steamName,
    };
  });

  const incomingRequests = await prisma.friendRequest.findMany({
    where: { toUserId: user.id, status: "PENDING" },
    include: {
      fromUser: { select: { id: true, handle: true, displayName: true, steamName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const outgoingRequests = await prisma.friendRequest.findMany({
    where: { fromUserId: user.id, status: "PENDING" },
    include: {
      toUser: { select: { id: true, handle: true, displayName: true, steamName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    friends,
    incomingRequests: incomingRequests.map((request) => ({
      id: request.id,
      createdAt: request.createdAt.toISOString(),
      fromUser: request.fromUser,
    })),
    outgoingRequests: outgoingRequests.map((request) => ({
      id: request.id,
      createdAt: request.createdAt.toISOString(),
      toUser: request.toUser,
    })),
  });
}
