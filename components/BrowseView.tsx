import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatEnum } from "@/lib/format";
import { formatMinutesAgo } from "@/lib/time";
import { parseEnum, parseStringArray } from "@/lib/validation";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import LobbyCardBackground from "@/components/LobbyCardBackground";
import { getSignedReadUrl } from "@/lib/lobby-images";
import { getCurrentUser } from "@/lib/auth";

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

  const game = parseEnum(getParam(searchParams.game), Games);
  const region = parseEnum(getParam(searchParams.region), Regions);
  const voice = parseEnum(getParam(searchParams.voice), Voices);
  const vibe = parseEnum(getParam(searchParams.vibe), Vibes);
  const tags = parseStringArray(getParam(searchParams.tags));

  const lobbies = dbReady
    ? await prisma.lobby.findMany({
        where: {
          isActive: true,
          expiresAt: { gt: now },
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
          ...(userId
            ? { members: { where: { userId }, select: { userId: true } } }
            : {}),
        },
      })
    : [];

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
      userId &&
        "members" in lobby &&
        Array.isArray(lobby.members) &&
        lobby.members.length > 0
    );
    return {
      ...lobby,
      slotsOpen: Math.max(0, lobby.slotsTotal - lobby._count.members),
      mapImageUrl: imageUrls.get(lobby.id) ?? null,
      isHosting,
      isMember,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Browse lobbies</h1>
          <p className="mt-2 text-sm text-ink/70">
            Filters are opt-in. Only host-published lobbies appear here.
          </p>
        </div>
      </div>

      <div className="rounded-sm border border-ink/10 bg-mist p-4 text-sm text-ink/70">
        <p className="font-semibold text-ink">
          Not affiliated with Microsoft, Xbox, 343 Industries, or Halo.
        </p>
        <p className="mt-1">
          This app coordinates opt-in invites only and does not interact with
          MCC networking or game state.
        </p>
      </div>

      <form className="grid gap-4 rounded-md border border-ink/10 bg-sand p-5 md:grid-cols-5">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Game
          <select
            name="game"
            defaultValue={game ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Games.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Region
          <select
            name="region"
            defaultValue={region ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Regions.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Mic
          <select
            name="voice"
            defaultValue={voice ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Voices.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Vibe
          <select
            name="vibe"
            defaultValue={vibe ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Vibes.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Tags
          <input
            name="tags"
            defaultValue={getParam(searchParams.tags) ?? ""}
            placeholder="chill, co-op"
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          />
        </label>
        <div className="md:col-span-5">
          <button
            type="submit"
            className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
          >
            Apply filters
          </button>
        </div>
      </form>

      {!dbReady && (
        <div className="rounded-sm border border-ink/10 bg-mist p-4 text-sm text-ink/70">
          Configure <code className="font-semibold">DATABASE_URL</code> to load
          live listings. Until then, the browse view stays empty.
        </div>
      )}

      <div className="flex flex-col gap-5">
        {decoratedLobbies.map((lobby) => (
          <Link
            key={lobby.id}
            href={`/lobbies/${lobby.id}`}
            className={`relative min-h-[140px] overflow-hidden rounded-xl border border-ink/10 bg-transparent p-5 transition-transform duration-150 ease-out hover:scale-[1.01] hover:shadow-xl ${
              lobby.isHosting
                ? "ring-1 ring-clay/50"
                : lobby.isMember
                ? "ring-1 ring-moss/50"
                : ""
            }`}
          >
            <LobbyCardBackground imageUrl={lobby.mapImageUrl} />
            <div
              className="relative z-20"
              style={{ textShadow: "0 4px 16px rgba(0,0,0,0.95)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {lobby.title}
                  </h2>
                  <p className="text-sm text-white/70">
                    {formatEnum(lobby.game)} · {lobby.mode} · {lobby.map}
                  </p>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                    {formatEnum(lobby.region)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  {lobby.isHosting && (
                    <span className="rounded-sm bg-clay/30 px-3 py-1 font-semibold text-white">
                      Hosting
                    </span>
                  )}
                  {!lobby.isHosting && lobby.isMember && (
                    <span className="rounded-sm bg-moss/30 px-3 py-1 font-semibold text-white">
                      In lobby
                    </span>
                  )}
                  {lobby.isModded && (
                    <span className="rounded-sm bg-white/10 px-3 py-1 font-semibold text-white">
                      Modded
                    </span>
                  )}
                  {lobby.voice === "MIC_REQUIRED" && (
                    <span className="rounded-sm bg-white/10 px-3 py-1 font-semibold text-white">
                      Mic required
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span>{formatEnum(lobby.vibe)}</span>
                {lobby.slotsTotal !== null && (
                  <>
                    <span>•</span>
                    <span>
                      Slots {lobby.slotsOpen ?? "?"}/{lobby.slotsTotal}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                <span>{formatMinutesAgo(lobby.lastHeartbeatAt, now)}</span>
                <span className="rounded-sm border border-white/30 px-4 py-1.5 text-xs font-semibold text-white hover:border-white/60">
                  View lobby
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {lobbies.length === 0 && dbReady && (
        <div className="rounded-sm border border-ink/10 bg-mist p-6 text-sm text-ink/70">
          No lobbies match those filters. Try clearing filters or check back
          soon.
        </div>
      )}
    </div>
  );
}

