import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatEnum } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { logPerf } from "@/lib/perf";
import LobbyMemberPanel from "@/components/LobbyMemberPanel";
import LobbyRequestForm from "@/components/LobbyRequestForm";
import LobbyRosterLive from "@/components/LobbyRosterLive";
import ReportForm from "@/components/ReportForm";
import HostLobbyNotifications from "@/components/HostLobbyNotifications";
import LobbyChat from "@/components/LobbyChat";
import LobbyBackground from "@/components/LobbyBackground";
import Nametag from "@/components/user/Nametag";

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

  const perfStart = Date.now();
  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    include: {
      host: { select: { gamertag: true, nametagColor: true, srLevel: true } },
    },
  });

  if (!lobby) {
    notFound();
  }

  const user = await getCurrentUser();
  const isHost = Boolean(user && user.id === lobby.hostUserId);

  const membershipPromise = user
    ? prisma.lobbyMember.findUnique({
        where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
      })
    : Promise.resolve(null);
  const acceptedRequestPromise = user
    ? prisma.joinRequest.findFirst({
        where: {
          lobbyId: lobby.id,
          requesterUserId: user.id,
          status: "ACCEPTED",
        },
      })
    : Promise.resolve(null);
  const rosterCountPromise = prisma.lobbyMember.count({
    where: { lobbyId: lobby.id },
  });

  const [membership, acceptedRequest, rosterCount] = await Promise.all([
    membershipPromise,
    acceptedRequestPromise,
    rosterCountPromise,
  ]);

  const isMember = Boolean(membership);
  const isAccepted = Boolean(acceptedRequest);
  const canSeeRoster = isHost || isMember || isAccepted;
  const canChat = canSeeRoster;

  const rosterPromise = canSeeRoster
    ? prisma.lobbyMember.findMany({
        where: { lobbyId: lobby.id },
        orderBy: { slotNumber: "asc" },
        include: {
          user: {
            select: {
              gamertag: true,
              srLevel: true,
              nametagColor: true,
            },
          },
        },
      })
    : Promise.resolve([]);
  const friendRowsPromise =
    user && canSeeRoster
      ? prisma.friendship.findMany({
          where: {
            OR: [{ userAId: user.id }, { userBId: user.id }],
          },
          select: { userAId: true, userBId: true },
        })
      : Promise.resolve([]);
  const pendingRowsPromise =
    user && canSeeRoster
      ? prisma.friendRequest.findMany({
          where: { fromUserId: user.id, status: "PENDING" },
          select: { toUserId: true },
        })
      : Promise.resolve([]);
  const conversationPromise = canChat
    ? prisma.conversation.findFirst({
        where: { lobbyId: lobby.id, type: "LOBBY" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 50,
            include: {
              sender: {
                select: { gamertag: true, nametagColor: true, srLevel: true },
              },
            },
          },
        },
      })
    : Promise.resolve(null);

  const [roster, friendRows, pendingRows, conversation] = await Promise.all([
    rosterPromise,
    friendRowsPromise,
    pendingRowsPromise,
    conversationPromise,
  ]);

  const friendIds = (friendRows as { userAId: string; userBId: string }[]).map(
    (row) => (row.userAId === user?.id ? row.userBId : row.userAId)
  );
  const pendingOutgoingIds = (pendingRows as { toUserId: string }[]).map(
    (row) => row.toUserId
  );

  const slotsTotal = lobby.slotsTotal ?? 16;
  const slotsOpen = Math.max(0, slotsTotal - rosterCount);
  const initialMessages =
    conversation?.messages.map((message) => ({
      id: message.id,
      senderUserId: message.senderUserId,
      senderGamertag: message.sender.gamertag,
      senderNametagColor: message.sender.nametagColor,
      senderSrLevel: message.sender.srLevel ?? 1,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })) ?? [];

  logPerf("lobby page data", perfStart, {
    rosterCount,
    roster: roster.length,
    messages: initialMessages.length,
  });

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LobbyBackground
        lobbyId={lobby.id}
        hasRealImage={Boolean(lobby.mapImagePath)}
      />
      <div className="relative z-10">
        <div className="fixed left-4 top-24 z-20 w-[min(92vw,640px)] lg:left-10 lg:top-24">
          <HostLobbyNotifications enabled={isHost} hostUserId={user?.id} />
          <div className="flex flex-col gap-6">
            <div className="rounded-md border border-white/10 bg-gradient-to-r from-sand/90 via-mist/70 to-transparent p-7 text-white backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                    Lobby
                  </p>
                  <h1 className="mt-2 text-4xl font-semibold">
                    {lobby.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <span>Hosted by</span>
                    <Nametag
                      gamertag={lobby.host.gamertag}
                      rank={lobby.host.srLevel ?? 1}
                      nametagColor={lobby.host.nametagColor}
                      className="bg-mist/60"
                    />
                  </div>
                </div>
                {lobby.isModded && (
                  <span className="rounded-sm bg-white/10 px-4 py-1 text-xs font-semibold text-white">
                    Modded lobby
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm text-white/70">
                {lobby.mode} · {lobby.map}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.25em] text-white/60">
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
              <div className="mt-4">
                <ReportForm
                  targetType="LOBBY"
                  targetId={lobby.id}
                  label="Report lobby"
                  isSignedIn={Boolean(user)}
                />
              </div>
            </div>

            {!isHost && (isMember || isAccepted) ? (
              <LobbyMemberPanel lobbyId={lobby.id} />
            ) : (
              !isHost && (
                <LobbyRequestForm
                  lobbyId={lobby.id}
                  workshopCollectionUrl={lobby.workshopCollectionUrl}
                  workshopItemUrls={lobby.workshopItemUrls}
                  modNotes={lobby.modNotes}
                  rulesNote={lobby.rulesNote}
                  tags={lobby.tags}
                  userGamertag={user?.gamertag ?? null}
                  isSignedIn={Boolean(user)}
                />
              )
            )}

            {canChat && user && (
              <LobbyChat
                lobbyId={lobby.id}
                viewerId={user.id}
                viewerGamertag={user.gamertag}
                viewerNametagColor={user.nametagColor}
                viewerSrLevel={user.srLevel ?? 1}
                initialMessages={initialMessages}
                className="border-white/10 bg-gradient-to-b from-sand/90 via-mist/80 to-mist/60 text-white backdrop-blur-sm"
              />
            )}
          </div>
        </div>

        {canSeeRoster && (
          <div className="mt-8 px-10 lg:mt-0 lg:fixed lg:right-10 lg:top-24 lg:w-[960px]">
            <LobbyRosterLive
              lobbyId={lobby.id}
              initialRoster={roster.map((member) => ({
                slotNumber: member.slotNumber,
                gamertag: member.user.gamertag,
                srLevel: member.user.srLevel ?? 1,
                userId: member.userId,
                nametagColor: member.user.nametagColor,
              }))}
              viewerUserId={user?.id ?? null}
              friendIds={friendIds}
              pendingIds={pendingOutgoingIds}
              slotsTotal={slotsTotal}
              className="border-white/10 bg-gradient-to-l from-sand/90 via-mist/70 to-transparent text-white backdrop-blur-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

