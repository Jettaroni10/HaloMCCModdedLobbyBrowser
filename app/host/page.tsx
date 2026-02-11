import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import HostDashboard from "@/components/HostDashboard";
import { logPerf } from "@/lib/perf";
import HostPageHeader from "@/components/HostPageHeader";
export const dynamic = "force-dynamic";

export default async function HostPage() {
  const user = await requireAuth();
  const perfStart = Date.now();
  const [lobbies, requests] = await Promise.all([
    prisma.lobby.findMany({
      where: { hostUserId: user.id, isActive: true },
      orderBy: { lastHeartbeatAt: "desc" },
      include: { _count: { select: { members: true } } },
    }),
    prisma.joinRequest.findMany({
      where: { lobby: { hostUserId: user.id } },
      orderBy: { createdAt: "desc" },
      include: {
        lobby: { select: { id: true, title: true, isModded: true } },
        requester: { select: { nametagColor: true, srLevel: true } },
      },
    }),
  ]);
  logPerf("host page data", perfStart, {
    lobbies: lobbies.length,
    requests: requests.length,
  });

  const serializedLobbies = lobbies.map((lobby) => ({
    ...lobby,
    slotsOpen: Math.max(0, lobby.slotsTotal - lobby._count.members),
    lastHeartbeatAt: lobby.lastHeartbeatAt.toISOString(),
    expiresAt: lobby.expiresAt.toISOString(),
    createdAt: lobby.createdAt.toISOString(),
    updatedAt: lobby.updatedAt.toISOString(),
  }));

  const serializedRequests = requests.map((request) => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
    requesterNametagColor: request.requester?.nametagColor ?? null,
    requesterSrLevel: request.requester?.srLevel ?? null,
  }));

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-12 lg:px-8">
      <HostPageHeader />

      <HostDashboard
        className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]"
        lobbies={serializedLobbies}
        requests={serializedRequests}
        hostUserId={user.id}
      />
    </div>
  );
}

