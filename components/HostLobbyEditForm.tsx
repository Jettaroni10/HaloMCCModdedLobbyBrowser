"use client";

import { useRouter } from "next/navigation";
import HostLobbyForm from "./HostLobbyForm";
import MapImageUploader from "./MapImageUploader";

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

    const response = await fetch(`/api/lobbies/${lobbyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
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

