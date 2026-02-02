import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import HostDashboard from "@/components/HostDashboard";
import { logPerf } from "@/lib/perf";

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Host dashboard</h1>
          <p className="mt-2 text-sm text-ink/70">
            Publish opt-in listings and manage invite requests.
          </p>
        </div>
        <Link
          href="/host/new"
          className="rounded-sm bg-ink px-6 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          Create lobby
        </Link>
      </div>

      <HostDashboard
        lobbies={serializedLobbies}
        requests={serializedRequests}
        hostUserId={user.id}
      />
    </div>
  );
}

