import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import FriendsView from "@/components/FriendsView";

export default async function FriendsPage() {
  const user = await requireAuth();

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    include: {
      userA: { select: { id: true, handle: true, displayName: true, steamName: true } },
      userB: { select: { id: true, handle: true, displayName: true, steamName: true } },
    },
  });

  const friends = friendships.map((friendship) => {
    const other =
      friendship.userAId === user.id ? friendship.userB : friendship.userA;
    return {
      id: other.id,
      handle: other.handle,
      displayName: other.displayName,
      steamName: other.steamName,
    };
  });

  const incomingRequests = await prisma.friendRequest.findMany({
    where: { toUserId: user.id, status: "PENDING" },
    include: {
      fromUser: { select: { id: true, handle: true, displayName: true, steamName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const outgoingRequests = await prisma.friendRequest.findMany({
    where: { fromUserId: user.id, status: "PENDING" },
    include: {
      toUser: { select: { id: true, handle: true, displayName: true, steamName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Friends</h1>
      <p className="mt-2 text-sm text-ink/70">
        Connect with trusted hosts and squadmates.
      </p>
      <div className="mt-6">
        <FriendsView
          currentUserId={user.id}
          initialFriends={friends}
          initialIncoming={incomingRequests.map((request) => ({
            id: request.id,
            createdAt: request.createdAt.toISOString(),
            fromUser: request.fromUser,
          }))}
          initialOutgoing={outgoingRequests.map((request) => ({
            id: request.id,
            createdAt: request.createdAt.toISOString(),
            toUser: request.toUser,
          }))}
        />
      </div>
    </div>
  );
}
