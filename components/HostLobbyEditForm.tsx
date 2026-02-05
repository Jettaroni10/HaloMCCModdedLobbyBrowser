"use client";

import { useRouter } from "next/navigation";
import HostLobbyForm from "./HostLobbyForm";
import MapImageUploader from "./MapImageUploader";
import { hashId, trackEvent } from "@/lib/analytics";

type HostLobbyEditFormProps = {
  lobbyId: string;
  defaultValues: {
    title: string;
    game: string;
    mode: string;
    map: string;
    region: string;
    voice: string;
    vibe: string;
    tags: string[];
    rulesNote: string;
    slotsTotal: number | null;
    friendsOnly: boolean;
    isModded: boolean;
    modPackId?: string | null;
    workshopCollectionUrl: string;
    workshopItemUrls: string[];
    modNotes: string | null;
  };
};

export default function HostLobbyEditForm({
  lobbyId,
  defaultValues,
}: HostLobbyEditFormProps) {
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(
      formData.entries()
    );
    payload.friendsOnly = formData.get("friendsOnly") === "on";
    payload.isModded = formData.get("isModded") === "on";

    const response = await fetch(`/api/lobbies/${lobbyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const modUrls =
        typeof payload.modUrls === "string"
          ? payload.modUrls
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : [];
      const isModded = Boolean(payload.isModded);
      trackEvent("lobby_updated", {
        lobby_id: hashId(lobbyId),
        game: typeof payload.game === "string" ? payload.game : defaultValues.game,
        is_modded: isModded,
        mod_count: isModded ? modUrls.length : 0,
      });
      router.push("/host");
    }
  }

  return (
    <div className="space-y-6">
      <MapImageUploader lobbyId={lobbyId} />
      <HostLobbyForm
        defaultValues={defaultValues}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
      />
    </div>
  );
}

