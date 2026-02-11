import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteUserImage } from "@/lib/user-images";
import { checkImageSafe } from "@/lib/vision";
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }
  if (!user.gamertag || user.needsGamertag) {
    return NextResponse.json(
      { error: "Gamertag required." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { objectPath?: string }
    | null;
  const objectPath =
    typeof body?.objectPath === "string" ? body.objectPath.trim() : "";

  const expectedPrefix = `users/${user.id}/`;
  if (!objectPath || !objectPath.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid object path." },
      { status: 400 }
    );
  }

  try {
    const review = await checkImageSafe(objectPath);
    if (!review.ok) {
      await deleteUserImage(objectPath);
      return NextResponse.json(
        { error: "Image rejected by content policy." },
        { status: 400 }
      );
    }
  } catch {
    await deleteUserImage(objectPath);
    return NextResponse.json(
      { error: "Image moderation failed." },
      { status: 500 }
    );
  }

  const previousPath = await prisma.user
    .findUnique({
      where: { id: user.id },
      select: { spartanImagePath: true },
    })
    .then((row) => row?.spartanImagePath ?? null);

  await prisma.user.update({
    where: { id: user.id },
    data: { spartanImagePath: objectPath },
  });

  if (previousPath && previousPath !== objectPath) {
    await deleteUserImage(previousPath);
  }

  return NextResponse.json({ ok: true });
}
