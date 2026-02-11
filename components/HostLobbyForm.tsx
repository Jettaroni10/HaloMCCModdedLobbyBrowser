"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import TagsInput from "./TagsInput";
import { downscaleImageFile } from "@/lib/image-client";
import MapPreview from "./MapPreview";
import ImageCropUpload from "@/components/ImageCropUpload";
import { hashId, trackEvent, trackFeatureUsed } from "@/lib/analytics";
import { useOverlayTelemetryContext } from "@/components/OverlayTelemetryProvider";
import { useLiveBindingPreference } from "@/lib/useLiveBindingPreference";

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
  sessionMode?: boolean;
};

type CurrentLobbyInfo = {
  id: string;
  name: string;
  rosterCount: number;
  maxPlayers?: number | null;
  status?: string | null;
};

export default function HostLobbyForm({
  defaultValues,
  submitLabel = "Publish lobby",
  action = "/api/lobbies",
  method = "post",
  onSubmit,
  enableMapImage = false,
  enableTelemetryBinding = false,
  sessionMode = false,
}: HostLobbyFormProps) {
  const router = useRouter();
  const { state: telemetryState } = useOverlayTelemetryContext();
  const isConnected = telemetryState.overlayConnected;
  const localTelemetry = telemetryState.localTelemetry;
  const localLastReceiveAt = telemetryState.localLastReceiveAt;
  const [isOverlayEnv, setIsOverlayEnv] = useState(false);
  const overlaySessionMode = sessionMode && isOverlayEnv;
  const defaultTags = useMemo(() => defaultValues?.tags ?? [], [defaultValues]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [currentLobby, setCurrentLobby] = useState<CurrentLobbyInfo | null>(
    null
  );
  const [pendingCreate, setPendingCreate] = useState<{
    payload: Record<string, unknown>;
    modCount: number;
  } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [useCustomMapImage, setUseCustomMapImage] = useState(false);
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
  const { liveBindingPreference, setLiveBindingPreference } =
    useLiveBindingPreference(true);
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
  const [sessionState, setSessionState] = useState<{
    status: "loading" | "none" | "host" | "member";
    lobby: CurrentLobbyInfo | null;
  }>({ status: "none", lobby: null });
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncNow, setSyncNow] = useState(Date.now());
  const lastPublishAtRef = useRef<number | null>(null);
  const lastPublishedSeqRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    setIsOverlayEnv(Boolean(bridge));
  }, []);

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

  const liveBindingEnabled =
    enableTelemetryBinding && isConnected && liveBindingPreference;
  const overlayMap =
    typeof localTelemetry?.map === "string" ? localTelemetry.map : "";
  const overlayInMenus =
    isConnected &&
    (!overlayMap.trim() || overlayMap.trim().toLowerCase() === "unknown");
  const overlayStatus = overlayInMenus ? "Lobby in menus" : "In match";

  useEffect(() => {
    if (!liveBindingEnabled || !localTelemetry) return;
    if (typeof localTelemetry.mode === "string" && localTelemetry.mode.length > 0) {
      setModeValue(localTelemetry.mode);
    }
    if (typeof localTelemetry.map === "string" && localTelemetry.map.length > 0) {
      setMapValue(localTelemetry.map);
    }
  }, [liveBindingEnabled, localTelemetry?.mode, localTelemetry?.map]);

  useEffect(() => {
    if (!overlaySessionMode || !localTelemetry) return;
    if (typeof localTelemetry.mode === "string" && localTelemetry.mode.length > 0) {
      setModeValue(localTelemetry.mode);
    }
    if (typeof localTelemetry.map === "string" && localTelemetry.map.length > 0) {
      setMapValue(localTelemetry.map);
    }
  }, [overlaySessionMode, localTelemetry?.mode, localTelemetry?.map]);

  async function loadSessionState() {
    if (!overlaySessionMode) return;
    setSessionError(null);
    setSessionState({ status: "loading", lobby: null });
    try {
      const response = await fetch("/api/lobbies/current", {
        cache: "no-store",
      });
      if (!response.ok) {
        setSessionState({ status: "none", lobby: null });
        return;
      }
      const payload = (await response.json()) as {
        ok?: boolean;
        isHost?: boolean;
        lobby?: CurrentLobbyInfo | null;
      };
      if (payload?.ok && payload.lobby?.id) {
        setSessionState({
          status: payload.isHost ? "host" : "member",
          lobby: payload.lobby,
        });
      } else {
        setSessionState({ status: "none", lobby: null });
      }
    } catch (error) {
      setSessionState({ status: "none", lobby: null });
      setSessionError(
        error instanceof Error ? error.message : "Unable to load session."
      );
    }
  }

  useEffect(() => {
    if (!overlaySessionMode) return;
    void loadSessionState();
  }, [overlaySessionMode]);

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

  const sessionStatusLabel = useMemo(() => {
    if (!overlaySessionMode) return "";
    if (!isConnected) return "OFFLINE";
    const status = localTelemetry?.status ?? "inactive";
    if (status === "active") return "IN MATCH";
    if (status === "waiting") return "IN CUSTOM GAME";
    if (status === "stale") return "STALE";
    return "IN MENUS";
  }, [overlaySessionMode, isConnected, localTelemetry?.status]);

  const sessionStatusTone = useMemo(() => {
    if (!overlaySessionMode) return "border-ink/20 bg-mist text-ink";
    if (!isConnected) return "border-ink/10 bg-ink/50 text-sand/70";
    if (localTelemetry?.status === "active") {
      return "border-clay/50 bg-clay/20 text-sand";
    }
    if (localTelemetry?.status === "waiting") {
      return "border-white/30 bg-white/10 text-sand";
    }
    if (localTelemetry?.status === "stale") {
      return "border-red-400/50 bg-red-500/20 text-red-100";
    }
    return "border-ink/20 bg-mist text-ink";
  }, [overlaySessionMode, isConnected, localTelemetry?.status]);

  const sessionLastUpdated = useMemo(() => {
    if (!overlaySessionMode || !localLastReceiveAt) return "No recent data";
    const diffMs = Date.now() - localLastReceiveAt;
    const seconds = Math.max(0, Math.round(diffMs / 1000));
    if (seconds < 60) return `Updated ${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    return `Updated ${minutes}m ago`;
  }, [overlaySessionMode, localLastReceiveAt]);

  const sessionMap = mapValue || "Unknown";
  const sessionModeValue = modeValue || "Unknown";
  const sessionPlayers =
    typeof localTelemetry?.currentPlayers === "number"
      ? localTelemetry.currentPlayers
      : 0;
  const sessionMaxPlayers =
    typeof localTelemetry?.maxPlayers === "number" && localTelemetry.maxPlayers > 0
      ? localTelemetry.maxPlayers
      : null;

  const isLive = overlaySessionMode && sessionState.status === "host";
  const isMember = overlaySessionMode && sessionState.status === "member";

  const syncStatusText = useMemo(() => {
    if (!overlaySessionMode) return "";
    if (!isLive) return "Offline";
    if (!isConnected || !localTelemetry || overlayInMenus) {
      return "Live - Waiting for session...";
    }
    if (!lastSyncAt) return "Live - Syncing...";
    const ageMs = Math.max(0, syncNow - lastSyncAt);
    const seconds = Math.floor(ageMs / 1000);
    return `Live - Last sync ${seconds}s ago`;
  }, [
    overlaySessionMode,
    isLive,
    isConnected,
    localTelemetry,
    overlayInMenus,
    lastSyncAt,
    syncNow,
  ]);

  useEffect(() => {
    if (!overlaySessionMode || !isLive) {
      setLastSyncAt(null);
      return;
    }
  }, [overlaySessionMode, isLive]);

  useEffect(() => {
    if (!overlaySessionMode || !isLive) return;
    const interval = setInterval(() => {
      setSyncNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [overlaySessionMode, isLive]);

  useEffect(() => {
    if (!overlaySessionMode || !isLive) return;
    if (!isConnected || !localTelemetry) return;
    const lobbyId = sessionState?.lobby?.id;
    if (!lobbyId) return;
    const seq = Number.isFinite(Number(localTelemetry.seq))
      ? Number(localTelemetry.seq)
      : null;
    if (seq !== null && lastPublishedSeqRef.current === seq) return;
    const now = Date.now();
    if (lastPublishAtRef.current && now - lastPublishAtRef.current < 2000) {
      return;
    }
    lastPublishAtRef.current = now;
    if (seq !== null) lastPublishedSeqRef.current = seq;
    const payload = {
      mapName: sessionMap,
      modeName: sessionModeValue,
      playerCount: sessionPlayers,
      status: localTelemetry.status ?? null,
      seq,
      emittedAt: localTelemetry.emittedAt ?? null,
    };
    let active = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/lobbies/${lobbyId}/telemetry`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (response.ok && active) {
          setLastSyncAt(Date.now());
        }
      } catch {
        // ignore publish errors for UI
      }
    })();
    return () => {
      active = false;
    };
  }, [
    overlaySessionMode,
    isLive,
    sessionState.lobby?.id,
    isConnected,
    localTelemetry,
    sessionMap,
    sessionModeValue,
    sessionPlayers,
  ]);

  async function handleStopLive() {
    if (!sessionState.lobby?.id || sessionBusy) return;
    setSessionBusy(true);
    setSessionError(null);
    try {
      const response = await fetch(`/api/lobbies/${sessionState.lobby.id}/leave`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Unable to stop live session.");
      }
      setSessionState({ status: "none", lobby: null });
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Unable to stop live session."
      );
    } finally {
      setSessionBusy(false);
    }
  }

  function handleStartLive() {
    if (sessionBusy || isSubmitting) return;
    setSessionError(null);
    formRef.current?.requestSubmit();
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
    if (isSubmitting) return;
    event.preventDefault();
    setSubmitError(null);
    setSubmitStatus(null);
    setIsSubmitting(true);

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

    if (overlaySessionMode) {
      const trimmedTitle =
        typeof payload.title === "string" ? payload.title.trim() : "";
      if (!trimmedTitle) {
        payload.title = "Live customs session";
      }
      const trimmedRules =
        typeof payload.rulesNote === "string" ? payload.rulesNote.trim() : "";
      if (!trimmedRules) {
        payload.rulesNote = "Session details will populate once detected.";
      }
      payload.map = sessionMap;
      payload.mode = sessionModeValue;
      payload.maxPlayers = sessionMaxPlayers ?? 16;
      payload.game =
        typeof payload.game === "string" && payload.game.length > 0
          ? payload.game
          : Games[0];
      payload.region =
        typeof payload.region === "string" && payload.region.length > 0
          ? payload.region
          : Regions[0];
      payload.voice =
        typeof payload.voice === "string" && payload.voice.length > 0
          ? payload.voice
          : Voices[0];
      payload.vibe =
        typeof payload.vibe === "string" && payload.vibe.length > 0
          ? payload.vibe
          : Vibes[0];
    }

    const response = await fetch(action, {
      method: method.toUpperCase(),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = "Unable to publish lobby.";
      let alreadyLobby: CurrentLobbyInfo | null = null;
      try {
        const errorPayload = (await response.json()) as {
          error?: string;
          code?: string;
          currentLobby?: CurrentLobbyInfo;
        };
        if (errorPayload?.error) message = errorPayload.error;
        if (
          errorPayload?.code === "ALREADY_IN_LOBBY" &&
          errorPayload.currentLobby
        ) {
          alreadyLobby = errorPayload.currentLobby;
        }
      } catch {
        // ignore JSON parse errors
      }
      if (alreadyLobby) {
        if (!currentLobby) {
          setCurrentLobby(alreadyLobby);
          setPendingCreate({ payload, modCount });
          setModalError(null);
        }
        setIsSubmitting(false);
        return;
      }
      setSubmitError(message);
      setIsSubmitting(false);
      return;
    }

    const created = (await response.json().catch(() => null)) as
      | {
          id?: string;
          title?: string | null;
          slotsTotal?: number | null;
          status?: string | null;
        }
      | null;
    const lobbyId = created?.id;
    let uploadError: string | null = null;

    if (
      !overlaySessionMode &&
      enableMapImage &&
      useCustomMapImage &&
      mapFile &&
      lobbyId
    ) {
      try {
        await uploadMapImage(lobbyId, mapFile);
      } catch (error) {
        uploadError = error instanceof Error ? error.message : "Upload failed.";
      }
    }

    if (uploadError && lobbyId) {
      setSubmitError(`${uploadError} You can re-upload from the host menu.`);
      setIsSubmitting(false);
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

    setIsSubmitting(false);
    if (overlaySessionMode) {
      if (lobbyId) {
        setSessionState({
          status: "host",
          lobby: {
            id: lobbyId,
            name:
              typeof created?.title === "string"
                ? created.title
                : typeof payload.title === "string"
                  ? payload.title
                  : "Live customs session",
            rosterCount: 1,
            maxPlayers:
              typeof created?.slotsTotal === "number"
                ? created.slotsTotal
                : sessionMaxPlayers ?? null,
            status:
              typeof created?.status === "string" ? created.status : null,
          },
        });
        setSubmitStatus("Live session published.");
      }
      return;
    }
    router.push("/host");
  }

  async function handleLeaveAndCreate() {
    if (!pendingCreate || modalBusy) return;
    setModalBusy(true);
    setModalError(null);
    setSubmitStatus(null);
    try {
      const response = await fetch("/api/lobbies/leave-and-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingCreate.payload),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            lobbyId?: string;
            reused?: boolean;
            message?: string;
            code?: string;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.lobbyId) {
        throw new Error(payload?.message ?? "Unable to create lobby.");
      }

      const lobbyId = payload.lobbyId;
      if (payload.reused) {
        setSubmitStatus("Lobby already created — taking you there");
      }
      let uploadError: string | null = null;

      if (
        !overlaySessionMode &&
        enableMapImage &&
        useCustomMapImage &&
        mapFile &&
        lobbyId
      ) {
        try {
          await uploadMapImage(lobbyId, mapFile);
        } catch (error) {
          uploadError =
            error instanceof Error ? error.message : "Upload failed.";
        }
      }

      if (uploadError && lobbyId) {
        setModalError(`${uploadError} You can re-upload from the host menu.`);
        router.push(`/host/lobbies/${lobbyId}/edit?uploadFailed=1`);
        return;
      }

      if (lobbyId) {
        trackEvent("lobby_created", {
          lobby_id: hashId(lobbyId),
          game: String(pendingCreate.payload.game ?? ""),
          is_modded: isModded,
          mod_count: pendingCreate.modCount,
        });
      }

      if (overlaySessionMode) {
        setSessionState({
          status: "host",
          lobby: {
            id: lobbyId,
            name:
              typeof pendingCreate.payload.title === "string"
                ? pendingCreate.payload.title
                : "Live customs session",
            rosterCount: 1,
            maxPlayers: Number.isFinite(Number(pendingCreate.payload.maxPlayers))
              ? Number(pendingCreate.payload.maxPlayers)
              : sessionMaxPlayers ?? null,
            status: null,
          },
        });
        setSubmitStatus(
          payload.reused
            ? "Lobby already created - you're live."
            : "Live session published."
        );
        setCurrentLobby(null);
        setPendingCreate(null);
        return;
      }

      setCurrentLobby(null);
      setPendingCreate(null);
      router.push(lobbyId ? `/lobbies/${lobbyId}` : "/host");
    } catch (error) {
      setModalError(
        error instanceof Error ? error.message : "Unable to create lobby."
      );
    } finally {
      setModalBusy(false);
    }
  }

  function handleGoToCurrent() {
    if (!currentLobby || modalBusy) return;
    setModalBusy(true);
    setModalError(null);
    fetch("/api/lobbies/leave-and-create?check=1", { method: "POST" })
      .then((response) =>
        response
          .json()
          .catch(() => null)
          .then((payload) => ({ response, payload }))
      )
      .then(({ response, payload }) => {
        const ok = response.ok && payload?.ok && payload?.lobbyId;
        if (!ok) {
          setSubmitError("That lobby is no longer available.");
          setCurrentLobby(null);
          setPendingCreate(null);
          return;
        }
        setCurrentLobby(null);
        setPendingCreate(null);
        router.push(`/lobbies/${payload.lobbyId}`);
      })
      .catch(() => {
        setSubmitError("That lobby is no longer available.");
        setCurrentLobby(null);
        setPendingCreate(null);
      })
      .finally(() => {
        setModalBusy(false);
      });
  }

  const rosterSummary = currentLobby
    ? typeof currentLobby.maxPlayers === "number" &&
      Number.isFinite(currentLobby.maxPlayers)
      ? `Players: ${currentLobby.rosterCount} / ${currentLobby.maxPlayers}`
      : `Players: ${currentLobby.rosterCount}`
    : "";

  return (
    <>
      {currentLobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-md border border-ink/20 bg-sand p-5 text-ink shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
                  You&apos;re already in a lobby
                </p>
                <h2 className="mt-2 text-lg font-semibold text-ink">
                  {currentLobby.name}
                </h2>
              </div>
              {currentLobby.status && (
                <span className="rounded-sm border border-ink/20 bg-mist px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/70">
                  {currentLobby.status}
                </span>
              )}
            </div>

            <div className="mt-3 text-sm text-ink/70">{rosterSummary}</div>

            {modalError && (
              <p className="mt-3 text-xs font-semibold text-clay">
                {modalError}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLeaveAndCreate}
                disabled={modalBusy}
                className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/60"
              >
                {modalBusy
                  ? "Leaving & creating..."
                  : "Leave current lobby & Host new lobby"}
              </button>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentLobby(null);
                    setPendingCreate(null);
                    setModalError(null);
                  }}
                  disabled={modalBusy}
                  className="rounded-sm border border-ink/20 px-3 py-2 text-xs font-semibold text-ink/70 hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGoToCurrent}
                  disabled={modalBusy}
                  className="text-xs font-semibold text-clay hover:text-clay/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Go to current lobby
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {overlaySessionMode && (
        <section className="rounded-md border border-ink/10 bg-sand p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
                My Session
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">
                  {isLive
                    ? "Live session"
                    : isMember
                      ? "Currently in a lobby"
                      : "Session offline"}
                </h2>
                {sessionState.status === "loading" && (
                  <span className="text-xs font-semibold text-ink/50">
                    Checking status...
                  </span>
                )}
              </div>
              {sessionState.lobby?.name && (
                <p className="mt-1 text-xs text-ink/60">
                  Listing: {sessionState.lobby.name}
                </p>
              )}
              <p className="mt-1 text-xs text-ink/50">{sessionLastUpdated}</p>
            </div>
            <span
              className={`rounded-sm border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${sessionStatusTone}`}
            >
              {sessionStatusLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-ink/70 md:grid-cols-4">
            <div>
              Map <span className="font-semibold text-ink">{sessionMap}</span>
            </div>
            <div>
              Mode{" "}
              <span className="font-semibold text-ink">{sessionModeValue}</span>
            </div>
            <div>
              Players{" "}
              <span className="font-semibold text-ink">
                {sessionPlayers}
                {sessionMaxPlayers ? ` / ${sessionMaxPlayers}` : ""}
              </span>
            </div>
            <div>
              Status{" "}
              <span className="font-semibold text-ink">{sessionStatusLabel}</span>
            </div>
          </div>

          {(!isConnected || !localTelemetry || overlayInMenus) && (
            <div className="mt-4 rounded-sm border border-ink/10 bg-mist px-3 py-2 text-xs text-ink/60">
              No active session detected. Start MCC (EAC off) and enter Customs
              menus.
            </div>
          )}

          {isLive && (!localTelemetry || overlayInMenus || !isConnected) && (
            <div className="mt-3 rounded-sm border border-clay/40 bg-clay/10 px-3 py-2 text-xs text-clay">
              Session details will populate once detected.
            </div>
          )}

          {sessionError && (
            <p className="mt-3 text-xs font-semibold text-clay">
              {sessionError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {isLive ? (
              <button
                type="button"
                onClick={handleStopLive}
                disabled={sessionBusy}
                className="rounded-sm border border-clay/50 px-4 py-2 text-xs font-semibold text-clay hover:border-clay/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sessionBusy ? "Stopping..." : "Stop"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartLive}
                disabled={isSubmitting || sessionBusy}
                className="rounded-sm bg-ink px-4 py-2 text-xs font-semibold text-sand hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/60"
              >
                {isSubmitting ? "Going live..." : "Go Live"}
              </button>
            )}
            {isMember && (
              <p className="text-xs text-ink/60">
                You&apos;re already in a lobby. Going live will leave it.
              </p>
            )}
            <span className="text-xs text-ink/50">{syncStatusText}</span>
          </div>
        </section>
      )}

      <form
        action={action}
        method={method}
        encType="multipart/form-data"
        onSubmit={handleSubmit}
        ref={formRef}
        className="mt-6 space-y-5 rounded-md border border-ink/10 bg-sand p-6"
      >
      {overlaySessionMode && (
        <button type="submit" className="hidden" aria-hidden="true">
          Submit
        </button>
      )}

      {!overlaySessionMode && enableTelemetryBinding && (
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
                {localTelemetry?.map ?? "Unknown"}
              </span>
            </div>
            <div>
              Mode{" "}
              <span className="font-semibold text-ink">
                {localTelemetry?.mode ?? "Unknown"}
              </span>
            </div>
            <div>
              Players{" "}
              <span className="font-semibold text-ink">
                {typeof localTelemetry?.currentPlayers === "number"
                  ? localTelemetry.currentPlayers
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
              checked={!liveBindingPreference}
              onChange={(event) =>
                setLiveBindingPreference(!event.target.checked)
              }
              className="h-3.5 w-3.5 rounded border-ink/20"
            />
            Manual override (stop live binding)
          </label>
        </div>
      )}

      <label className="block text-sm font-semibold text-ink">
        {overlaySessionMode ? "Headline (optional)" : "Title"}
        <input
          name="title"
          required={!overlaySessionMode}
          defaultValue={defaultValues?.title ?? ""}
          className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
      </label>

      {!overlaySessionMode && (
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
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {!overlaySessionMode && (
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
        )}
        <label className="block text-sm font-semibold text-ink">
          {overlaySessionMode ? "Region (optional)" : "Region"}
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

      {!overlaySessionMode && (
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
      )}

      <label className="block text-sm font-semibold text-ink">
        Tags
        <TagsInput name="tags" defaultTags={defaultTags} />
      </label>

      <label className="block text-sm font-semibold text-ink">
        {overlaySessionMode ? "Description (optional)" : "Rules note"}
        <textarea
          name="rulesNote"
          required={!overlaySessionMode}
          rows={3}
          defaultValue={defaultValues?.rulesNote ?? ""}
          className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
      </label>

      {!overlaySessionMode && enableMapImage && (
        <div className="rounded-sm border border-ink/10 bg-mist p-4">
          <p className="text-sm font-semibold text-ink">Map image</p>
          <p className="mt-1 text-xs text-ink/60">
            Optional. Enable only if you want a custom lobby image.
          </p>
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink/60">
            <input
              type="checkbox"
              checked={useCustomMapImage}
              onChange={(event) => {
                const next = event.target.checked;
                setUseCustomMapImage(next);
                if (!next) {
                  setMapFile(null);
                  setMapPreviewUrl(null);
                  setSubmitError(null);
                }
              }}
              className="h-3.5 w-3.5 rounded border-ink/20"
            />
            Use custom lobby image
          </label>
          {useCustomMapImage && (
            <>
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
            </>
          )}
        </div>
      )}

      {!overlaySessionMode && (
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
      )}

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

      {!overlaySessionMode && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          {isSubmitting ? "Publishing..." : submitLabel}
        </button>
      )}
      {submitStatus && (
        <p className="text-xs font-semibold text-moss">{submitStatus}</p>
      )}
      {submitError && (
        <p className="text-xs font-semibold text-clay">{submitError}</p>
      )}
      </form>
    </>
  );
}

