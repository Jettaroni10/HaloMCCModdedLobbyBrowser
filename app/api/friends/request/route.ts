import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

function normalizePair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { toUserId?: string }
    | null;
  const toUserId = typeof body?.toUserId === "string" ? body.toUserId : "";

  if (!toUserId) {
    return NextResponse.json({ error: "User is required." }, { status: 400 });
  }
  if (toUserId === user.id) {
    return NextResponse.json(
      { error: "Cannot friend yourself." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, isBanned: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.isBanned) {
    return NextResponse.json({ error: "User unavailable." }, { status: 403 });
  }

  const [userAId, userBId] = normalizePair(user.id, toUserId);
  const existingFriendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });
  if (existingFriendship) {
    return NextResponse.json(
      { error: "Already friends." },
      { status: 409 }
    );
  }

  const pending = await prisma.friendRequest.findFirst({
    where: {
      status: "PENDING",
      OR: [
        { fromUserId: user.id, toUserId },
        { fromUserId: toUserId, toUserId: user.id },
      ],
    },
  });
  if (pending) {
    return NextResponse.json(
      { error: "Friend request already pending." },
      { status: 409 }
    );
  }

  const friendRequest = await prisma.friendRequest.create({
    data: {
      fromUserId: user.id,
      toUserId,
    },
  });

  return NextResponse.json(friendRequest, { status: 201 });
}
