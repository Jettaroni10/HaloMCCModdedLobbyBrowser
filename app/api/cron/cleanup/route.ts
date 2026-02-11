import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitLobbyExpired } from "@/lib/host-events";
import { cleanupStalePresence } from "@/lib/presence";
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function getProvidedSecret(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  const url = new URL(request.url);
  return url.searchParams.get("secret") ?? "";
}

async function runCleanup(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const expectedSecret = process.env.CRON_SECRET ?? "";
  if (!expectedSecret) {
    return NextResponse.json({ error: "Cron secret not configured." }, { status: 500 });
  }

  const providedSecret = getProvidedSecret(request);
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();

  const expiredLobbies = await prisma.lobby.findMany({
    where: { isActive: true, expiresAt: { lt: now } },
    select: { id: true, hostUserId: true, expiresAt: true },
  });
  const expiredIds = expiredLobbies.map((lobby) => lobby.id);

  let lobbyCount = 0;
  let requestCount = 0;

  if (expiredIds.length > 0) {
    const lobbyResult = await prisma.lobby.updateMany({
      where: { id: { in: expiredIds } },
      data: { isActive: false },
    });
    lobbyCount = lobbyResult.count;

    const requestResult = await prisma.joinRequest.updateMany({
      where: { lobbyId: { in: expiredIds }, status: "PENDING" },
      data: { status: "DECLINED", decidedAt: now },
    });
    requestCount = requestResult.count;
  }

  for (const lobby of expiredLobbies) {
    emitLobbyExpired({
      hostUserId: lobby.hostUserId,
      lobby: {
        id: lobby.id,
        expiresAt: lobby.expiresAt.toISOString(),
      },
    });
  }

  const purgeBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const rateLimitResult = await prisma.rateLimitEvent.deleteMany({
    where: { createdAt: { lt: purgeBefore } },
  });

  const presenceResult = await cleanupStalePresence();

  return NextResponse.json({
    expiredLobbies: lobbyCount,
    declinedRequests: requestCount,
    purgedRateLimitEvents: rateLimitResult.count,
    cleanedPresence: presenceResult.cleaned,
  });
}

export async function POST(request: Request) {
  return runCleanup(request);
}

export async function GET(request: Request) {
  return runCleanup(request);
}

