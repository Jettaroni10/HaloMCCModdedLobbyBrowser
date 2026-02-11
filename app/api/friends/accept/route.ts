import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addXp, countXpEvents } from "@/lib/xp";
export const dynamic = "force-dynamic";

function normalizePair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    | { requestId?: string }
    | null;
  const requestId =
    typeof body?.requestId === "string" ? body.requestId : "";

  if (!requestId) {
    return NextResponse.json(
      { error: "Request id is required." },
      { status: 400 }
    );
  }

  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  });
  if (!friendRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (friendRequest.toUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (friendRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: "Request already handled." },
      { status: 409 }
    );
  }

  const [userAId, userBId] = normalizePair(
    friendRequest.fromUserId,
    friendRequest.toUserId
  );

  await prisma.$transaction(async (tx) => {
    await tx.friendRequest.update({
      where: { id: requestId },
      data: {
        status: "ACCEPTED",
        decidedAt: new Date(),
      },
    });

    const existingFriendship = await tx.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (!existingFriendship) {
      await tx.friendship.create({
        data: { userAId, userBId },
      });
    }
  });

  const today = startOfToday();
  const fromCount = await countXpEvents(
    friendRequest.fromUserId,
    "FRIEND_ACCEPTED",
    today
  );
  if (fromCount < 10) {
    await addXp(friendRequest.fromUserId, 50, "FRIEND_ACCEPTED", {
      friendUserId: friendRequest.toUserId,
      requestId,
    });
  }

  const toCount = await countXpEvents(user.id, "FRIEND_ACCEPTED", today);
  if (toCount < 10) {
    await addXp(user.id, 50, "FRIEND_ACCEPTED", {
      friendUserId: friendRequest.fromUserId,
      requestId,
    });
  }

  return NextResponse.json({ ok: true });
}
