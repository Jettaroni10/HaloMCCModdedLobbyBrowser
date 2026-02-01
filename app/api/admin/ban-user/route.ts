import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { normalizeText } from "@/lib/validation";
import { absoluteUrl } from "@/lib/url";

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readBody(request);
  const userId = normalizeText(body.userId, 64);

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true },
  });

  const bannedLobbies = await prisma.lobby.findMany({
    where: { hostUserId: userId, isActive: true },
    select: { id: true },
  });
  const lobbyIds = bannedLobbies.map((lobby) => lobby.id);

  if (lobbyIds.length > 0) {
    await prisma.lobby.updateMany({
      where: { id: { in: lobbyIds } },
      data: { isActive: false },
    });
    await prisma.joinRequest.updateMany({
      where: { lobbyId: { in: lobbyIds }, status: "PENDING" },
      data: { status: "DECLINED", decidedAt: new Date() },
    });
  }

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json(updated);
  }
  return NextResponse.redirect(absoluteUrl(request, "/admin"));
}

