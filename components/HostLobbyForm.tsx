"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import TagsInput from "./TagsInput";
import { downscaleImageFile } from "@/lib/image-client";
import MapPreview from "./MapPreview";

type ModPackSummary = {
  id: string;
  name: string;
  description?: string | null;
  mods: Array<{
    id: string;
    name: string;
    workshopUrl: string;
    isOptional?: boolean;
  }>;
};

type ModEntryDraft = {
  name: string;
  workshopUrl: string;
  isOptional: boolean;
};

type HostLobbyFormProps = {
  defaultValues?: {
    title?: string;
    game?: string;
    mode?: string;
    map?: string;
    region?: string;
    voice?: string;
    vibe?: string;
    tags?: string[];
    rulesNote?: string;
    slotsTotal?: number | null;
    friendsOnly?: boolean;
    modPackId?: string | null;
    workshopCollectionUrl?: string;
    workshopItemUrls?: string[];
    modNotes?: string | null;
  };
  submitLabel?: string;
  action?: string;
  method?: "post" | "get";
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  enableMapImage?: boolean;
};

export default function HostLobbyForm({
  defaultValues,
  submitLabel = "Publish lobby",
  action = "/api/lobbies",
  method = "post",
  onSubmit,
  enableMapImage = false,
}: HostLobbyFormProps) {
  const router = useRouter();
  const defaultTags = useMemo(() => defaultValues?.tags ?? [], [defaultValues]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [modPacks, setModPacks] = useState<ModPackSummary[]>([]);
  const [modPackLoading, setModPackLoading] = useState(false);
  const [modPackError, setModPackError] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState(
    defaultValues?.modPackId ?? ""
  );
  const [showPackCreator, setShowPackCreator] = useState(false);
  const [packName, setPackName] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packIsPublic, setPackIsPublic] = useState(false);
  const [packMods, setPackMods] = useState<ModEntryDraft[]>([
    { name: "", workshopUrl: "", isOptional: false },
  ]);
  const [packSaving, setPackSaving] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultValues?.modPackId) {
      setSelectedPackId(defaultValues.modPackId);
    }
  }, [defaultValues?.modPackId]);

  async function loadModPacks() {
    setModPackLoading(true);
    setModPackError(null);
    try {
      const response = await fetch("/api/modpacks", { method: "GET" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Unable to load mod packs.");
      }
      const payload = (await response.json()) as ModPackSummary[];
      setModPacks(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setModPackError(
        error instanceof Error ? error.message : "Unable to load mod packs."
      );
    } finally {
      setModPackLoading(false);
    }
  }

  useEffect(() => {
    void loadModPacks();
  }, []);

  const selectedPack = useMemo(
    () => modPacks.find((pack) => pack.id === selectedPackId) ?? null,
    [modPacks, selectedPackId]
  );

  function updatePackMod(index: number, update: Partial<ModEntryDraft>) {
    setPackMods((prev) =>
      prev.map((entry, idx) => (idx === index ? { ...entry, ...update } : entry))
    );
  }

  function addPackMod() {
    setPackMods((prev) => [
      ...prev,
      { name: "", workshopUrl: "", isOptional: false },
    ]);
  }

  function removePackMod(index: number) {
    setPackMods((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function createModPack() {
    setPackError(null);
    const trimmedName = packName.trim();
    if (!trimmedName) {
      setPackError("Pack name is required.");
      return;
    }
    const modsPayload = packMods
      .map((mod) => ({
        name: mod.name.trim(),
        workshopUrl: mod.workshopUrl.trim(),
        isOptional: mod.isOptional,
      }))
      .filter((mod) => mod.workshopUrl.length > 0);
    if (modsPayload.length === 0) {
      setPackError("Add at least one mod URL.");
      return;
    }
    setPackSaving(true);
    try {
      const response = await fetch("/api/modpacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: packDescription.trim() || undefined,
          isPublic: packIsPublic,
          mods: modsPayload,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Unable to create pack.");
      }
      const payload = (await response.json()) as { id?: string };
      await loadModPacks();
      if (payload?.id) {
        setSelectedPackId(payload.id);
      }
      setShowPackCreator(false);
      setPackName("");
      setPackDescription("");
      setPackIsPublic(false);
      setPackMods([{ name: "", workshopUrl: "", isOptional: false }]);
    } catch (error) {
      setPackError(
        error instanceof Error ? error.message : "Unable to create pack."
      );
    } finally {
      setPackSaving(false);
    }
  }

  async function uploadMapImage(lobbyId: string, file: File) {
    const prepared = await downscaleImageFile(file);
    const ext =
      prepared.name.split(".").pop()?.toLowerCase() ||
      prepared.type.split("/")[1] ||
      "webp";

    const uploadUrlResponse = await fetch(
      `/api/lobbies/${lobbyId}/map-image/upload-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: prepared.type,
          size: prepared.size,
          ext,
        }),
      }
    );
    if (!uploadUrlResponse.ok) {
      const payload = (await uploadUrlResponse.json()) as { error?: string };
      throw new Error(payload.error ?? "Upload failed.");
    }
    const uploadPayload = (await uploadUrlResponse.json()) as {
      uploadUrl: string;
      objectPath: string;
    };

    const bypassSigned =
      typeof window !== "undefined" && window.location.hostname === "localhost";
    let uploadedViaSigned = false;
    if (!bypassSigned) {
      try {
        const uploadResult = await fetch(uploadPayload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": prepared.type },
          body: prepared,
        });
        uploadedViaSigned = uploadResult.ok;
      } catch {
        uploadedViaSigned = false;
      }
    }

    if (!uploadedViaSigned) {
      const formData = new FormData();
      formData.append("file", prepared, prepared.name);
      const fallbackResponse = await fetch(
        `/api/lobbies/${lobbyId}/map-image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (!fallbackResponse.ok) {
        const payload = (await fallbackResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Upload failed.");
      }
      const payload = (await fallbackResponse.json().catch(() => null)) as
        | { url?: string | null }
        | null;
      setMapPreviewUrl(payload?.url ?? null);
      return;
    }

    const commitResponse = await fetch(
      `/api/lobbies/${lobbyId}/map-image/commit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath: uploadPayload.objectPath }),
      }
    );
    if (!commitResponse.ok) {
      const payload = (await commitResponse.json()) as { error?: string };
      throw new Error(payload.error ?? "Upload failed.");
    }

    const refresh = await fetch(`/api/lobbies/${lobbyId}/map-image`);
    if (refresh.ok) {
      const payload = (await refresh.json()) as { url?: string | null };
      setMapPreviewUrl(payload.url ?? null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (onSubmit) {
      onSubmit(event);
      return;
    }
    event.preventDefault();
    setSubmitError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key !== "mapImage") {
        payload[key] = value;
      }
    });
    payload.friendsOnly = formData.get("friendsOnly") === "on";

    const response = await fetch(action, {
      method: method.toUpperCase(),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = "Unable to publish lobby.";
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload?.error) message = payload.error;
      } catch {
        // ignore JSON parse errors
      }
      setSubmitError(message);
      return;
    }

    const created = (await response.json().catch(() => null)) as
      | { id?: string }
      | null;
    const lobbyId = created?.id;
    let uploadError: string | null = null;

    if (enableMapImage && mapFile && lobbyId) {
      try {
        await uploadMapImage(lobbyId, mapFile);
      } catch (error) {
        uploadError = error instanceof Error ? error.message : "Upload failed.";
      }
    }

    if (uploadError && lobbyId) {
      setSubmitError(`${uploadError} You can re-upload from the host menu.`);
      router.push(`/host/lobbies/${lobbyId}/edit?uploadFailed=1`);
      return;
    }

    router.push("/host");
  }

  return (
    <form
      action={action}
      method={method}
      encType="multipart/form-data"
      onSubmit={handleSubmit}
      className="mt-6 space-y-5 rounded-md border border-ink/10 bg-sand p-6"
    >
      <label className="block text-sm font-semibold text-ink">
        Title
        <input
          name="title"
          required
          defaultValue={defaultValues?.title ?? ""}
          className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Mode
          <input
            name="mode"
            required
            defaultValue={defaultValues?.mode ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Map
          <input
            name="map"
            required
            defaultValue={defaultValues?.map ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm font-semibold text-ink">
          Game
          <select
            name="game"
            defaultValue={defaultValues?.game ?? Games[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Games.map((game) => (
              <option key={game} value={game}>
                {game}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Region
          <select
            name="region"
            defaultValue={defaultValues?.region ?? Regions[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Voice
          <select
            name="voice"
            defaultValue={defaultValues?.voice ?? Voices[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Voices.map((voice) => (
              <option key={voice} value={voice}>
                {voice.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Vibe
          <select
            name="vibe"
            defaultValue={defaultValues?.vibe ?? Vibes[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Vibes.map((vibe) => (
              <option key={vibe} value={vibe}>
                {vibe.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold text-ink">
        Tags
        <TagsInput name="tags" defaultTags={defaultTags} />
      </label>

      <label className="block text-sm font-semibold text-ink">
        Rules note
        <textarea
          name="rulesNote"
          required
          rows={3}
          defaultValue={defaultValues?.rulesNote ?? ""}
          className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
      </label>

      {enableMapImage && (
        <div className="rounded-sm border border-ink/10 bg-mist p-4">
          <p className="text-sm font-semibold text-ink">
            Map image (optional)
          </p>
          <p className="mt-1 text-xs text-ink/60">
            JPG, PNG, or WebP up to 5 MB. We will resize large images.
          </p>
          {mapPreviewUrl && (
            <div className="mt-3">
              <MapPreview imageUrl={mapPreviewUrl} />
            </div>
          )}
          <input
            name="mapImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-3 text-xs text-ink/70"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                setMapFile(null);
                setMapPreviewUrl(null);
                return;
              }
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setSubmitError(
                  "Unsupported image format. Use JPG, PNG, or WebP."
                );
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                setSubmitError("Image is too large. Max 5 MB.");
                return;
              }
              setSubmitError(null);
              setMapFile(file);
              const preview = URL.createObjectURL(file);
              setMapPreviewUrl(preview);
            }}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Slots total
          <input
            name="slotsTotal"
            type="number"
            min={2}
            max={32}
            defaultValue={defaultValues?.slotsTotal ?? 16}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold text-ink">
        <input
          name="friendsOnly"
          type="checkbox"
          defaultChecked={defaultValues?.friendsOnly ?? false}
          className="h-4 w-4 rounded border-ink/20"
        />
        Friends only
      </label>

      <div className="rounded-sm border border-ink/10 bg-mist p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Mod pack</p>
          <button
            type="button"
            onClick={() => setShowPackCreator((prev) => !prev)}
            className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
          >
            {showPackCreator ? "Close pack builder" : "Create new pack"}
          </button>
        </div>
        <p className="mt-1 text-xs text-ink/60">
          Attach a reusable set of required mods. Players will see a simple
          “Get Ready” checklist.
        </p>
        <label className="mt-3 block text-sm font-semibold text-ink">
          Select pack
          <select
            name="modPackId"
            value={selectedPackId}
            onChange={(event) => setSelectedPackId(event.target.value)}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">No pack selected</option>
            {modPacks.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </label>
        {modPackLoading && (
          <p className="mt-2 text-xs text-ink/50">Loading mod packs…</p>
        )}
        {modPackError && (
          <p className="mt-2 text-xs font-semibold text-clay">
            {modPackError}
          </p>
        )}
        {selectedPack && (
          <div className="mt-3 rounded-sm border border-ink/10 bg-sand px-3 py-2 text-xs text-ink/70">
            <p className="text-xs font-semibold text-ink">
              {selectedPack.name}
            </p>
            {selectedPack.description && (
              <p className="mt-1 text-xs text-ink/60">
                {selectedPack.description}
              </p>
            )}
            <p className="mt-2 text-xs text-ink/60">
              {selectedPack.mods.filter((mod) => !mod.isOptional).length} required
              mod{selectedPack.mods.length === 1 ? "" : "s"}
            </p>
          </div>
        )}

        {showPackCreator && (
          <div className="mt-4 rounded-sm border border-ink/10 bg-sand p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              New mod pack
            </p>
            <label className="mt-3 block text-sm font-semibold text-ink">
              Pack name
              <input
                value={packName}
                onChange={(event) => setPackName(event.target.value)}
                className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
                placeholder="e.g. Desert Bus Required Mods"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-ink">
              Description (optional)
              <input
                value={packDescription}
                onChange={(event) => setPackDescription(event.target.value)}
                className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
                placeholder="Short note for your pack."
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink/60">
              <input
                type="checkbox"
                checked={packIsPublic}
                onChange={(event) => setPackIsPublic(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink/20"
              />
              Make pack public
            </label>
            <div className="mt-4 space-y-3">
              {packMods.map((mod, index) => (
                <div
                  key={`mod-${index}`}
                  className="grid gap-2 rounded-sm border border-ink/10 bg-mist p-3 md:grid-cols-[1fr_1.4fr_auto]"
                >
                  <input
                    value={mod.name}
                    onChange={(event) =>
                      updatePackMod(index, { name: event.target.value })
                    }
                    className="rounded-sm border border-ink/10 bg-sand px-3 py-2 text-xs"
                    placeholder="Mod name (optional)"
                  />
                  <input
                    value={mod.workshopUrl}
                    onChange={(event) =>
                      updatePackMod(index, { workshopUrl: event.target.value })
                    }
                    className="rounded-sm border border-ink/10 bg-sand px-3 py-2 text-xs"
                    placeholder="Steam Workshop URL"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-ink/60">
                      <input
                        type="checkbox"
                        checked={mod.isOptional}
                        onChange={(event) =>
                          updatePackMod(index, { isOptional: event.target.checked })
                        }
                        className="h-3 w-3 rounded border-ink/20"
                      />
                      Optional
                    </label>
                    {packMods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePackMod(index)}
                        className="text-[11px] font-semibold text-clay"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addPackMod}
                className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
              >
                Add another mod
              </button>
            </div>
            {packError && (
              <p className="mt-3 text-xs font-semibold text-clay">{packError}</p>
            )}
            <button
              type="button"
              onClick={createModPack}
              disabled={packSaving}
              className="mt-4 w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand disabled:cursor-not-allowed disabled:bg-ink/60"
            >
              {packSaving ? "Saving pack..." : "Save mod pack"}
            </button>
          </div>
        )}
      </div>

      <details
        className="rounded-sm border border-ink/10 bg-mist p-4"
        open={!selectedPackId}
      >
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Advanced: one-off workshop links
        </summary>
        <p className="mt-2 text-xs text-ink/60">
          Use this only if you are not selecting a mod pack.
        </p>
        <label className="mt-3 block text-sm font-semibold text-ink">
          Workshop collection URL (optional)
          <input
            name="workshopCollectionUrl"
            defaultValue={defaultValues?.workshopCollectionUrl ?? ""}
            disabled={Boolean(selectedPackId)}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-sand px-3 py-2 text-sm disabled:opacity-60"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          Workshop item URLs (optional)
          <textarea
            name="workshopItemUrls"
            rows={3}
            defaultValue={(defaultValues?.workshopItemUrls ?? []).join("\n")}
            disabled={Boolean(selectedPackId)}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-sand px-3 py-2 text-sm disabled:opacity-60"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          Mod notes
          <textarea
            name="modNotes"
            rows={3}
            defaultValue={defaultValues?.modNotes ?? ""}
            disabled={Boolean(selectedPackId)}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-sand px-3 py-2 text-sm disabled:opacity-60"
          />
        </label>
      </details>

      <button
        type="submit"
        className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
      >
        {submitLabel}
      </button>
      {submitError && (
        <p className="text-xs font-semibold text-clay">{submitError}</p>
      )}
    </form>
  );
}

