import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatEnum } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import LobbyMemberPanel from "@/components/LobbyMemberPanel";
import LobbyRequestForm from "@/components/LobbyRequestForm";
import LobbyRosterLive from "@/components/LobbyRosterLive";
import ReportForm from "@/components/ReportForm";
import HostLobbyNotifications from "@/components/HostLobbyNotifications";
import LobbyChat from "@/components/LobbyChat";

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
  const isHost = Boolean(user && user.id === lobby.hostUserId);
  const membership = user
    ? await prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
      })
    : null;
  const acceptedRequest = user
    ? await prisma.joinRequest.findFirst({
        where: {
          lobbyId: lobby.id,
          requesterUserId: user.id,
          status: "ACCEPTED",
        },
      })
    : null;
  const isMember = Boolean(membership);
  const isAccepted = Boolean(acceptedRequest);
  const canSeeRoster = isHost || isMember || isAccepted;
  const canChat = canSeeRoster;
  const rosterCount = await prisma.lobbyMember.count({
    where: { lobbyId: lobby.id },
  });
  const roster = canSeeRoster
    ? await prisma.lobbyMember.findMany({
        where: { lobbyId: lobby.id },
        orderBy: { slotNumber: "asc" },
        include: {
          user: {
            select: { displayName: true, steamName: true, handle: true, srLevel: true },
          },
        },
      })
    : [];
  const friendIds =
    user && canSeeRoster
      ? await prisma.friendship
          .findMany({
            where: {
              OR: [{ userAId: user.id }, { userBId: user.id }],
            },
            select: { userAId: true, userBId: true },
          })
          .then((rows) =>
            rows.map((row) =>
              row.userAId === user.id ? row.userBId : row.userAId
            )
          )
      : [];
  const pendingOutgoingIds =
    user && canSeeRoster
      ? await prisma.friendRequest
          .findMany({
            where: { fromUserId: user.id, status: "PENDING" },
            select: { toUserId: true },
          })
          .then((rows) => rows.map((row) => row.toUserId))
      : [];
  const slotsTotal = lobby.slotsTotal ?? 16;
  const slotsOpen = Math.max(0, slotsTotal - rosterCount);
  const conversation = canChat
    ? await prisma.conversation.findFirst({
        where: { lobbyId: lobby.id, type: "LOBBY" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 50,
            include: { sender: { select: { displayName: true } } },
          },
        },
      })
    : null;
  const initialMessages =
    conversation?.messages.map((message) => ({
      id: message.id,
      senderUserId: message.senderUserId,
      senderDisplayName: message.sender.displayName,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <HostLobbyNotifications enabled={isHost} />
      <div className="rounded-md border border-ink/10 bg-mist p-8">
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
            <span className="rounded-sm bg-clay/20 px-4 py-1 text-xs font-semibold text-ink">
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
          <span>{formatEnum(lobby.voice)}</span>
          <span>•</span>
          <span>{formatEnum(lobby.vibe)}</span>
          <span>•</span>
          <span>
            Slots {slotsOpen}/{slotsTotal}
          </span>
        </div>
      </div>

      {canSeeRoster && (
        <LobbyRosterLive
          lobbyId={lobby.id}
          initialRoster={roster.map((member) => ({
            slotNumber: member.slotNumber,
            displayName:
              member.user.steamName ||
              member.user.handle ||
              member.user.displayName,
            srLevel: member.user.srLevel ?? 1,
            userId: member.userId,
          }))}
          viewerUserId={user?.id ?? null}
          friendIds={friendIds}
          pendingIds={pendingOutgoingIds}
        />
      )}

      {canChat && user && (
        <LobbyChat
          lobbyId={lobby.id}
          viewerId={user.id}
          initialMessages={initialMessages}
        />
      )}

      {!isHost && (isMember || isAccepted) ? (
        <LobbyMemberPanel lobbyId={lobby.id} />
      ) : (
        !isHost && (
          <LobbyRequestForm
            lobbyId={lobby.id}
            requiresEacOff={lobby.requiresEacOff}
            workshopCollectionUrl={lobby.workshopCollectionUrl}
            workshopItemUrls={lobby.workshopItemUrls}
            modNotes={lobby.modNotes}
            rulesNote={lobby.rulesNote}
            tags={lobby.tags}
            userSteamName={user?.steamName ?? null}
            isSignedIn={Boolean(user)}
          />
        )
      )}

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

