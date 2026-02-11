import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLobbyFromPayload, LobbyCreateError } from "@/lib/lobby-create";
import { findCurrentLobbyForUser, toCurrentLobbyPayload } from "@/lib/lobby-current";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import { normalizeText, parseEnum, parseStringArray } from "@/lib/validation";
import { absoluteUrl } from "@/lib/url";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TAG_LIMIT = 24;
const TAGS_MAX = 10;

function sanitizeTags(input: unknown) {
  return parseStringArray(input)
    .map((tag) => normalizeText(tag, TAG_LIMIT))
    .filter(Boolean)
    .slice(0, TAGS_MAX);
}

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
      { error: "Gamertag required before creating a lobby." },
      { status: 403 }
    );
  }

  const currentLobby = await findCurrentLobbyForUser(user.id);
  if (currentLobby) {
    return NextResponse.json(
      {
        error: "You are already in a lobby. Leave it before creating another.",
        code: "ALREADY_IN_LOBBY",
        currentLobby: toCurrentLobbyPayload(currentLobby),
      },
      { status: 409 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const entries: Record<string, FormDataEntryValue> = {};
    formData.forEach((value, key) => {
      entries[key] = value;
    });
    body = entries;
  } else if (contentType.includes("application/json")) {
    body = (await request.json()) as Record<string, unknown>;
  }

  let lobby;
  try {
    lobby = await createLobbyFromPayload({ user, body });
  } catch (error) {
    if (error instanceof LobbyCreateError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json(lobby, { status: 201 });
  }
  return NextResponse.redirect(absoluteUrl(request, "/host"));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const game = parseEnum(searchParams.get("game"), Games);
  const region = parseEnum(searchParams.get("region"), Regions);
  const voice = parseEnum(searchParams.get("voice"), Voices);
  const vibe = parseEnum(searchParams.get("vibe"), Vibes);
  const tags = sanitizeTags(searchParams.get("tags"));

  const user = await getCurrentUser();
  const blockedHostIds = user
    ? await prisma.block
        .findMany({
          where: { blockedUserId: user.id },
          select: { blockerUserId: true },
        })
        .then((rows) => rows.map((row) => row.blockerUserId))
    : [];

  const now = new Date();

  const lobbies = await prisma.lobby.findMany({
    where: {
      isActive: true,
      expiresAt: { gt: now },
      ...(blockedHostIds.length > 0
        ? { hostUserId: { notIn: blockedHostIds } }
        : {}),
      ...(game ? { game } : {}),
      ...(region ? { region } : {}),
      ...(voice ? { voice } : {}),
      ...(vibe ? { vibe } : {}),
      ...(tags.length > 0 ? { tags: { hasSome: tags } } : {}),
    },
    orderBy: { lastHeartbeatAt: "desc" },
    include: {
      host: { select: { gamertag: true, srLevel: true } },
      _count: { select: { members: true } },
    },
  });

  const normalized = lobbies.map((lobby) => ({
    ...lobby,
    slotsOpen: Math.max(0, lobby.slotsTotal - lobby._count.members),
  }));

  return NextResponse.json(
    normalized.map((lobby) => {
      // Avoid leaking internal count data.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _count, ...rest } = lobby;
      return rest;
    })
  );
}

