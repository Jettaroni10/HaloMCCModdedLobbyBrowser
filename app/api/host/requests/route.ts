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

  const now = new Date();

  const requests = await prisma.joinRequest.findMany({
    where: {
      status: "PENDING",
      lobby: {
        hostUserId: user.id,
        isActive: true,
        expiresAt: { gt: now },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      lobby: {
        select: {
          id: true,
          title: true,
          game: true,
          platform: true,
          region: true,
          isModded: true,
        },
      },
      requester: {
        select: {
          id: true,
          gamertag: true,
          nametagColor: true,
          srLevel: true,
        },
      },
    },
  });

  return NextResponse.json(requests);
}

