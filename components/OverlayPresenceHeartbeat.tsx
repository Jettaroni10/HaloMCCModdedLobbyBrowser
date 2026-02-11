"use client";

import { useEffect, useRef, useState } from "react";

type OverlayBridge = {
  isHaloRunning?: () => Promise<boolean> | boolean;
  onShutdown?: (handler: (payload?: unknown) => void) => (() => void) | void;
};

const HEARTBEAT_INTERVAL_MS = 10000;
const INSTANCE_KEY = "hmcc_overlay_instance_id";

function getInstanceId() {
  if (typeof window === "undefined") return null;
  const existing = window.sessionStorage.getItem(INSTANCE_KEY);
  if (existing) return existing;
  const created = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  window.sessionStorage.setItem(INSTANCE_KEY, created);
  return created;
}

export default function OverlayPresenceHeartbeat() {
  const [active, setActive] = useState(false);
  const bridgeRef = useRef<OverlayBridge | null>(null);
  const instanceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = (window as { hmccOverlay?: OverlayBridge }).hmccOverlay;
    if (!bridge) return;
    bridgeRef.current = bridge;
    instanceIdRef.current = getInstanceId();
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    let isMounted = true;

    const sendHeartbeat = async () => {
      const bridge = bridgeRef.current;
      const overlayInstanceId = instanceIdRef.current;
      if (!bridge || !overlayInstanceId) return;
      const haloRunning = await Promise.resolve(
        bridge.isHaloRunning ? bridge.isHaloRunning() : true
      ).catch(() => true);
      await fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overlayInstanceId, haloRunning }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const timer = setInterval(() => {
      if (!isMounted) return;
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    const sendShutdown = () => {
      const overlayInstanceId = instanceIdRef.current;
      if (!overlayInstanceId || typeof navigator === "undefined") return;
      const payload = JSON.stringify({ overlayInstanceId });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/presence/shutdown", blob);
    };

    const handlePageHide = () => sendShutdown();
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    const unsubscribe =
      bridgeRef.current?.onShutdown?.(() => {
        sendShutdown();
      }) ?? null;

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [active]);

  return null;
}
