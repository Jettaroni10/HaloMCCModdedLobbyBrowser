"use client";

import { useMemo } from "react";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import TagsInput from "./TagsInput";

type HostLobbyFormProps = {
  defaultValues?: {
    title?: string;
    game?: string;
    mode?: string;
    map?: string;
    region?: string;
    voice?: string;
    vibe?: string;
    tags?: string[];
    rulesNote?: string;
    slotsTotal?: number | null;
    friendsOnly?: boolean;
    workshopCollectionUrl?: string;
    workshopItemUrls?: string[];
    requiresEacOff?: boolean;
    modNotes?: string | null;
  };
  submitLabel?: string;
  action?: string;
  method?: "post" | "get";
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

export default function HostLobbyForm({
  defaultValues,
  submitLabel = "Publish lobby",
  action = "/api/lobbies",
  method = "post",
  onSubmit,
}: HostLobbyFormProps) {
  const defaultTags = useMemo(() => defaultValues?.tags ?? [], [defaultValues]);

  return (
    <form
      action={action}
      method={method}
      onSubmit={onSubmit}
      className="mt-6 space-y-5 rounded-md border border-ink/10 bg-sand p-6"
    >
      <label className="block text-sm font-semibold text-ink">
        Title
        <input
          name="title"
          required
          defaultValue={defaultValues?.title ?? ""}
          className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Mode
          <input
            name="mode"
            required
            defaultValue={defaultValues?.mode ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Map
          <input
            name="map"
            required
            defaultValue={defaultValues?.map ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm font-semibold text-ink">
          Game
          <select
            name="game"
            defaultValue={defaultValues?.game ?? Games[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Games.map((game) => (
              <option key={game} value={game}>
                {game}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Region
          <select
            name="region"
            defaultValue={defaultValues?.region ?? Regions[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Voice
          <select
            name="voice"
            defaultValue={defaultValues?.voice ?? Voices[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Voices.map((voice) => (
              <option key={voice} value={voice}>
                {voice.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Vibe
          <select
            name="vibe"
            defaultValue={defaultValues?.vibe ?? Vibes[0]}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            {Vibes.map((vibe) => (
              <option key={vibe} value={vibe}>
                {vibe.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold text-ink">
        Tags
        <TagsInput name="tags" defaultTags={defaultTags} />
      </label>

      <label className="block text-sm font-semibold text-ink">
        Rules note
        <textarea
          name="rulesNote"
          required
          rows={3}
          defaultValue={defaultValues?.rulesNote ?? ""}
          className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Slots total
          <input
            name="slotsTotal"
            type="number"
            min={2}
            max={32}
            defaultValue={defaultValues?.slotsTotal ?? 16}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold text-ink">
        <input
          name="friendsOnly"
          type="checkbox"
          defaultChecked={defaultValues?.friendsOnly ?? false}
          className="h-4 w-4 rounded border-ink/20"
        />
        Friends only
      </label>

      <div className="rounded-sm border border-ink/10 bg-mist p-4">
        <label className="block text-sm font-semibold text-ink">
          Workshop collection URL (required)
          <input
            name="workshopCollectionUrl"
            required
            defaultValue={defaultValues?.workshopCollectionUrl ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-sand px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          Workshop item URLs (optional)
          <textarea
            name="workshopItemUrls"
            rows={3}
            defaultValue={(defaultValues?.workshopItemUrls ?? []).join("\n")}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-sand px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-ink">
          <input
            name="requiresEacOff"
            type="checkbox"
            defaultChecked={defaultValues?.requiresEacOff ?? true}
            className="h-4 w-4 rounded border-ink/20"
          />
          Host indicates EAC Off may be required
        </label>
        <label className="mt-4 block text-sm font-semibold text-ink">
          Mod notes
          <textarea
            name="modNotes"
            rows={3}
            defaultValue={defaultValues?.modNotes ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-sand px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
      >
        {submitLabel}
      </button>
    </form>
  );
}

