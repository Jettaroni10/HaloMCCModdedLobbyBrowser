import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: {
      status: "DECLINED",
      decidedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
