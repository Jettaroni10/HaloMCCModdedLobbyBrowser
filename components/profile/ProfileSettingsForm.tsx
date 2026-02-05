"use client";

import { useEffect, useMemo, useState } from "react";
import FavoriteWeaponSelect from "@/components/FavoriteWeaponSelect";
import { HALO_GAMES } from "@/data/haloGames";
import {
  ReachColors,
  type ReachColorHex,
  nameplateTextColor,
  resolveNametagColor,
} from "@/lib/reach-colors";
import { trackEvent } from "@/lib/analytics";

type ProfileSettingsFormProps = {
  needsGamertag: boolean;
  initialGamertag: string;
  initialEmail: string;
  initialFavoriteGameId: string;
  initialFavoriteWeaponId: string;
  initialNametagColor: string;
};

export default function ProfileSettingsForm({
  needsGamertag,
  initialGamertag,
  initialEmail,
  initialFavoriteGameId,
  initialFavoriteWeaponId,
  initialNametagColor,
}: ProfileSettingsFormProps) {
  const initial = useMemo(
    () => ({
      gamertag: initialGamertag,
      email: initialEmail,
      favoriteGameId: initialFavoriteGameId,
      favoriteWeaponId: initialFavoriteWeaponId,
      nametagColor: resolveNametagColor(initialNametagColor),
    }),
    [
      initialGamertag,
      initialEmail,
      initialFavoriteGameId,
      initialFavoriteWeaponId,
      initialNametagColor,
    ]
  );

  const [gamertag, setGamertag] = useState(initial.gamertag);
  const [email, setEmail] = useState(initial.email);
  const [favoriteGameId, setFavoriteGameId] = useState(initial.favoriteGameId);
  const [favoriteWeaponId, setFavoriteWeaponId] = useState(
    initial.favoriteWeaponId
  );
  const [nametagColor, setNametagColor] = useState<ReachColorHex>(
    initial.nametagColor
  );
  const [resetKey, setResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setGamertag(initial.gamertag);
    setEmail(initial.email);
    setFavoriteGameId(initial.favoriteGameId);
    setFavoriteWeaponId(initial.favoriteWeaponId);
    setNametagColor(initial.nametagColor);
    setResetKey((prev) => prev + 1);
  }, [initial]);

  useEffect(() => {
    trackEvent("profile_viewed", { section: "identity" });
  }, []);

  const isDirty =
    gamertag !== initial.gamertag ||
    email !== initial.email ||
    favoriteGameId !== initial.favoriteGameId ||
    favoriteWeaponId !== initial.favoriteWeaponId ||
    nametagColor !== initial.nametagColor;

  const selectedColor = resolveNametagColor(nametagColor);

  const handleCancel = () => {
    setGamertag(initial.gamertag);
    setEmail(initial.email);
    setFavoriteGameId(initial.favoriteGameId);
    setFavoriteWeaponId(initial.favoriteWeaponId);
    setNametagColor(initial.nametagColor);
    setResetKey((prev) => prev + 1);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSubmitError(null);

    const identityChanged =
      gamertag !== initial.gamertag ||
      email !== initial.email ||
      nametagColor !== initial.nametagColor;
    const preferencesChanged =
      favoriteGameId !== initial.favoriteGameId ||
      favoriteWeaponId !== initial.favoriteWeaponId;
    const section =
      preferencesChanged && !identityChanged ? "preferences" : "identity";

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gamertag,
          email,
          favoriteGameId,
          favoriteWeaponId,
          nametagColor,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setSubmitError(payload?.error ?? "Unable to update profile.");
        trackEvent("profile_updated", { section, success: false });
        return;
      }
      trackEvent("profile_updated", { section, success: true });
      window.location.href = "/settings/profile";
    } catch {
      setSubmitError("Unable to update profile.");
      trackEvent("profile_updated", { section, success: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-ink/10 bg-sand/80 p-4 sm:p-5 backdrop-blur"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">Settings</h2>
          <p className="mt-1 text-sm text-ink/60">
            Update your account details and preferences.
          </p>
        </div>

        {needsGamertag && (
          <div className="rounded-sm border border-clay/40 bg-mist px-4 py-3 text-sm text-clay">
            Gamertag required. Please set your gamertag to continue.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
              Account
            </p>
            <label className="block text-sm font-semibold text-ink">
              Gamertag
              <input
                name="gamertag"
                value={gamertag}
                onChange={(event) => setGamertag(event.target.value)}
                placeholder="Your gamertag"
                required
                className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40"
              />
            </label>
            <label className="block text-sm font-semibold text-ink">
              Email
              <input
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40"
              />
            </label>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
              Preferences
            </p>
            <label className="block text-sm font-semibold text-ink">
              Favorite game
              <select
                name="favoriteGameId"
                value={favoriteGameId}
                onChange={(event) => setFavoriteGameId(event.target.value)}
                className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40"
              >
                <option value="">Not set</option>
                {HALO_GAMES.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink">
              Favorite weapon
              <div className="mt-2">
                <FavoriteWeaponSelect
                  key={resetKey}
                  name="favoriteWeaponId"
                  defaultValue={favoriteWeaponId}
                  onValueChange={setFavoriteWeaponId}
                />
              </div>
            </label>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-sm border border-ink/10 bg-mist px-4 py-3 text-sm text-ink/70">
              <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                Nameplate preview
              </p>
              <div className="mt-3 inline-flex items-center gap-3">
                <span
                  className="rounded-sm px-3 py-1 text-sm font-semibold"
                  style={{
                    backgroundColor: selectedColor,
                    color: nameplateTextColor(selectedColor),
                  }}
                >
                  {gamertag || "Your gamertag"}
                </span>
                <span className="text-[10px] text-ink/60">
                  Current nametag color
                </span>
              </div>
            </div>

            <div className="rounded-sm border border-ink/10 bg-mist px-4 py-3">
              <p className="text-sm font-semibold text-ink">Nametag color</p>
              <p className="mt-1 text-xs text-ink/60">
                Choose a classic multiplayer color for your name.
              </p>
              <details className="mt-4 rounded-sm border border-ink/10 bg-sand px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
                  Change color
                </summary>
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {ReachColors.map((color) => (
                    <label
                      key={color.name}
                      className="flex flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-ink/60"
                      title={color.name}
                    >
                      <input
                        type="radio"
                        name="nametagColor"
                        value={color.hex}
                        checked={nametagColor === color.hex}
                        onChange={() => setNametagColor(color.hex)}
                        className="peer sr-only"
                      />
                      <span
                        className="h-10 w-10 rounded-sm border border-ink/20 shadow-sm peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-checked:ring-offset-sand"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-[9px] text-ink/70">
                        {color.name}
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 border-t border-ink/10 bg-sand/95 px-4 py-3 sm:-mx-5 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center rounded-sm border border-ink/20 bg-mist px-4 py-2 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isDirty || saving}
              className="inline-flex items-center justify-center rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
          {submitError && (
            <p className="mt-2 text-xs font-semibold text-clay">
              {submitError}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
