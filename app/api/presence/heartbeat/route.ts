import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findCurrentLobbyForUser } from "@/lib/lobby-current";
import {
  cleanupUserPresence,
  presenceConfig,
  touchLobbyHeartbeat,
  upsertUserPresence,
} from "@/lib/presence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { overlayInstanceId?: string; haloRunning?: boolean }
    | null;
  const overlayInstanceId =
    typeof body?.overlayInstanceId === "string"
      ? body.overlayInstanceId
      : null;
  const haloRunning = body?.haloRunning !== false;

  if (!haloRunning) {
    const result = await cleanupUserPresence({ userId: user.id, reason: "halo" });
    return NextResponse.json({
      ok: true,
      offline: true,
      action: result.action,
      lobbyId: result.lobbyId,
    });
  }

  const current = await findCurrentLobbyForUser(user.id);
  const currentLobbyId = current?.lobby.id ?? null;
  const isHosting = Boolean(current?.isHost);

  await upsertUserPresence({
    userId: user.id,
    overlayInstanceId,
    currentLobbyId,
    isHosting,
    haloRunning: true,
  });

  if (currentLobbyId && isHosting) {
    await touchLobbyHeartbeat(currentLobbyId);
  }

  return NextResponse.json({
    ok: true,
    ttlMs: presenceConfig.ttlMs,
    currentLobbyId,
    isHosting,
  });
}
