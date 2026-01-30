import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  clampInt,
  normalizeText,
  parseBoolean,
  parseEnum,
  parseNumber,
  parseStringArray,
} from "@/lib/validation";
import { Games, Platforms, Regions, Vibes, Voices } from "@/lib/types";

const LIMITS = {
  title: 80,
  mode: 60,
  map: 60,
  rules: 600,
  tag: 24,
  tagsMax: 10,
  workshopUrl: 220,
  modNotes: 600,
};

function sanitizeTags(input: unknown) {
  return parseStringArray(input)
    .map((tag) => normalizeText(tag, LIMITS.tag))
    .filter(Boolean)
    .slice(0, LIMITS.tagsMax);
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  const entries = Object.fromEntries(formData.entries());
  return entries;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const body = await readBody(request);

  const title = normalizeText(body.title, LIMITS.title);
  const mode = normalizeText(body.mode, LIMITS.mode);
  const map = normalizeText(body.map, LIMITS.map);
  const rulesNote = normalizeText(body.rulesNote, LIMITS.rules);
  const game = parseEnum(body.game, Games);
  const region = parseEnum(body.region, Regions);
  const platform = parseEnum(body.platform, Platforms);
  const voice = parseEnum(body.voice, Voices);
  const vibe = parseEnum(body.vibe, Vibes);
  const tags = sanitizeTags(body.tags);
  const friendsOnly = parseBoolean(body.friendsOnly) ?? false;
  const slotsTotal = clampInt(parseNumber(body.slotsTotal), 2, 32);
  const slotsOpen = clampInt(parseNumber(body.slotsOpen), 0, 32);
  const isModded = parseBoolean(body.isModded) ?? false;
  const workshopCollectionUrl = normalizeText(
    body.workshopCollectionUrl,
    LIMITS.workshopUrl
  );
  const workshopItemUrls = parseStringArray(body.workshopItemUrls)
    .map((url) => normalizeText(url, LIMITS.workshopUrl))
    .filter(Boolean);
  const requiresEacOff = parseBoolean(body.requiresEacOff) ?? false;
  const modNotes = normalizeText(body.modNotes, LIMITS.modNotes);

  if (!title || !mode || !map || !rulesNote) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    );
  }
  if (!game || !region || !platform || !voice || !vibe) {
    return NextResponse.json(
      { error: "Invalid enum value." },
      { status: 400 }
    );
  }
  if (
    slotsTotal !== undefined &&
    slotsOpen !== undefined &&
    slotsOpen > slotsTotal
  ) {
    return NextResponse.json(
      { error: "slotsOpen cannot exceed slotsTotal." },
      { status: 400 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  const lobby = await prisma.lobby.create({
    data: {
      hostUserId: user.id,
      title,
      game,
      mode,
      map,
      region,
      platform,
      voice,
      vibe,
      tags,
      rulesNote,
      friendsOnly,
      slotsTotal: slotsTotal ?? null,
      slotsOpen: slotsOpen ?? null,
      isModded,
      workshopCollectionUrl: isModded ? workshopCollectionUrl || null : null,
      workshopItemUrls: isModded ? workshopItemUrls : [],
      requiresEacOff: isModded ? requiresEacOff : false,
      modNotes: isModded ? modNotes || null : null,
      lastHeartbeatAt: now,
      expiresAt,
    },
  });

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json(lobby, { status: 201 });
  }
  return NextResponse.redirect(new URL("/host", request.url));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const game = parseEnum(searchParams.get("game"), Games);
  const region = parseEnum(searchParams.get("region"), Regions);
  const platform = parseEnum(searchParams.get("platform"), Platforms);
  const voice = parseEnum(searchParams.get("voice"), Voices);
  const vibe = parseEnum(searchParams.get("vibe"), Vibes);
  const isModded = parseBoolean(searchParams.get("isModded"));
  const tags = sanitizeTags(searchParams.get("tags"));

  const now = new Date();

  const lobbies = await prisma.lobby.findMany({
    where: {
      isActive: true,
      expiresAt: { gt: now },
      ...(game ? { game } : {}),
      ...(region ? { region } : {}),
      ...(platform ? { platform } : {}),
      ...(voice ? { voice } : {}),
      ...(vibe ? { vibe } : {}),
      ...(typeof isModded === "boolean" ? { isModded } : {}),
      ...(tags.length > 0 ? { tags: { hasSome: tags } } : {}),
    },
    orderBy: { lastHeartbeatAt: "desc" },
    include: {
      host: { select: { displayName: true } },
    },
  });

  return NextResponse.json(lobbies);
}
