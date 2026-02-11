"use client";

import { useEffect, useState } from "react";

type OverlayBridge = {
  hideOverlayWindow?: () => Promise<boolean> | void;
  showOverlayWindow?: () => Promise<boolean> | void;
  requestQuit?: () => Promise<boolean> | void;
};

type LobbyState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "member"; lobbyId: string }
  | { status: "host"; lobbyId: string };

function getBridge(): OverlayBridge | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as { hmccOverlay?: OverlayBridge }).hmccOverlay;
  return candidate ?? null;
}

export default function OverlayWindowControls() {
  const [bridge, setBridge] = useState<OverlayBridge | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [lobbyState, setLobbyState] = useState<LobbyState>({ status: "none" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = getBridge();
    if (next) {
      setBridge(next);
    }
  }, []);

  const isOverlay = Boolean(bridge);

  const loadLobbyState = async () => {
    setLobbyState({ status: "loading" });
    try {
      const response = await fetch("/api/lobbies/current", {
        cache: "no-store",
      });
      if (!response.ok) {
        setLobbyState({ status: "none" });
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        isHost?: boolean;
        lobby?: { id?: string | null };
      };
      if (data?.ok && data.lobby?.id) {
        setLobbyState(
          data.isHost
            ? { status: "host", lobbyId: data.lobby.id }
            : { status: "member", lobbyId: data.lobby.id }
        );
        return;
      }
      setLobbyState({ status: "none" });
    } catch {
      setLobbyState({ status: "none" });
    }
  };

  const handleOpenDialog = () => {
    if (busy) return;
    setShowDialog(true);
    loadLobbyState();
  };

  const handleConfirmClose = async () => {
    if (!bridge || busy) return;
    setBusy(true);
    try {
      if (lobbyState.status === "host" || lobbyState.status === "member") {
        await fetch(`/api/lobbies/${lobbyState.lobbyId}/leave`, {
          method: "POST",
        }).catch(() => {});
      }
    } finally {
      await Promise.resolve(bridge.requestQuit?.());
    }
  };

  if (!isOverlay) return null;

  return (
    <>
      <div className="pointer-events-auto fixed right-4 top-4 z-[70] flex items-center gap-2">
        <button
          type="button"
          onClick={() => bridge?.hideOverlayWindow?.()}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/20 bg-ink/70 text-white/70 transition hover:border-white/40 hover:text-white"
          aria-label="Minimize overlay"
        >
          <span className="block h-[2px] w-3 bg-current" />
        </button>
        <button
          type="button"
          onClick={handleOpenDialog}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-red-400/50 bg-red-500/20 text-red-200 transition hover:border-red-300 hover:text-red-100"
          aria-label="Close overlay"
        >
          <span className="text-sm font-semibold">×</span>
        </button>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 px-4">
          <div className="w-full max-w-md rounded-md border border-white/10 bg-ink/95 p-6 text-sand shadow-2xl">
            <h2 className="text-lg font-semibold text-sand">
              Close HMCC Overlay?
            </h2>
            <p className="mt-2 text-sm text-sand/70">
              {lobbyState.status === "host" &&
                "Closing will close the lobby you’re hosting and remove you from any lobby."}
              {lobbyState.status === "member" &&
                "Closing will leave your current lobby."}
              {lobbyState.status === "none" &&
                "Closing will quit the overlay app."}
              {lobbyState.status === "loading" && "Checking lobby status..."}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={busy}
                className="rounded-sm border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-sand/70 transition hover:border-white/40 hover:text-sand disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={busy || lobbyState.status === "loading"}
                className="rounded-sm border border-red-400/60 bg-red-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-red-100 transition hover:border-red-300 hover:bg-red-500/50 disabled:opacity-60"
              >
                {busy ? "Closing..." : "Close Overlay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
