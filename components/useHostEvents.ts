"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createHostRealtimeClient } from "@/lib/realtime/ablyClient";

export type HostRequestCreatedEvent = {
  id: string;
  requesterUserId: string;
  requesterHandleText: string;
  requesterGamertag?: string | null;
  requesterNametagColor?: string | null;
  requesterSrLevel?: number | null;
  confirmedSubscribed?: boolean;
  status?: "PENDING" | "ACCEPTED" | "DECLINED";
  lobby: {
    id: string;
    title: string;
    isModded: boolean;
  };
  requestId?: string;
  lobbyId?: string;
};

export type HostLobbyExpiredEvent = {
  id: string;
  expiresAt: string;
};

export type HostRequestDecidedEvent = {
  id: string;
  status: "ACCEPTED" | "DECLINED";
  decidedByUserId: string | null;
  lobby: {
    id: string;
    title: string;
  };
};

type HostRequestCreatedEnvelope = {
  hostUserId: string;
  requesterGamertag: string;
  requesterNametagColor?: string | null;
  requesterSrLevel?: number | null;
  request: {
    id: string;
    requesterUserId: string;
    requesterHandleText: string;
    confirmedSubscribed: boolean;
    status: "PENDING";
    createdAt: string;
    lobby: {
      id: string;
      title: string;
      isModded: boolean;
    };
  };
};

type HostLobbyExpiredEnvelope = {
  hostUserId: string;
  lobby: {
    id: string;
    expiresAt: string;
  };
};

type HostRequestDecidedEnvelope = {
  hostUserId: string;
  request: {
    id: string;
    status: "ACCEPTED" | "DECLINED";
    decidedByUserId: string | null;
    lobby: {
      id: string;
      title: string;
    };
  };
};

type HostToast = {
  id: string;
  message: string;
};

type UseHostEventsOptions = {
  enabled?: boolean;
  hostUserId?: string | null;
  onRequestCreated?: (payload: HostRequestCreatedEvent) => void;
  onRequestDecided?: (payload: HostRequestDecidedEvent) => void;
  onLobbyExpired?: (payload: HostLobbyExpiredEvent) => void;
};

const MUTE_KEY = "mcc_host_mute_pings";
const UNREAD_KEY = "customs:hostUnreadCount";
const SOUND_LOCK_KEY = "customs:hostSoundLock";
const TAB_ID_KEY = "customs:hostTabId";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function parseUnread(value: string | null) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function getTabId() {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem(TAB_ID_KEY);
  if (existing) return existing;
  const created = makeId();
  window.sessionStorage.setItem(TAB_ID_KEY, created);
  return created;
}

function acquireSoundLock() {
  if (typeof window === "undefined") return true;
  const now = Date.now();
  const tabId = getTabId();
  const raw = window.localStorage.getItem(SOUND_LOCK_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { tabId?: string; ts?: number };
      if (
        parsed?.ts &&
        now - parsed.ts < 1500 &&
        parsed.tabId &&
        parsed.tabId !== tabId
      ) {
        return false;
      }
    } catch {
      // ignore
    }
  }
  window.localStorage.setItem(
    SOUND_LOCK_KEY,
    JSON.stringify({ tabId, ts: now })
  );
  return true;
}

function dispatchHostEvent(name: string, detail: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function normalizeRequestPayload(
  payload: unknown
): HostRequestCreatedEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as HostRequestCreatedEvent & {
    request?: HostRequestCreatedEnvelope["request"];
    requesterGamertag?: string;
    requesterNametagColor?: string | null;
    requesterSrLevel?: number | null;
  };

  if (data.request && typeof data.request.id === "string") {
    return {
      id: data.request.id,
      requesterUserId: data.request.requesterUserId,
      requesterHandleText: data.request.requesterHandleText,
      requesterGamertag: data.requesterGamertag,
      requesterNametagColor: data.requesterNametagColor ?? null,
      requesterSrLevel: data.requesterSrLevel ?? null,
      confirmedSubscribed: data.request.confirmedSubscribed,
      status: data.request.status,
      lobby: data.request.lobby,
      requestId: data.request.id,
      lobbyId: data.request.lobby.id,
    };
  }

  if (typeof data.id === "string" && data.lobby) {
    return data;
  }

  return null;
}

function normalizeExpiredPayload(payload: unknown): HostLobbyExpiredEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as HostLobbyExpiredEnvelope["lobby"] & {
    lobby?: HostLobbyExpiredEnvelope["lobby"];
  };
  if (data.lobby && typeof data.lobby.id === "string") {
    return { id: data.lobby.id, expiresAt: data.lobby.expiresAt };
  }
  if (typeof data.id === "string" && typeof data.expiresAt === "string") {
    return { id: data.id, expiresAt: data.expiresAt };
  }
  return null;
}

