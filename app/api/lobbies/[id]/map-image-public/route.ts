import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedReadUrl } from "@/lib/lobby-images";
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      mapImagePath: true,
    },
  });

  if (!lobby || !lobby.isActive || lobby.expiresAt <= new Date()) {
    return NextResponse.json({ url: null }, { status: 404 });
  }

  if (!lobby.mapImagePath) {
    return NextResponse.json({ url: null });
  }

  try {
    const url = await getSignedReadUrl(lobby.mapImagePath);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: null }, { status: 500 });
  }
}
