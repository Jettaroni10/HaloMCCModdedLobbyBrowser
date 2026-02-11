import type { Prisma } from "@prisma/client";
import { prisma, modPacksSupported } from "@/lib/db";
import { parseEnum, parseStringArray } from "@/lib/validation";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import { getSignedReadUrl } from "@/lib/lobby-images";
import { getCurrentUser } from "@/lib/auth";
import BrowseViewClient from "@/components/BrowseViewClient";

type BrowseViewProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function BrowseView({ searchParams = {} }: BrowseViewProps) {
  const dbReady = Boolean(process.env.DATABASE_URL);
  const now = new Date();
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const memberWhere = { userId: userId ?? "__none__" };

  type LobbyRow = Prisma.LobbyGetPayload<{
    include: {
      host: { select: { gamertag: true; srLevel: true } };
      _count: { select: { members: true } };
      modPack: { select: { modPackMods: { select: { isOptional: true } } } };
      members: { select: { userId: true } };
    };
  }>;

  const game = parseEnum(getParam(searchParams.game), Games);
  const region = parseEnum(getParam(searchParams.region), Regions);
  const voice = parseEnum(getParam(searchParams.voice), Voices);
  const vibe = parseEnum(getParam(searchParams.vibe), Vibes);
  const tags = parseStringArray(getParam(searchParams.tags));

  const includeModPacks = modPacksSupported;
  let lobbies: LobbyRow[] = [];
  if (dbReady) {
    const baseQuery = {
      where: {
        isActive: true,
        expiresAt: { gt: now },
        ...(game ? { game } : {}),
        ...(region ? { region } : {}),
        ...(voice ? { voice } : {}),
        ...(vibe ? { vibe } : {}),
        ...(tags.length > 0 ? { tags: { hasSome: tags } } : {}),
      },
      orderBy: { lastHeartbeatAt: "desc" as const },
      include: {
        host: { select: { gamertag: true, srLevel: true } },
        _count: { select: { members: true } },
        members: { where: memberWhere, select: { userId: true } },
      },
    };
    if (includeModPacks) {
      lobbies = (await prisma.lobby.findMany({
        ...baseQuery,
        include: {
          ...baseQuery.include,
          modPack: { select: { modPackMods: { select: { isOptional: true } } } },
        },
      })) as LobbyRow[];
    } else {
      const fallback = await prisma.lobby.findMany(baseQuery);
      lobbies = fallback.map((lobby) => ({
        ...lobby,
        modPack: null,
      })) as LobbyRow[];
    }
  }

  const imageUrls = new Map<string, string | null>();
  if (dbReady) {
    await Promise.all(
      lobbies.map(async (lobby) => {
        if (!lobby.mapImagePath) {
          imageUrls.set(lobby.id, null);
          return;
        }
        try {
          const url = await getSignedReadUrl(lobby.mapImagePath);
          imageUrls.set(lobby.id, url);
        } catch {
          imageUrls.set(lobby.id, null);
        }
      })
    );
  }

  const decoratedLobbies = lobbies.map((lobby) => {
    const isHosting = Boolean(userId && lobby.hostUserId === userId);
    const isMember = Boolean(
      userId && Array.isArray(lobby.members) && lobby.members.length > 0
    );
    const requiredModsFromPack = lobby.modPack
      ? lobby.modPack.modPackMods.filter((mod) => !mod.isOptional).length
      : 0;
    const legacyModCount =
      (lobby.workshopCollectionUrl ? 1 : 0) + lobby.workshopItemUrls.length;
    const modCount = lobby.isModded ? requiredModsFromPack || legacyModCount : 0;
    const telemetryMapName = lobby.telemetryMapName ?? lobby.map;
    const telemetryModeName = lobby.telemetryModeName ?? lobby.mode;
    const telemetryPlayerCount =
      typeof lobby.telemetryPlayerCount === "number"
        ? lobby.telemetryPlayerCount
        : lobby._count.members;
    return {
      ...lobby,
      memberCount: lobby._count.members,
      slotsOpen: Math.max(0, lobby.slotsTotal - lobby._count.members),
      mapImageUrl: imageUrls.get(lobby.id) ?? null,
      isHosting,
      isMember,
      modCount,
      telemetryMapName,
      telemetryModeName,
      telemetryPlayerCount,
    };
  });

  const serializedLobbies = decoratedLobbies.map((lobby) => ({
    id: lobby.id,
    title: lobby.title,
    game: lobby.game,
    region: lobby.region,
    voice: lobby.voice,
    vibe: lobby.vibe,
    isModded: lobby.isModded,
    modCount: lobby.modCount,
    map: lobby.map,
    mode: lobby.mode,
    slotsTotal: lobby.slotsTotal,
    memberCount: lobby.memberCount,
    lastHeartbeatAt: lobby.lastHeartbeatAt.toISOString(),
    mapImageUrl: lobby.mapImageUrl,
    isHosting: lobby.isHosting,
    isMember: lobby.isMember,
    telemetryMapName: lobby.telemetryMapName ?? null,
    telemetryModeName: lobby.telemetryModeName ?? null,
    telemetryPlayerCount:
      typeof lobby.telemetryPlayerCount === "number"
        ? lobby.telemetryPlayerCount
        : null,
    telemetryStatus: lobby.telemetryStatus ?? null,
    telemetrySeq:
      typeof lobby.telemetrySeq === "number" ? lobby.telemetrySeq : null,
    telemetryEmittedAt: lobby.telemetryEmittedAt
      ? lobby.telemetryEmittedAt.toISOString()
      : null,
    telemetryUpdatedAt: lobby.telemetryUpdatedAt
      ? lobby.telemetryUpdatedAt.toISOString()
      : null,
    host: {
      gamertag: lobby.host.gamertag,
      srLevel: lobby.host.srLevel ?? null,
    },
  }));

  return (
    <BrowseViewClient
      initialLobbies={serializedLobbies}
      dbReady={dbReady}
      initialNow={now.toISOString()}
      filters={{
        game: game ?? "",
        region: region ?? "",
        voice: voice ?? "",
        vibe: vibe ?? "",
        tags: getParam(searchParams.tags) ?? "",
      }}
    />
  );
}

