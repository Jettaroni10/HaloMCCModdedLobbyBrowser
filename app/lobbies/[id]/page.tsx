import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatEnum } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import LobbyRequestForm from "@/components/LobbyRequestForm";
import ReportForm from "@/components/ReportForm";

type LobbyPageProps = {
  params: { id: string };
};

export default async function LobbyPage({ params }: LobbyPageProps) {
  const dbReady = Boolean(process.env.DATABASE_URL);
  if (!dbReady) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-12 text-sm text-ink/70">
        Configure <code className="font-semibold">DATABASE_URL</code> to load
        lobby details.
      </div>
    );
  }

  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    include: {
      host: { select: { displayName: true } },
    },
  });

  if (!lobby) {
    notFound();
  }

  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="rounded-3xl border border-ink/10 bg-mist p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-ink/50">
              Lobby
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">
              {lobby.title}
            </h1>
            <p className="mt-2 text-sm text-ink/60">
              Hosted by {lobby.host.displayName}
            </p>
          </div>
          {lobby.isModded && (
            <span className="rounded-full bg-clay/20 px-4 py-1 text-xs font-semibold text-ink">
              Modded lobby
            </span>
          )}
        </div>
        <p className="mt-4 text-sm text-ink/70">
          {lobby.mode} · {lobby.map}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-ink/60">
          <span>{formatEnum(lobby.game)}</span>
          <span>•</span>
          <span>{formatEnum(lobby.region)}</span>
          <span>•</span>
          <span>{formatEnum(lobby.platform)}</span>
          <span>•</span>
          <span>{formatEnum(lobby.voice)}</span>
          <span>•</span>
          <span>{formatEnum(lobby.vibe)}</span>
          <span>•</span>
          <span>
            Slots {lobby.slotsOpen ?? "?"}/{lobby.slotsTotal ?? "?"}
          </span>
        </div>
      </div>

      <LobbyRequestForm
        lobbyId={lobby.id}
        isModded={lobby.isModded}
        requiresEacOff={lobby.requiresEacOff}
        workshopCollectionUrl={lobby.workshopCollectionUrl}
        workshopItemUrls={lobby.workshopItemUrls}
        modNotes={lobby.modNotes}
        rulesNote={lobby.rulesNote}
        tags={lobby.tags}
        userSteamName={user?.steamName ?? null}
        userXboxGamertag={user?.xboxGamertag ?? null}
        isSignedIn={Boolean(user)}
      />

      <div className="flex items-center justify-end">
        <ReportForm
          targetType="LOBBY"
          targetId={lobby.id}
          label="Report lobby"
          isSignedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