function normalizeDecidedPayload(
  payload: unknown
): HostRequestDecidedEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as HostRequestDecidedEnvelope["request"] & {
    request?: HostRequestDecidedEnvelope["request"];
  };
  if (data.request && typeof data.request.id === "string") {
    return data.request;
  }
  if (typeof data.id === "string" && data.lobby && data.status) {
    return {
      id: data.id,
      status: data.status,
      decidedByUserId: data.decidedByUserId ?? null,
      lobby: data.lobby,
    };
  }
  return null;
}

export function useHostEvents(options: UseHostEventsOptions = {}) {
  const { enabled = true, hostUserId } = options;
  const unreadKey = hostUserId ? `${UNREAD_KEY}:${hostUserId}` : UNREAD_KEY;
  const [toasts, setToasts] = useState<HostToast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [muted, setMuted] = useState(true);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const mutedRef = useRef(muted);
  const soundBlockedRef = useRef(soundBlocked);
  const onRequestCreatedRef = useRef(options.onRequestCreated);
  const onRequestDecidedRef = useRef(options.onRequestDecided);
  const onLobbyExpiredRef = useRef(options.onLobbyExpired);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    soundBlockedRef.current = soundBlocked;
  }, [soundBlocked]);

  useEffect(() => {
    onRequestCreatedRef.current = options.onRequestCreated;
  }, [options.onRequestCreated]);

  useEffect(() => {
    onRequestDecidedRef.current = options.onRequestDecided;
  }, [options.onRequestDecided]);

  useEffect(() => {
    onLobbyExpiredRef.current = options.onLobbyExpired;
  }, [options.onLobbyExpired]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedMute = window.localStorage.getItem(MUTE_KEY);
    if (storedMute !== null) {
      setMuted(storedMute === "true");
    }
    const storedUnread = window.localStorage.getItem(unreadKey);
    if (storedUnread !== null) {
      setUnreadCount(parseUnread(storedUnread));
    } else {
      setUnreadCount(0);
    }
  }, [unreadKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MUTE_KEY, String(muted));
  }, [muted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(unreadKey, String(unreadCount));
  }, [unreadCount, unreadKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("customs:hostUnread", { detail: { count: unreadCount } })
    );
  }, [unreadCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === unreadKey) {
        setUnreadCount(parseUnread(event.newValue));
      }
      if (event.key === MUTE_KEY && event.newValue !== null) {
        setMuted(event.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [unreadKey]);

  function enqueueToast(message: string) {
    const id = makeId();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 6000);
  }

  const playPing = useCallback(
    async (force = false) => {
      if (!force && mutedRef.current) return;
      if (!force && soundBlockedRef.current) return;
      if (!force && !acquireSoundLock()) return;

      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/notify.mp3");
        audioRef.current.volume = 0.6;
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      try {
        await audio.play();
        setSoundBlocked(false);
      } catch {
        if (!mutedRef.current) {
          setSoundBlocked(true);
        }
      }
    },
    []
  );

  const enableSound = useCallback(async () => {
    await playPing(true);
  }, [playPing]);

  function incrementUnread() {
    setUnreadCount((prev) => prev + 1);
  }

  function decrementUnread() {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  useEffect(() => {
    if (!enabled || !hostUserId) return;
    const client = createHostRealtimeClient();
    const channel = client.channels.get(`user:${hostUserId}:notifications`);

    const handleMessage = (message: { name?: string; data?: unknown }) => {
      if (message.name === "request_created") {
        const payload = normalizeRequestPayload(message.data);
        if (!payload) return;
        dispatchHostEvent("customs:hostRequestCreated", payload);
        onRequestCreatedRef.current?.(payload);
        incrementUnread();
        const name =
          payload.requesterGamertag?.trim() ||
          payload.requesterHandleText ||
          "New requester";
        enqueueToast(`New request from ${name}`);
        void playPing();
      }

      if (message.name === "lobby_expired") {
        const payload = normalizeExpiredPayload(message.data);
        if (!payload) return;
        dispatchHostEvent("customs:hostLobbyExpired", payload);
        onLobbyExpiredRef.current?.(payload);
        incrementUnread();
        enqueueToast("Lobby expired");
        void playPing();
      }

      if (message.name === "request_decided") {
        const payload = normalizeDecidedPayload(message.data);
        if (!payload) return;
        dispatchHostEvent("customs:hostRequestDecided", payload);
        onRequestDecidedRef.current?.(payload);
        decrementUnread();
      }
    };

    try {
      const subscribeResult = channel.subscribe(handleMessage);
      if (
        subscribeResult &&
        typeof (subscribeResult as Promise<unknown>).catch === "function"
      ) {
        (subscribeResult as Promise<unknown>).catch((error) => {
          console.warn("Ably host subscribe failed", {
            hostUserId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      console.warn("Ably host subscribe failed", {
        hostUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return () => {
      try {
        channel.unsubscribe();
      } catch {
        // ignore
      }
      try {
        client.close();
      } catch {
        // ignore
      }
    };
  }, [enabled, hostUserId, playPing]);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  function markViewed() {
    setUnreadCount(0);
  }

  return {
    toasts,
    dismissToast,
    unreadCount,
    markViewed,
    muted,
    setMuted,
    soundBlocked,
    enableSound,
  };
}
