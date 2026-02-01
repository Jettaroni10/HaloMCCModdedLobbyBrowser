import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatEnum } from "@/lib/format";

export default async function AdminPage() {
  await requireAdmin();

  const lobbies = await prisma.lobby.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      host: {
        select: { gamertag: true },
      },
    },
  });

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, gamertag: true } },
      resolvedBy: { select: { id: true, gamertag: true } },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Admin</h1>
        <p className="mt-2 text-sm text-ink/70">
          Minimal moderation controls for opt-in lobbies.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Reports</h2>
        {reports.length === 0 && (
          <p className="text-sm text-ink/60">No reports yet.</p>
        )}
        {reports.map((report) => (
          <div
            key={report.id}
            className="rounded-sm border border-ink/10 bg-sand p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {report.category} · {report.targetType}
                </h3>
                <p className="text-sm text-ink/60">
                  Target: {report.targetId}
                </p>
                <p className="text-xs text-ink/50">
                  Reporter: {report.reporter.gamertag}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form
                  action={`/api/admin/reports/${report.id}/resolve`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="rounded-sm bg-ink px-3 py-1.5 text-xs font-semibold text-sand"
                  >
                    Resolve
                  </button>
                </form>
                <form
                  action={`/api/admin/reports/${report.id}/dismiss`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    Dismiss
                  </button>
                </form>
                {report.targetType === "USER" && (
                  <form action="/api/admin/ban-user" method="post">
                    <input
                      type="hidden"
                      name="userId"
                      value={report.targetId}
                    />
                    <button
                      type="submit"
                      className="rounded-sm border border-clay/40 px-3 py-1.5 text-xs font-semibold text-clay"
                    >
                      Ban user
                    </button>
                  </form>
                )}
                {report.targetType === "LOBBY" && (
                  <form action="/api/admin/takedown-lobby" method="post">
                    <input
                      type="hidden"
                      name="lobbyId"
                      value={report.targetId}
                    />
                    <button
                      type="submit"
                      className="rounded-sm border border-clay/40 px-3 py-1.5 text-xs font-semibold text-clay"
                    >
                      Takedown lobby
                    </button>
                  </form>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-ink/70">{report.details}</p>
            <p className="mt-2 text-xs text-ink/50">
              Status: {report.status}
              {report.resolvedBy && (
                <> · Resolved by {report.resolvedBy.gamertag}</>
              )}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Lobbies</h2>
        {lobbies.map((lobby) => (
          <div
            key={lobby.id}
            className="rounded-sm border border-ink/10 bg-sand p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {lobby.title}
                </h2>
                <p className="text-sm text-ink/60">
                  Host: {lobby.host.gamertag}
                </p>
              </div>
              <form action="/api/admin/takedown-lobby" method="post">
                <input type="hidden" name="lobbyId" value={lobby.id} />
                <button
                  type="submit"
                  className="rounded-sm border border-ink/20 px-4 py-1.5 text-xs font-semibold text-ink hover:border-ink/40"
                >
                  Close lobby
                </button>
              </form>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-ink/60">
              <span>{lobby.isActive ? "ACTIVE" : "INACTIVE"}</span>
              <span>•</span>
              <span>{formatEnum(lobby.game)}</span>
              <span>•</span>
              <span>{formatEnum(lobby.region)}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

