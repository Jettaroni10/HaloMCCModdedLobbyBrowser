import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    | { userId?: string }
    | null;
  const targetUserId =
    typeof body?.userId === "string" ? body.userId : "";

  if (!targetUserId) {
    return NextResponse.json(
      { error: "User is required." },
      { status: 400 }
    );
  }
  if (targetUserId === user.id) {
    return NextResponse.json(
      { error: "Cannot remove yourself." },
      { status: 400 }
    );
  }

  const [userAId, userBId] = normalizePair(user.id, targetUserId);

  try {
    await prisma.friendship.delete({
      where: { userAId_userBId: { userAId, userBId } },
    });
  } catch {
    return NextResponse.json(
      { error: "Friendship not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
