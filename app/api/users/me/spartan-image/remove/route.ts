import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteUserImage } from "@/lib/user-images";
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { spartanImagePath: true },
  });
  if (existing?.spartanImagePath) {
    await deleteUserImage(existing.spartanImagePath);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { spartanImagePath: null },
  });

  return NextResponse.json({ ok: true });
}
