import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(
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

  const lobby = await prisma.lobby.findUnique({ where: { id: params.id } });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }
  if (lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const updated = await prisma.lobby.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json(updated);
}

