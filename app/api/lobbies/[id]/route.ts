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
  return Object.fromEntries(formData.entries());
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    include: {
      host: { select: { displayName: true } },
    },
  });

  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
  }

  return NextResponse.json(lobby);
}

export async function PATCH(
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

  const body = await readBody(request);

  const data: Record<string, unknown> = {};

  const title = normalizeText(body.title, LIMITS.title);
  if (title) data.title = title;

  const mode = normalizeText(body.mode, LIMITS.mode);
  if (mode) data.mode = mode;

  const map = normalizeText(body.map, LIMITS.map);
  if (map) data.map = map;

  const rulesNote = normalizeText(body.rulesNote, LIMITS.rules);
  if (rulesNote) data.rulesNote = rulesNote;

  const game = parseEnum(body.game, Games);
  if (game) data.game = game;

  const region = parseEnum(body.region, Regions);
  if (region) data.region = region;

  const platform = parseEnum(body.platform, Platforms);
  if (platform) data.platform = platform;

  const voice = parseEnum(body.voice, Voices);
  if (voice) data.voice = voice;

  const vibe = parseEnum(body.vibe, Vibes);
  if (vibe) data.vibe = vibe;

  const tags = sanitizeTags(body.tags);
  if (tags.length > 0) data.tags = tags;

  const friendsOnly = parseBoolean(body.friendsOnly);
  if (typeof friendsOnly === "boolean") data.friendsOnly = friendsOnly;

  const slotsTotal = clampInt(parseNumber(body.slotsTotal), 2, 32);
  if (slotsTotal !== undefined) data.slotsTotal = slotsTotal;

  const slotsOpen = clampInt(parseNumber(body.slotsOpen), 0, 32);
  if (slotsOpen !== undefined) data.slotsOpen = slotsOpen;

  const isModded = parseBoolean(body.isModded);
  if (typeof isModded === "boolean") {
    data.isModded = isModded;
    if (!isModded) {
      data.workshopCollectionUrl = null;
      data.workshopItemUrls = [];
      data.requiresEacOff = false;
      data.modNotes = null;
    }
  }

  const workshopCollectionUrl = normalizeText(
    body.workshopCollectionUrl,
    LIMITS.workshopUrl
  );
  if (workshopCollectionUrl) {
    data.workshopCollectionUrl = workshopCollectionUrl;
  }

  const workshopItemUrls = parseStringArray(body.workshopItemUrls)
    .map((url) => normalizeText(url, LIMITS.workshopUrl))
    .filter(Boolean);
  if (workshopItemUrls.length > 0) {
    data.workshopItemUrls = workshopItemUrls;
  }

  const requiresEacOff = parseBoolean(body.requiresEacOff);
  if (typeof requiresEacOff === "boolean") {
    data.requiresEacOff = requiresEacOff;
  }

  const modNotes = normalizeText(body.modNotes, LIMITS.modNotes);
  if (modNotes) data.modNotes = modNotes;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid updates provided." },
      { status: 400 }
    );
  }

  const nextSlotsTotal =
    slotsTotal !== undefined ? slotsTotal : lobby.slotsTotal;
  const nextSlotsOpen = slotsOpen !== undefined ? slotsOpen : lobby.slotsOpen;
  if (
    nextSlotsTotal !== null &&
    nextSlotsTotal !== undefined &&
    nextSlotsOpen !== null &&
    nextSlotsOpen !== undefined &&
    nextSlotsOpen > nextSlotsTotal
  ) {
    return NextResponse.json(
      { error: "slotsOpen cannot exceed slotsTotal." },
      { status: 400 }
    );
  }

  const updated = await prisma.lobby.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}
