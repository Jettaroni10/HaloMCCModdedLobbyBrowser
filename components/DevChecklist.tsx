"use client";

import { useEffect, useState } from "react";

type ChecklistItem = {
  id: string;
  label: string;
  hint?: string;
};

const ITEMS: ChecklistItem[] = [
  {
    id: "lobby-create",
    label: "Lobby create → appears in browse immediately",
    hint: "Create a lobby and confirm it shows on /.",
  },
  {
    id: "lobby-expire",
    label: "No heartbeat → lobby disappears after expiry window",
    hint: "Wait 30 minutes or set expiresAt in DB to confirm.",
  },
  {
    id: "lobby-heartbeat",
    label: "Heartbeat extends expiry",
    hint: "Use the Heartbeat button on /host.",
  },
  {
    id: "rate-limit",
    label: "Request invite rate limits trigger correctly",
    hint: "Submit 6 requests in a minute and check 429.",
  },
  {
    id: "sse",
    label: "Host sees request appear live on dashboard via SSE",
    hint: "Open /host in one tab, submit request in another.",
  },
  {
    id: "accept-checklist",
    label: "Host accept sets status and shows checklist modal",
    hint: "Accept a pending request and ensure modal appears.",
  },
  {
    id: "block",
    label: "Host block prevents future requests",
    hint: "Block a requester, then attempt another request.",
  },
  {
    id: "modded-gate",
    label: "Modded lobby enforces readiness gates before request",
    hint: "Create modded lobby and ensure checkboxes gate submit.",
  },
  {
    id: "reports",
    label: "Reports create + appear in admin",
    hint: "Report a lobby/user and confirm in /admin.",
  },
  {
    id: "banned",
    label: "Banned user cannot create lobbies or request invites",
    hint: "Ban a user and retry API actions.",
  },
];

const STORAGE_KEY = "mcc_dev_checklist";

export default function DevChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setChecked(JSON.parse(stored));
      } catch {
        setChecked({});
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-ink/10 bg-mist p-4 text-sm text-ink/70">
        <p className="font-semibold text-ink">Dev-only checklist</p>
        <p className="mt-1">
          This page is only visible in development. Use it to validate MVP
          behavior before release.
        </p>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-sand p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-ink/60">
          Quick links
        </h2>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a className="text-ink underline" href="/">
            Browse
          </a>
          <a className="text-ink underline" href="/host">
            Host dashboard
          </a>
          <a className="text-ink underline" href="/host/new">
            Create lobby
          </a>
          <a className="text-ink underline" href="/admin">
            Admin
          </a>
        </div>
      </section>

      <section className="space-y-3">
        {ITEMS.map((item) => (
          <label
            key={item.id}
            className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-sand p-4 text-sm text-ink/70"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={() => toggle(item.id)}
                className="mt-1 h-4 w-4 rounded border-ink/20"
              />
              <span className="font-semibold text-ink">{item.label}</span>
            </div>
            {item.hint && <span className="text-xs">{item.hint}</span>}
          </label>
        ))}
      </section>
    </div>
  );
}
