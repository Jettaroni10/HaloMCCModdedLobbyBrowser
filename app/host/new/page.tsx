import { requireAuth } from "@/lib/auth";
import HostLobbyForm from "@/components/HostLobbyForm";

export default async function NewLobbyPage() {
  await requireAuth();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Create a lobby</h1>
      <p className="mt-2 text-sm text-ink/70">
        Publish only what you want players to see. No automatic invites are
        sent.
      </p>
      <HostLobbyForm
        submitLabel="Publish lobby"
        enableMapImage={true}
        enableTelemetryBinding={true}
      />
    </div>
  );
}

