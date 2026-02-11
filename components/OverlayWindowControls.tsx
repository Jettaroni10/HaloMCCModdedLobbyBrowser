"use client";

import { useEffect, useState } from "react";
import OverlayHeaderControls from "@/components/OverlayHeaderControls";
import OverlayModal from "@/components/OverlayModal";
import OverlayUpdateModal from "@/components/OverlayUpdateModal";
import { OverlayThemeClasses } from "@/components/OverlayThemeClasses";

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
    if (typeof window === "undefined") return;
    const candidate = (window as { hmccOverlay?: OverlayBridge }).hmccOverlay;
    if (candidate) setBridge(candidate);
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
    setTimeout(() => setToast(null), 2500);
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
      await fetch("/api/presence/shutdown", { method: "POST" }).catch(() => {});
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
      await fetch("/api/presence/shutdown", { method: "POST" }).catch(() => {});
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
      <OverlayHeaderControls
        checkingUpdates={checkingUpdates}
        updateBusy={updateBusy}
        onCheckUpdates={handleCheckUpdates}
        onMinimize={() => bridge?.hideOverlayWindow?.()}
        onClose={handleOpenDialog}
      />

      {toast && (
        <div
          className={`pointer-events-none fixed right-4 top-14 z-[70] rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] ${OverlayThemeClasses.toast}`}
        >
          <span className={toast.tone === "error" ? "text-clay" : ""}>
            {toast.message}
          </span>
        </div>
      )}

      <OverlayModal
        open={showDialog}
        title="Close HMCC Overlay?"
        onClose={() => setShowDialog(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowDialog(false)}
              disabled={busy}
              className={`rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition disabled:opacity-60 ${OverlayThemeClasses.buttonGhost} ${OverlayThemeClasses.focusRing}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClose}
              disabled={busy || lobbyState.status === "loading"}
              className={`rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition disabled:opacity-60 ${OverlayThemeClasses.buttonDanger} ${OverlayThemeClasses.focusRing}`}
            >
              {busy ? "Closing..." : "Close Overlay"}
            </button>
          </>
        }
      >
        {lobbyState.status === "host" &&
          "Closing will close the lobby you are hosting and remove you from any lobby."}
        {lobbyState.status === "member" &&
          "Closing will leave your current lobby."}
        {lobbyState.status === "none" &&
          "Closing will quit the overlay app."}
        {lobbyState.status === "loading" && "Checking lobby status..."}
      </OverlayModal>

      <OverlayUpdateModal
        open={showUpdateDialog && Boolean(updateInfo)}
        updateInfo={updateInfo}
        updateVersionText={updateVersionText}
        lobbyState={lobbyState}
        updateError={updateError}
        updateBusy={updateBusy}
        onCancel={() => setShowUpdateDialog(false)}
        onConfirm={handleConfirmUpdate}
      />
    </>
  );
}
