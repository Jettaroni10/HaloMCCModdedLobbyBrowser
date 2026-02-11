import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cleanupUserPresence } from "@/lib/presence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await cleanupUserPresence({ userId: user.id, reason: "shutdown" });
  return NextResponse.json({ ok: true, action: result.action, lobbyId: result.lobbyId });
}
