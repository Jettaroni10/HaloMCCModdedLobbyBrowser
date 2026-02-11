import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidGamertag, normalizeHandleText } from "@/lib/validation";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  let body: { gamertag?: string };
  try {
    body = (await request.json()) as { gamertag?: string };
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const gamertag = normalizeHandleText(body.gamertag, 24);
  if (!isValidGamertag(gamertag)) {
    return NextResponse.json(
      {
        error:
          "Gamertag must be 3-24 characters and use letters, numbers, spaces, or underscore.",
      },
      { status: 400 }
    );
  }

  const existingGamertag = await prisma.user.findFirst({
    where: {
      gamertag: { equals: gamertag, mode: "insensitive" },
      id: { not: user.id },
    },
    select: { id: true },
  });
  if (existingGamertag) {
    return NextResponse.json(
      { error: "That gamertag is already in use." },
      { status: 409 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { gamertag, needsGamertag: false },
    select: { id: true, gamertag: true, needsGamertag: true },
  });

  return NextResponse.json({ user: updated });
}
