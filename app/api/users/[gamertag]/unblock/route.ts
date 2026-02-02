import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: { gamertag: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const gamertag = decodeURIComponent(params.gamertag ?? "").trim();
  if (!gamertag) {
    return NextResponse.json({ error: "Missing gamertag." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { gamertag: { equals: gamertag, mode: "insensitive" } },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await prisma.block.deleteMany({
    where: { blockerUserId: user.id, blockedUserId: target.id },
  });

  return NextResponse.json({ ok: true });
}
