"use client";

import { useEffect, useMemo, useState } from "react";

type ModEntry = {
  id: string;
  name: string;
  workshopUrl: string;
  isOptional?: boolean;
};

type ModPackSummary = {
  id: string;
  name: string;
  description?: string | null;
  mods: ModEntry[];
};

type LobbyRequestFormProps = {
  lobbyId: string;
  workshopCollectionUrl: string | null;
  workshopItemUrls: string[];
  modNotes: string | null;
  modPack?: ModPackSummary | null;
  isModded: boolean;
  rulesNote: string;
  tags: string[];
  userGamertag: string | null;
  isSignedIn: boolean;
};

export default function LobbyRequestForm({
  lobbyId,
  workshopCollectionUrl,
  workshopItemUrls,
  modNotes,
  modPack,
  isModded,
  rulesNote,
  tags,
  userGamertag,
  isSignedIn,
}: LobbyRequestFormProps) {
  const [subscribedMods, setSubscribedMods] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<{
    type: "PENDING_OTHER_LOBBY" | "IN_OTHER_LOBBY" | "HOSTING_OTHER_LOBBY";
    message: string;
    lobbies: { id: string; title: string }[];
  } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const resolvedGamertag = useMemo(
    () => (userGamertag ?? "").trim(),
    [userGamertag]
  );

  const mods = useMemo<ModEntry[]>(() => {
    if (!isModded) {
      return [];
    }
    if (modPack?.mods && modPack.mods.length > 0) {
      return modPack.mods;
    }
    const entries: ModEntry[] = [];
    if (workshopCollectionUrl) {
      entries.push({
        id: `collection:${workshopCollectionUrl}`,
        name: "Mod link",
        workshopUrl: workshopCollectionUrl,
        isOptional: false,
      });
    }
    workshopItemUrls.forEach((url, index) => {
      entries.push({
        id: `item:${url}`,
        name: `Mod link ${index + 1}`,
        workshopUrl: url,
        isOptional: false,
      });
    });
    return entries;
  }, [isModded, modPack, workshopCollectionUrl, workshopItemUrls]);

  const requiredModIds = useMemo(
    () => mods.filter((mod) => !mod.isOptional).map((mod) => mod.id),
    [mods]
  );

  useEffect(() => {
    setSubscribedMods({});
  }, [isModded, modPack?.id, workshopCollectionUrl, workshopItemUrls.join("|")]);

  const readinessOk =
    !isModded ||
    requiredModIds.length === 0 ||
    requiredModIds.every((id) => subscribedMods[id]);

  async function submitRequest(options?: {
    confirmCancelPending?: boolean;
    confirmLeaveOther?: boolean;
  }) {
    setError("");
    setInfo(null);
    setConflict(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterPlatform: "STEAM",
          requesterHandleText: resolvedGamertag,
          confirmedSubscribed: readinessOk,
          confirmCancelPending: options?.confirmCancelPending ?? false,
          confirmLeaveOther: options?.confirmLeaveOther ?? false,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              code?: string;
              pendingLobbies?: { id: string; title: string }[];
              lobby?: { id: string; title: string };
            }
          | null;
        if (payload?.code === "PENDING_OTHER_LOBBY") {
          setConflict({
            type: "PENDING_OTHER_LOBBY",
            message:
              payload.error ??
              "You already have a pending invite request in another lobby.",
            lobbies: payload.pendingLobbies ?? [],
          });
          return;
        }
        if (payload?.code === "IN_OTHER_LOBBY") {
          setConflict({
            type: "IN_OTHER_LOBBY",
            message:
              payload.error ??
              "You are already in another lobby. Leave it to continue.",
            lobbies: payload.lobby ? [payload.lobby] : [],
          });
          return;
        }
        if (payload?.code === "HOSTING_OTHER_LOBBY") {
          setConflict({
            type: "HOSTING_OTHER_LOBBY",
            message:
              payload.error ??
              "You are hosting another lobby. Close it to continue.",
            lobbies: payload.lobby ? [payload.lobby] : [],
          });
          return;
        }
        throw new Error(payload?.error || "Request failed.");
      }

      if (options?.confirmCancelPending) {
        setInfo("Previous pending invite request canceled.");
      }
      if (options?.confirmLeaveOther) {
        setInfo("You have left the previous lobby.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitRequest();
  }

  if (success) {
    return (
      <div className="rounded-sm border border-ink/10 bg-mist p-6 text-sm text-ink/70">
        <h3 className="text-lg font-semibold text-ink">
          Request sent successfully
        </h3>
        <p className="mt-2">
          Wait for the host to invite you.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-sm border border-ink/10 bg-sand p-6">
        <h2 className="text-lg font-semibold text-ink">Lobby details</h2>
        <p className="mt-2 text-sm text-ink/70">{rulesNote}</p>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-ink/10 px-3 py-1 text-xs font-semibold text-ink"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {isModded && (
          <div className="mt-6 rounded-sm border border-ink/10 bg-mist p-4 text-sm text-ink/70">
            <h3 className="text-sm font-semibold text-ink">Get Ready</h3>
            <p className="mt-1 text-xs text-ink/60">
              {modPack?.name
                ? `${modPack.name} · ${requiredModIds.length} required mods`
                : `${requiredModIds.length} required mods`}
            </p>
            {mods.length > 0 ? (
              <div className="mt-3 space-y-2">
                {mods.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-ink/10 bg-sand px-3 py-2"
                  >
                    <label className="flex items-start gap-2 text-xs text-ink">
                      <input
                        type="checkbox"
                        checked={Boolean(subscribedMods[mod.id])}
                        onChange={(event) =>
                          setSubscribedMods((prev) => ({
                            ...prev,
                            [mod.id]: event.target.checked,
                          }))
                        }
                        className="mt-0.5 h-4 w-4 rounded border-ink/20"
                      />
                      <span className="leading-5">
                        <span className="block text-sm font-semibold text-ink">
                          {mod.name}
                        </span>
                        {mod.isOptional && (
                          <span className="text-[11px] text-ink/50">
                            Optional
                          </span>
                        )}
                      </span>
                    </label>
                    <a
                      href={mod.workshopUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-sm bg-ink px-3 py-1 text-xs font-semibold text-sand hover:bg-ink/90"
                    >
                      Open link
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink/60">
                No mods listed for this lobby.
              </p>
            )}
            {modNotes && (
              <p className="mt-3 rounded-sm border border-ink/10 bg-mist px-3 py-2 text-xs text-ink/70">
                {modNotes}
              </p>
            )}
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(
                  "Open the mod links and install/enable the required mods before joining."
                )
              }
              className="mt-3 text-xs font-semibold text-ink underline decoration-ink/40 underline-offset-4"
            >
              Copy mod instructions
            </button>
          </div>
        )}
      </div>

      <div className="rounded-sm border border-ink/10 bg-sand p-6">
        <h2 className="text-lg font-semibold text-ink">Request invite</h2>
        <p className="mt-2 text-sm text-ink/70">
          Hosts send invites outside the app. We only track the request.
        </p>

        {!isSignedIn ? (
          <div className="mt-4 rounded-sm border border-ink/10 bg-mist p-4 text-sm text-ink/70">
            <p className="font-semibold text-ink">Sign in required</p>
            <p className="mt-2">
              You need an account to request an invite.
            </p>
            <a
              href="/login"
              className="mt-3 inline-flex rounded-sm bg-ink px-4 py-2 text-xs font-semibold text-sand"
            >
              Sign in
            </a>
          </div>
        ) : !resolvedGamertag ? (
          <div className="mt-4 rounded-sm border border-clay/40 bg-mist p-4 text-sm text-ink/70">
            <p className="font-semibold text-ink">Gamertag required</p>
            <p className="mt-2">
              Set your gamertag in profile settings to request an invite.
            </p>
            <a
              href="/settings/profile?needsGamertag=1"
              className="mt-3 inline-flex rounded-sm bg-ink px-4 py-2 text-xs font-semibold text-sand"
            >
              Update profile
            </a>
          </div>
        ) : (
          <>
        {conflict && (
          <div className="mt-4 rounded-sm border border-clay/40 bg-mist px-4 py-3 text-xs text-ink/70">
            <p className="text-sm font-semibold text-ink">
              Action required
            </p>
            <p className="mt-2">{conflict.message}</p>
            {conflict.lobbies.length > 0 && (
              <ul className="mt-2 space-y-1">
                {conflict.lobbies.map((item) => (
                  <li key={item.id} className="text-xs text-ink/70">
                    • {item.title}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {conflict.type === "PENDING_OTHER_LOBBY" && (
                <button
                  type="button"
                  onClick={() => submitRequest({ confirmCancelPending: true })}
                  disabled={loading}
                  className="rounded-sm bg-ink px-3 py-1 text-xs font-semibold text-sand disabled:opacity-60"
                >
                  Cancel pending request &amp; continue
                </button>
              )}
              {(conflict.type === "IN_OTHER_LOBBY" ||
                conflict.type === "HOSTING_OTHER_LOBBY") && (
                <button
                  type="button"
                  onClick={() => submitRequest({ confirmLeaveOther: true })}
                  disabled={loading}
                  className="rounded-sm bg-ink px-3 py-1 text-xs font-semibold text-sand disabled:opacity-60"
                >
                  Leave other lobby &amp; continue
                </button>
              )}
              <button
                type="button"
                onClick={() => setConflict(null)}
                className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {info && (
          <p className="mt-3 text-xs font-semibold text-ink/70">{info}</p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold text-ink">
            Gamertag
            <input
              name="requesterHandleText"
              value={resolvedGamertag}
              readOnly
              className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink/80"
            />
          </label>
          <p className="text-xs text-ink/60">
            By requesting, you consent to the host contacting you via a
            platform invite.
          </p>
          {error && <p className="text-xs text-clay">{error}</p>}
          <button
            type="submit"
            disabled={!readinessOk || loading || !resolvedGamertag}
            className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand disabled:cursor-not-allowed disabled:bg-ink/40"
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

