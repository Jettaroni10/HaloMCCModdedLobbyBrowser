import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import HostLobbyEditForm from "@/components/HostLobbyEditForm";

type PageProps = {
  params: { id: string };
};

export default async function EditLobbyPage({ params }: PageProps) {
  const user = await requireAuth();

  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
  });

  if (!lobby) {
    notFound();
  }

  if (lobby.hostUserId !== user.id) {
    redirect("/host");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Edit lobby</h1>
      <p className="mt-2 text-sm text-ink/70">
        Update details and keep your lobby fresh.
      </p>
      <HostLobbyEditForm
        lobbyId={lobby.id}
        defaultValues={{
          title: lobby.title,
          game: lobby.game,
          mode: lobby.mode,
          map: lobby.map,
          region: lobby.region,
          voice: lobby.voice,
          vibe: lobby.vibe,
          tags: lobby.tags,
          rulesNote: lobby.rulesNote,
          slotsTotal: lobby.slotsTotal,
          friendsOnly: lobby.friendsOnly,
          workshopCollectionUrl: lobby.workshopCollectionUrl,
          workshopItemUrls: lobby.workshopItemUrls,
          modNotes: lobby.modNotes,
        }}
      />
    </div>
  );
}

