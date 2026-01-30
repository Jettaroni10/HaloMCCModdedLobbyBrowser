"use client";

import { useEffect, useMemo, useState } from "react";

type LobbyRequestFormProps = {
  lobbyId: string;
  isModded: boolean;
  requiresEacOff: boolean;
  workshopCollectionUrl: string | null;
  workshopItemUrls: string[];
  modNotes: string | null;
  rulesNote: string;
  tags: string[];
  userSteamName: string | null;
  userXboxGamertag: string | null;
  isSignedIn: boolean;
};

export default function LobbyRequestForm({
  lobbyId,
  isModded,
  requiresEacOff,
  workshopCollectionUrl,
  workshopItemUrls,
  modNotes,
  rulesNote,
  tags,
  userSteamName,
  userXboxGamertag,
  isSignedIn,
}: LobbyRequestFormProps) {
  const [platform, setPlatform] = useState<"STEAM" | "XBOX_FUTURE">("STEAM");
  const [handleText, setHandleText] = useState("");
  const [note, setNote] = useState("");
  const [confirmedSubscribed, setConfirmedSubscribed] = useState(false);
  const [confirmedEacOff, setConfirmedEacOff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const defaultHandle = useMemo(() => {
    return platform === "STEAM"
      ? userSteamName ?? ""
      : userXboxGamertag ?? "";
  }, [platform, userSteamName, userXboxGamertag]);

  useEffect(() => {
    if (!handleText) {
      setHandleText(defaultHandle);
    }
  }, [defaultHandle, handleText]);

  const readinessOk = !isModded || (confirmedSubscribed && confirmedEacOff);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterPlatform: platform,
          requesterHandleText: handleText,
          note,
          confirmedSubscribed,
          confirmedEacOff,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Request failed.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-mist p-6 text-sm text-ink/70">
        <h3 className="text-lg font-semibold text-ink">
          Request sent successfully
        </h3>
        <p className="mt-2">
          Wait for the host to invite you via your selected platform.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-2xl border border-ink/10 bg-sand p-6">
        <h2 className="text-lg font-semibold text-ink">Lobby details</h2>
        <p className="mt-2 text-sm text-ink/70">{rulesNote}</p>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {isModded && (
          <div className="mt-6 rounded-2xl border border-ink/10 bg-mist p-4 text-sm text-ink/70">
            <h3 className="text-sm font-semibold text-ink">Required Mods</h3>
            {workshopCollectionUrl && (
              <a
                href={workshopCollectionUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand hover:bg-ink/90"
              >
                Open Workshop Collection
              </a>
            )}
            {workshopItemUrls.length > 0 && (
              <ul className="mt-3 space-y-2">
                {workshopItemUrls.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink underline decoration-ink/30 underline-offset-4 hover:text-ink/80"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {modNotes && (
              <p className="mt-3 rounded-xl border border-ink/10 bg-sand px-3 py-2 text-xs text-ink/70">
                {modNotes}
              </p>
            )}
            {requiresEacOff && (
              <p className="mt-3 text-xs font-semibold text-ink/70">
                Host indicates EAC Off may be required.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-ink/10 bg-sand p-6">
        <h2 className="text-lg font-semibold text-ink">Request invite</h2>
        <p className="mt-2 text-sm text-ink/70">
          Hosts send invites outside the app. We only track the request.
        </p>

        {!isSignedIn ? (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-mist p-4 text-sm text-ink/70">
            <p className="font-semibold text-ink">Sign in required</p>
            <p className="mt-2">
              You need an account to request an invite.
            </p>
            <a
              href="/login"
              className="mt-3 inline-flex rounded-full bg-ink px-4 py-2 text-xs font-semibold text-sand"
            >
              Sign in
            </a>
          </div>
        ) : (
          <>
        {isModded && (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-xs text-ink/70">
            <p className="text-sm font-semibold text-ink">
              Readiness checklist
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={confirmedSubscribed}
                onChange={(event) => setConfirmedSubscribed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink/20"
              />
              I&apos;ve subscribed to required mods
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={confirmedEacOff}
                onChange={(event) => setConfirmedEacOff(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink/20"
              />
              I understand EAC Off may be required
            </label>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold text-ink">
            Platform
            <select
              name="requesterPlatform"
              value={platform}
              onChange={(event) =>
                setPlatform(event.target.value as "STEAM" | "XBOX_FUTURE")
              }
              className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
            >
              <option value="STEAM">STEAM</option>
              <option value="XBOX_FUTURE">XBOX FUTURE</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink">
            Handle to invite
            <input
              name="requesterHandleText"
              value={handleText}
              onChange={(event) => setHandleText(event.target.value)}
              placeholder="Steam name or gamertag"
              className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Note (optional)
            <textarea
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 200))}
              rows={3}
              maxLength={200}
              placeholder="Availability, voice chat, or setup notes."
              className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-ink/50">
              {note.length}/200
            </span>
          </label>
          <p className="text-xs text-ink/60">
            By requesting, you consent to the host contacting you via a platform
            invite.
          </p>
          {error && <p className="text-xs text-clay">{error}</p>}
          <button
            type="submit"
            disabled={!readinessOk || loading}
            className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-sand disabled:cursor-not-allowed disabled:bg-ink/40"
          >
            {loading ? "Sending request..." : "Submit request"}
          </button>
        </form>
          </>
        )}
      </div>
    </div>
  );
}
