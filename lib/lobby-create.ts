import type { Lobby } from "@prisma/client";
import { prisma, modPacksSupported } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
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

export class LobbyCreateError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function createLobbyFromPayload(params: {
  user: SessionUser;
  body: Record<string, unknown>;
}): Promise<Lobby> {
  const { user, body } = params;

  const createLimited = await isRateLimited(
    user.id,
    "create_lobby",
    3,
    60 * 1000
  );
  if (createLimited) {
    throw new LobbyCreateError(
      "Too many lobbies created. Try again shortly.",
      429
    );
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
  const slotsTotalInput = clampInt(
    parseNumber(body.maxPlayers ?? body.slotsTotal),
    2,
    16
  );
  const slotsTotal = slotsTotalInput ?? 16;
  const isModded = parseBoolean(body.isModded) ?? false;
  const workshopCollectionUrl = normalizeText(
    body.workshopCollectionUrl,
    LIMITS.workshopUrl
  );
  const modUrls = [
    ...parseStringArray(body.modUrls),
    ...parseStringArray(body.workshopItemUrls),
  ]
    .map((url) => normalizeText(url, LIMITS.workshopUrl))
    .filter(Boolean);
  const modNotes = normalizeText(body.modNotes, LIMITS.modNotes);
  const modPackId =
    isModded && modPacksSupported && typeof body.modPackId === "string"
      ? body.modPackId.trim()
      : "";

  if (!title || !mode || !map || !rulesNote) {
    throw new LobbyCreateError("Missing required fields.", 400);
  }
  if (!game || !region || !voice || !vibe) {
    throw new LobbyCreateError("Invalid enum value.", 400);
  }
  let resolvedPackId: string | null = null;
  if (modPacksSupported && modPackId) {
    const pack = await prisma.modPack.findFirst({
      where: {
        id: modPackId,
        OR: [{ isPublic: true }, { ownerUserId: user.id }],
      },
      select: { id: true },
    });
    if (!pack) {
      throw new LobbyCreateError("Mod pack not found.", 404);
    }
    resolvedPackId = pack.id;
  }

  const hasLegacyMods = Boolean(workshopCollectionUrl) || modUrls.length > 0;
  if (isModded && !resolvedPackId && !hasLegacyMods) {
    throw new LobbyCreateError("Select a mod pack or provide mod links.", 400);
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const lobby = await prisma.$transaction(async (tx) => {
    const created = await tx.lobby.create({
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
        slotsTotal,
        isModded,
        workshopCollectionUrl:
          isModded && workshopCollectionUrl ? workshopCollectionUrl : null,
        workshopItemUrls: isModded ? modUrls : [],
        modNotes: isModded ? modNotes || null : null,
        ...(modPacksSupported
          ? { modPackId: isModded ? resolvedPackId : null }
          : {}),
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

  return lobby;
}
