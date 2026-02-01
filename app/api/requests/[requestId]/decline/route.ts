import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { emitRequestDecided } from "@/lib/host-events";

export async function POST(
  _request: Request,
  { params }: { params: { requestId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id: params.requestId },
    include: { lobby: true },
  });

  if (!joinRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (joinRequest.lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const updated = await prisma.joinRequest.update({
    where: { id: params.requestId },
    data: {
      status: "DECLINED",
      decidedAt: new Date(),
      decidedByUserId: user.id,
    },
    include: {
      lobby: { select: { id: true, title: true, hostUserId: true } },
    },
  });

  emitRequestDecided({
    hostUserId: updated.lobby.hostUserId,
    request: {
      id: updated.id,
      status: "DECLINED",
      decidedByUserId: updated.decidedByUserId ?? null,
      lobby: {
        id: updated.lobby.id,
        title: updated.lobby.title,
      },
    },
  });

  return NextResponse.json(updated);
}

