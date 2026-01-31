"use client";

import { useEffect, useRef, useState } from "react";

export type HostRequestCreatedEvent = {
  id: string;
  requesterUserId: string;
  requesterHandleText: string;
  requesterDisplayName?: string | null;
  requesterNametagColor?: string | null;
  note?: string | null;
  confirmedSubscribed?: boolean;
  confirmedEacOff?: boolean;
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

type HostToast = {
  id: string;
  message: string;
};

type UseHostEventsOptions = {
  enabled?: boolean;
  onRequestCreated?: (payload: HostRequestCreatedEvent) => void;
  onLobbyExpired?: (payload: HostLobbyExpiredEvent) => void;
};

const MUTE_KEY = "mcc_host_mute_pings";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function useHostEvents(options: UseHostEventsOptions = {}) {
  const { enabled = true } = options;
  const [toasts, setToasts] = useState<HostToast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  const onRequestCreatedRef = useRef(options.onRequestCreated);
  const onLobbyExpiredRef = useRef(options.onLobbyExpired);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    onRequestCreatedRef.current = options.onRequestCreated;
  }, [options.onRequestCreated]);

  useEffect(() => {
    onLobbyExpiredRef.current = options.onLobbyExpired;
  }, [options.onLobbyExpired]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(MUTE_KEY);
    if (stored !== null) {
      setMuted(stored === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MUTE_KEY, String(muted));
  }, [muted]);

  function enqueueToast(message: string) {
    const id = makeId();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 6000);
  }

  function playPing() {
    if (mutedRef.current) return;
    if (!audioRef.current) {
      audioRef.current = new Audio("/sfx/ping.mp3");
      audioRef.current.volume = 0.6;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource("/api/host/events");

    const handleRequestCreated = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as HostRequestCreatedEvent;
      if (onRequestCreatedRef.current) {
        onRequestCreatedRef.current(payload);
      }
      setUnreadCount((count) => count + 1);
      const name =
        payload.requesterDisplayName?.trim() ||
        payload.requesterHandleText ||
        "New requester";
      enqueueToast(`New request from ${name}`);
      playPing();
    };

    const handleLobbyExpired = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as HostLobbyExpiredEvent;
      if (onLobbyExpiredRef.current) {
        onLobbyExpiredRef.current(payload);
      }
    };

    source.addEventListener("request_created", handleRequestCreated);
    source.addEventListener("lobby_expired", handleLobbyExpired);

    return () => {
      source.close();
    };
  }, [enabled]);

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
  };
}
