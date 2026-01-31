import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSignedReadUrl } from "@/lib/lobby-images";

export const runtime = "nodejs";

export async function GET(
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

  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    select: { id: true, hostUserId: true, mapImagePath: true },
  });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }

  const isHost = lobby.hostUserId === user.id;
  const member = await prisma.lobbyMember.findUnique({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
  });
  const acceptedRequest = await prisma.joinRequest.findFirst({
    where: {
      lobbyId: lobby.id,
      requesterUserId: user.id,
      status: "ACCEPTED",
    },
  });

  if (!isHost && !member && !acceptedRequest) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!lobby.mapImagePath) {
    return NextResponse.json({ url: null });
  }

  const url = await getSignedReadUrl(lobby.mapImagePath);
  return NextResponse.json({ url });
}
