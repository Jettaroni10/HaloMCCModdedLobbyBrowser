import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeText, parseNumber, clampInt } from "@/lib/validation";
import { publishLobbyEvent } from "@/lib/realtime/ablyServer";

export const runtime = "nodejs";

const LIMITS = {
  map: 60,
  mode: 60,
  status: 40,
};

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

function parseDate(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const lobby = await prisma.lobby.findUnique({ where: { id: params.id } });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }
  if (lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await readBody(request)) as Record<string, unknown>;

  const mapName = normalizeText(body.mapName, LIMITS.map);
  const modeName = normalizeText(body.modeName, LIMITS.mode);
  const status = normalizeText(body.status, LIMITS.status);
  const playerCount = clampInt(parseNumber(body.playerCount), 0, 16);
  const seq = parseNumber(body.seq);
  const emittedAt = parseDate(body.emittedAt);

  if (
    !mapName &&
    !modeName &&
    !status &&
    playerCount === undefined &&
    seq === undefined &&
    !emittedAt
  ) {
    return NextResponse.json(
      { error: "No telemetry fields provided." },
      { status: 400 }
    );
  }

  const now = new Date();

  const updated = await prisma.lobby.update({
    where: { id: params.id },
    data: {
      telemetryMapName: mapName || null,
      telemetryModeName: modeName || null,
      telemetryPlayerCount: playerCount ?? null,
      telemetryStatus: status || null,
      telemetrySeq: seq ?? null,
      telemetryEmittedAt: emittedAt,
      telemetryUpdatedAt: now,
    },
  });

  const payload = {
    lobbyId: updated.id,
    mapName: updated.telemetryMapName,
    modeName: updated.telemetryModeName,
    playerCount: updated.telemetryPlayerCount,
    status: updated.telemetryStatus,
    seq: updated.telemetrySeq,
    emittedAt: updated.telemetryEmittedAt
      ? updated.telemetryEmittedAt.toISOString()
      : null,
    updatedAt: updated.telemetryUpdatedAt
      ? updated.telemetryUpdatedAt.toISOString()
      : null,
  };

  await publishLobbyEvent({
    lobbyId: updated.id,
    event: "lobby:telemetry",
    payload,
  });

  return NextResponse.json(payload);
}
