import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSignedUserReadUrl } from "@/lib/user-images";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { gamertag: string } }
) {
  const gamertag = decodeURIComponent(params.gamertag ?? "").trim();
  if (!gamertag) {
    return NextResponse.json({ error: "Missing gamertag." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { gamertag: { equals: gamertag, mode: "insensitive" } },
    select: { spartanImagePath: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (!user.spartanImagePath) {
    return NextResponse.json({ url: null });
  }

  const url = await getSignedUserReadUrl(user.spartanImagePath);
  return NextResponse.json({ url });
}
