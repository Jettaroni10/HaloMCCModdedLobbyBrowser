"use client";

import OverlayModal from "@/components/OverlayModal";

type LobbyState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "member"; lobbyId: string }
  | { status: "host"; lobbyId: string };

type UpdateInfo =
  | { ok: true; status: "update-available" | "downloaded"; version?: string | null }
  | { ok: true; status: "downloading"; progress?: number | null }
  | { ok: true; status: "no-update" }
  | { ok: false; code?: string; message?: string };

type OverlayUpdateModalProps = {
  open: boolean;
  updateInfo: UpdateInfo | null;
  updateVersionText: string;
  lobbyState: LobbyState;
  updateError: string | null;
  updateBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function OverlayUpdateModal({
  open,
  updateInfo,
  updateVersionText,
  lobbyState,
  updateError,
  updateBusy,
  onCancel,
  onConfirm,
}: OverlayUpdateModalProps) {
  return (
    <OverlayModal
      open={open}
      title="Update available"
      onClose={onCancel}
      actions={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={updateBusy}
            className="rounded-sm border border-ink/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink/70 transition hover:border-ink/50 hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={updateBusy || lobbyState.status === "loading"}
            className="rounded-sm border border-clay/50 bg-clay/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink transition hover:border-clay/80 hover:bg-clay/35 disabled:opacity-60"
          >
            {updateBusy ? "Updating..." : "Update & Restart"}
          </button>
        </>
      }
    >
      <p>HMCC Overlay {updateVersionText} is available.</p>
      <p className="mt-3">
        {lobbyState.status === "host" &&
          "Updating will close the lobby you are hosting and remove you from any lobby."}
        {lobbyState.status === "member" &&
          "Updating will leave your current lobby."}
        {lobbyState.status === "none" &&
          "Install update and restart HMCC Overlay?"}
        {lobbyState.status === "loading" && "Checking lobby status..."}
      </p>
      {updateInfo?.status === "downloading" && (
        <p className="mt-3 text-xs text-ink/60">Downloading update...</p>
      )}
      {updateError && (
        <p className="mt-3 text-xs font-semibold text-clay">{updateError}</p>
      )}
    </OverlayModal>
  );
}
