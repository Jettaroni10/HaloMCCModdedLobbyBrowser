"use client";

import { useEffect, useState } from "react";

type OverlayBridge = {
  hideOverlayWindow?: () => Promise<boolean> | void;
  showOverlayWindow?: () => Promise<boolean> | void;
  requestQuit?: () => Promise<boolean> | void;
  updateCheck?: () => Promise<UpdateCheckResult> | UpdateCheckResult;
  updateDownload?: () => Promise<UpdateCheckResult> | UpdateCheckResult;
  updateInstall?: () => Promise<{ ok?: boolean; message?: string } | null> | null;
};

type UpdateCheckResult =
  | { ok: true; status: "no-update" }
  | {
      ok: true;
      status: "update-available" | "downloaded";
      version?: string | null;
      releaseNotes?: string | null;
    }
  | { ok: true; status: "downloading"; progress?: number | null }
  | { ok: false; code?: string; message?: string };

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
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [lobbyState, setLobbyState] = useState<LobbyState>({ status: "none" });
  const [busy, setBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(
    null
  );

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

  const showToast = (message: string, tone: "info" | "error" = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleOpenDialog = () => {
    if (busy) return;
    setShowDialog(true);
    loadLobbyState();
  };

  const handleCheckUpdates = async () => {
    if (!bridge || checkingUpdates || updateBusy) return;
    setCheckingUpdates(true);
    setUpdateError(null);
    try {
      const result = await Promise.resolve(bridge.updateCheck?.());
      if (!result) {
        showToast("Update check failed.", "error");
        return;
      }
      if (result.ok === false) {
        showToast(result.message || "Update check failed.", "error");
        return;
      }
      if (result.status === "no-update") {
        showToast("You’re up to date.");
        return;
      }
      if (result.status === "downloading") {
        showToast("Update download in progress...");
        return;
      }
      setUpdateInfo(result);
      setShowUpdateDialog(true);
      loadLobbyState();
    } finally {
      setCheckingUpdates(false);
    }
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

  const handleConfirmUpdate = async () => {
    if (!bridge || updateBusy) return;
    setUpdateBusy(true);
    setUpdateError(null);
    try {
      if (lobbyState.status === "host" || lobbyState.status === "member") {
        const response = await fetch(`/api/lobbies/${lobbyState.lobbyId}/leave`, {
          method: "POST",
        });
        if (!response.ok && response.status !== 404) {
          setUpdateError("Unable to leave the lobby before updating.");
          setUpdateBusy(false);
          return;
        }
      }
      if (!updateInfo) {
        setUpdateError("Update details missing.");
        setUpdateBusy(false);
        return;
      }
      if (updateInfo.ok === false) {
        setUpdateError(updateInfo.message || "Update details invalid.");
        setUpdateBusy(false);
        return;
      }
      if (updateInfo.status !== "downloaded") {
        const downloadResult = await Promise.resolve(bridge.updateDownload?.());
        if (!downloadResult) {
          setUpdateError("Update download failed.");
          setUpdateBusy(false);
          return;
        }
        if (downloadResult.ok === false) {
          setUpdateError(downloadResult.message || "Update download failed.");
          setUpdateBusy(false);
          return;
        }
        setUpdateInfo(downloadResult);
      }
      const installResult = await Promise.resolve(bridge.updateInstall?.());
      if (!installResult) {
        setUpdateError("Update install failed.");
        setUpdateBusy(false);
        return;
      }
      if (installResult.ok === false) {
        setUpdateError(installResult.message || "Update install failed.");
        setUpdateBusy(false);
      }
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Update failed.");
      setUpdateBusy(false);
    }
  };

  if (!isOverlay) return null;
  const updateVersionText =
    updateInfo && "version" in updateInfo && updateInfo.version
      ? `v${updateInfo.version}`
      : "a new version";

  return (
    <>
      <div className="pointer-events-auto fixed right-4 top-4 z-[70] flex items-center gap-2">
        <button
          type="button"
          onClick={handleCheckUpdates}
          disabled={checkingUpdates || updateBusy}
          className="flex h-8 items-center justify-center gap-2 rounded-sm border border-white/10 bg-ink/60 px-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-60"
          aria-label="Check for updates"
        >
          {checkingUpdates ? "Checking…" : "Updates"}
        </button>
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

      {toast && (
        <div className="pointer-events-none fixed right-4 top-14 z-[70] rounded-sm border border-white/10 bg-ink/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-sand/80">
          <span className={toast.tone === "error" ? "text-red-200" : ""}>
            {toast.message}
          </span>
        </div>
      )}

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

      {showUpdateDialog && updateInfo && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 px-4">
          <div className="w-full max-w-md rounded-md border border-white/10 bg-ink/95 p-6 text-sand shadow-2xl">
            <h2 className="text-lg font-semibold text-sand">Update available</h2>
            <p className="mt-2 text-sm text-sand/70">
              HMCC Overlay {updateVersionText} is available.
            </p>
            <p className="mt-3 text-sm text-sand/70">
              {lobbyState.status === "host" &&
                "Updating will close the lobby you’re hosting and remove you from any lobby."}
              {lobbyState.status === "member" &&
                "Updating will leave your current lobby."}
              {lobbyState.status === "none" &&
                "Install update and restart HMCC Overlay?"}
              {lobbyState.status === "loading" && "Checking lobby status..."}
            </p>
            {updateError && (
              <p className="mt-3 text-xs font-semibold text-red-200">
                {updateError}
              </p>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUpdateDialog(false)}
                disabled={updateBusy}
                className="rounded-sm border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-sand/70 transition hover:border-white/40 hover:text-sand disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUpdate}
                disabled={updateBusy || lobbyState.status === "loading"}
                className="rounded-sm border border-clay/60 bg-clay/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:border-clay hover:bg-clay/40 disabled:opacity-60"
              >
                {updateBusy ? "Updating..." : "Update & Restart"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
