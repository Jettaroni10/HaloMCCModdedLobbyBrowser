"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import TagsInput from "./TagsInput";
import { downscaleImageFile } from "@/lib/image-client";
import MapPreview from "./MapPreview";
import ImageCropUpload from "@/components/ImageCropUpload";
import { hashId, trackEvent, trackFeatureUsed } from "@/lib/analytics";
import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";

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
    isModded?: boolean;
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
  enableTelemetryBinding?: boolean;
};

export default function HostLobbyForm({
  defaultValues,
  submitLabel = "Publish lobby",
  action = "/api/lobbies",
  method = "post",
  onSubmit,
  enableMapImage = false,
  enableTelemetryBinding = false,
}: HostLobbyFormProps) {
  const router = useRouter();
  const { isConnected, state: overlayState } = useOverlayTelemetry();
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
  const [isModded, setIsModded] = useState(
    defaultValues?.isModded ?? false
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
  const [manualOverride, setManualOverride] = useState(false);
  const [modeValue, setModeValue] = useState(defaultValues?.mode ?? "");
  const [mapValue, setMapValue] = useState(defaultValues?.map ?? "");
  const [slotsValue, setSlotsValue] = useState<string | number>(
    defaultValues?.slotsTotal ?? 16
  );
  const defaultModUrls = useMemo(() => {
    const urls: string[] = [];
    if (defaultValues?.workshopCollectionUrl) {
      urls.push(defaultValues.workshopCollectionUrl);
    }
    if (defaultValues?.workshopItemUrls?.length) {
      urls.push(...defaultValues.workshopItemUrls);
    }
    return urls.join("\n");
  }, [
    defaultValues?.workshopCollectionUrl,
    defaultValues?.workshopItemUrls,
  ]);

  useEffect(() => {
    if (defaultValues?.modPackId) {
      setSelectedPackId(defaultValues.modPackId);
    }
  }, [defaultValues?.modPackId]);

  useEffect(() => {
    if (typeof defaultValues?.isModded === "boolean") {
      setIsModded(defaultValues.isModded);
    }
  }, [defaultValues?.isModded]);

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
    if (!isModded) return;
    void loadModPacks();
  }, [isModded]);

  useEffect(() => {
    if (!enableTelemetryBinding) {
      setManualOverride(false);
    }
  }, [enableTelemetryBinding]);

  const liveBindingEnabled =
    enableTelemetryBinding && isConnected && !manualOverride;
  const overlayMap = typeof overlayState?.map === "string" ? overlayState.map : "";
  const overlayInMenus =
    isConnected &&
    (!overlayMap.trim() || overlayMap.trim().toLowerCase() === "unknown");
  const overlayStatus = overlayInMenus ? "Lobby in menus" : "In match";

  useEffect(() => {
    if (!liveBindingEnabled || !overlayState) return;
    if (typeof overlayState.mode === "string" && overlayState.mode.length > 0) {
      setModeValue(overlayState.mode);
    }
    if (typeof overlayState.map === "string" && overlayState.map.length > 0) {
      setMapValue(overlayState.map);
    }
  }, [liveBindingEnabled, overlayState?.mode, overlayState?.map]);

  const selectedPack = useMemo(
    () => modPacks.find((pack) => pack.id === selectedPackId) ?? null,
    [modPacks, selectedPackId]
  );

  useEffect(() => {
    if (isModded) return;
    setSelectedPackId("");
    setShowPackCreator(false);
    setPackError(null);
  }, [isModded]);

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
      trackFeatureUsed("mod_pack_created", { success: true });
      setShowPackCreator(false);
      setPackName("");
      setPackDescription("");
      setPackIsPublic(false);
      setPackMods([{ name: "", workshopUrl: "", isOptional: false }]);
    } catch (error) {
      setPackError(
        error instanceof Error ? error.message : "Unable to create pack."
      );
      trackFeatureUsed("mod_pack_created", { success: false });
    } finally {
      setPackSaving(false);
    }
  }

  async function uploadMapImage(lobbyId: string, file: File) {
    const prepared = await downscaleImageFile(file);
    const formData = new FormData();
    formData.append("file", prepared, prepared.name);
    const response = await fetch(`/api/lobbies/${lobbyId}/map-image/upload`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as
      | { url?: string | null; error?: string; requestId?: string; stage?: string }
      | null;
    if (!response.ok) {
      let message = payload?.error ?? "Upload failed.";
      if (payload?.requestId) {
        message = `${message} (Request ID: ${payload.requestId}${
          payload.stage ? `, stage: ${payload.stage}` : ""
        })`;
      }
      throw new Error(message);
    }
    setMapPreviewUrl(payload?.url ?? null);
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
    payload.isModded = isModded;
    if (!isModded) {
      payload.modPackId = "";
      payload.modUrls = "";
    }
    const modUrlsRaw =
      typeof payload.modUrls === "string" ? payload.modUrls : "";
    const modCount = isModded
      ? selectedPack
        ? selectedPack.mods.filter((mod) => !mod.isOptional).length
        : modUrlsRaw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean).length
      : 0;

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

    if (lobbyId) {
      trackEvent("lobby_created", {
        lobby_id: hashId(lobbyId),
        game: String(payload.game ?? ""),
        is_modded: isModded,
        mod_count: modCount,
      });
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
      {enableTelemetryBinding && (
        <div className="rounded-sm border border-ink/10 bg-mist p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
                Overlay Telemetry
              </p>
              <p className="mt-1 text-xs text-ink/60">
                {isConnected
                  ? "Live telemetry connected. Fields stay in sync while live binding is on."
                  : "Overlay not detected yet. Launch the overlay app to connect."}
              </p>
            </div>
            <span
              className={`rounded-sm border px-3 py-1 text-xs font-semibold ${
                isConnected
                  ? "border-ink/20 bg-sand text-ink"
                  : "border-ink/10 bg-sand/60 text-ink/50"
              }`}
            >
              {isConnected ? "Live Connected" : "Disconnected"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-ink/70 md:grid-cols-4">
            <div>
              Map{" "}
              <span className="font-semibold text-ink">
                {overlayState?.map ?? "Unknown"}
              </span>
            </div>
            <div>
              Mode{" "}
              <span className="font-semibold text-ink">
                {overlayState?.mode ?? "Unknown"}
              </span>
            </div>
            <div>
              Players{" "}
              <span className="font-semibold text-ink">
                {typeof overlayState?.currentPlayers === "number"
                  ? overlayState.currentPlayers
                  : 0}
                /
                {typeof slotsValue === "number" || typeof slotsValue === "string"
                  ? slotsValue
                  : 0}
              </span>
            </div>
            <div>
              Status{" "}
              <span className="font-semibold text-ink">
                {overlayStatus}
              </span>
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink/60">
            <input
              type="checkbox"
              checked={manualOverride}
              onChange={(event) => setManualOverride(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink/20"
            />
            Manual override (stop live binding)
          </label>
        </div>
      )}

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
            value={modeValue}
            onChange={(event) => setModeValue(event.target.value)}
            readOnly={liveBindingEnabled}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Map
          <input
            name="map"
            required
            value={mapValue}
            onChange={(event) => setMapValue(event.target.value)}
            readOnly={liveBindingEnabled}
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
          <div className="mt-3">
            <ImageCropUpload
              aspect={16 / 9}
              maxWidth={1280}
              maxHeight={720}
              label="Choose map image"
              onCropped={(file) => {
                setSubmitError(null);
                setMapFile(file);
                const preview = URL.createObjectURL(file);
                setMapPreviewUrl(preview);
              }}
              onError={(message) => setSubmitError(message)}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Max players
          <input
            name="maxPlayers"
            type="number"
            min={2}
            max={16}
            value={slotsValue}
            onChange={(event) => setSlotsValue(event.target.value)}
            required
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

      <label className="flex items-center gap-3 text-sm font-semibold text-ink">
        <input
          name="isModded"
          type="checkbox"
          checked={isModded}
          onChange={(event) => setIsModded(event.target.checked)}
          className="h-4 w-4 rounded border-ink/20"
        />
        Mods required
      </label>

      {isModded && (
        <>
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
                        placeholder="Mod URL"
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
              Mod URLs
            </summary>
            <p className="mt-2 text-xs text-ink/60">
              Paste links to any mods you want players to install (one per line).
            </p>
            <label className="mt-3 block text-sm font-semibold text-ink">
              Mod URLs
              <textarea
                name="modUrls"
                rows={4}
                defaultValue={defaultModUrls}
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
        </>
      )}

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

