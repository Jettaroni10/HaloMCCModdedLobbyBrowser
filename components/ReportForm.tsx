"use client";

import { useState } from "react";

type ReportFormProps = {
  targetType: "USER" | "LOBBY" | "REQUEST";
  targetId: string;
  label: string;
  isSignedIn: boolean;
};

const CATEGORIES = ["SPAM", "HARASSMENT", "IMPERSONATION", "OTHER"] as const;

export default function ReportForm({
  targetType,
  targetId,
  label,
  isSignedIn,
}: ReportFormProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("SPAM");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    setStatus("idle");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, category, details }),
      });

      if (!response.ok) {
        throw new Error("Failed");
      }
      setStatus("sent");
      setDetails("");
      setOpen(false);
    } catch {
      setStatus("error");
    }
  }

  if (!isSignedIn) {
    return (
      <a
        href="/login"
        className="text-xs font-semibold text-ink/60 underline decoration-ink/30"
      >
        Sign in to report
      </a>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-xs font-semibold text-clay underline decoration-clay/40"
      >
        {label}
      </button>
      {open && (
        <form onSubmit={submitReport} className="mt-3 space-y-2 text-xs">
          <label className="block text-ink/70">
            Category
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as typeof category)
              }
              className="mt-1 w-full rounded-sm border border-ink/10 bg-mist px-2 py-1 text-sm"
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-ink/70">
            Details
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              required
              className="mt-1 w-full rounded-sm border border-ink/10 bg-mist px-2 py-1 text-sm"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-sm bg-ink px-3 py-1 text-xs font-semibold text-sand"
            >
              Submit report
            </button>
            {status === "error" && (
              <span className="text-xs text-clay">Try again.</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

