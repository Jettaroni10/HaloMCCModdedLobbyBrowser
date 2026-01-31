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
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";
import { addXp } from "@/lib/xp";
import {
  removeLobbyImage,
  saveLobbyImage,
  validateLobbyImage,
} from "@/lib/lobby-images";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const createLimited = await isRateLimited(
    user.id,
    "create_lobby",
    3,
    60 * 1000
  );
  if (createLimited) {
    return NextResponse.json(
      { error: "Too many lobbies created. Try again shortly." },
      { status: 429 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  let mapImageFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("mapImage");
    if (file instanceof File && file.size > 0) {
      mapImageFile = file;
    }
    const entries: Record<string, FormDataEntryValue> = {};
    formData.forEach((value, key) => {
      if (key !== "mapImage") {
        entries[key] = value;
      }
    });
    body = entries;
  } else if (contentType.includes("application/json")) {
    body = (await request.json()) as Record<string, unknown>;
  }

  if (mapImageFile) {
    const validationError = validateLobbyImage(mapImageFile);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  const title = normalizeText(body.title, LIMITS.title);
  const mode = normalizeText(body.mode, LIMITS.mode);
  const map = normalizeText(body.map, LIMITS.map);
  const rulesNote = normalizeText(body.rulesNote, LIMITS.rules);
  const game = parseEnum(body.game, Games);
  const region = parseEnum(body.region, Regions);
  const platform = "STEAM";
  const voice = parseEnum(body.voice, Voices);
  const vibe = parseEnum(body.vibe, Vibes);
  const tags = sanitizeTags(body.tags);
  const friendsOnly = parseBoolean(body.friendsOnly) ?? false;
  const slotsTotalInput = clampInt(parseNumber(body.slotsTotal), 2, 32);
  const slotsTotal = slotsTotalInput ?? 16;
  const isModded = true;
  const workshopCollectionUrl = normalizeText(
    body.workshopCollectionUrl,
    LIMITS.workshopUrl
  );
  const workshopItemUrls = parseStringArray(body.workshopItemUrls)
    .map((url) => normalizeText(url, LIMITS.workshopUrl))
    .filter(Boolean);
  const requiresEacOff = parseBoolean(body.requiresEacOff) ?? true;
  const modNotes = normalizeText(body.modNotes, LIMITS.modNotes);

  if (!title || !mode || !map || !rulesNote) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    );
  }
  if (!game || !region || !voice || !vibe) {
    return NextResponse.json(
      { error: "Invalid enum value." },
      { status: 400 }
    );
  }
  if (!workshopCollectionUrl) {
    return NextResponse.json(
      { error: "Workshop collection URL is required." },
      { status: 400 }
    );
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  let savedImageUrl: string | null = null;
  try {
    if (mapImageFile) {
      const saved = await saveLobbyImage(mapImageFile);
      savedImageUrl = saved.mapImageUrl;
    }

    const lobby = await prisma.$transaction(async (tx) => {
      const created = await tx.lobby.create({
        data: {
          hostUserId: user.id,
          title,
          game,
          mode,
          map,
          mapImageUrl: savedImageUrl,
          region,
          platform,
          voice,
          vibe,
          tags,
          rulesNote,
          friendsOnly,
          slotsTotal,
          isModded,
          workshopCollectionUrl,
          workshopItemUrls,
          requiresEacOff,
          modNotes: modNotes || null,
          lastHeartbeatAt: now,
          expiresAt,
        },
      });

      await tx.lobbyMember.create({
        data: {
          lobbyId: created.id,
          userId: user.id,
          slotNumber: 1,
        },
      });

      await tx.conversation.create({
        data: {
          type: "LOBBY",
          lobbyId: created.id,
          participants: {
            create: { userId: user.id },
          },
        },
      });

      return created;
    });

    await recordRateLimitEvent(user.id, "create_lobby");
    await addXp(user.id, 25, "HOST_LOBBY_CREATED", { lobbyId: lobby.id });

    const isJson = (request.headers.get("content-type") ?? "").includes(
      "application/json"
    );
    if (isJson) {
      return NextResponse.json(lobby, { status: 201 });
    }
    return NextResponse.redirect(new URL("/host", request.url));
  } catch (error) {
    if (savedImageUrl) {
      await removeLobbyImage(savedImageUrl);
    }
    throw error;
  }
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
      host: { select: { displayName: true } },
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

