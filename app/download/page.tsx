import fs from "fs/promises";
import path from "path";
import type { Metadata } from "next";

type LatestDownload = {
  version: string;
  publishedAt: string;
  file: string;
  sha256: string;
  notes?: string[];
};

export const metadata: Metadata = {
  title: "Download Overlay | Customs on the Ring",
  description: "Download the HMCC Windows overlay installer.",
};

const FALLBACK: LatestDownload = {
  version: "0.1.0",
  publishedAt: "",
  file: "/downloads/HMCC-Overlay-Setup.exe",
  sha256: "",
  notes: [],
};

async function readLatest(): Promise<LatestDownload> {
  const latestPath = path.join(process.cwd(), "public", "downloads", "latest.json");
  try {
    const raw = await fs.readFile(latestPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LatestDownload>;
    return {
      version: parsed.version || FALLBACK.version,
      publishedAt: parsed.publishedAt || FALLBACK.publishedAt,
      file: parsed.file || FALLBACK.file,
      sha256: parsed.sha256 || FALLBACK.sha256,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return FALLBACK;
  }
}

export default async function DownloadPage() {
  const latest = await readLatest();
  const publishedLabel = latest.publishedAt
    ? new Date(latest.publishedAt).toLocaleString()
    : "Unknown";

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <div className="border border-slate-700/70 bg-slate-950/70 p-6 shadow-[0_16px_60px_rgba(5,10,18,0.5)]">
        <h1 className="text-2xl tracking-[0.2em] text-slate-100">Download HMCC Overlay</h1>
        <p className="mt-2 text-xs tracking-[0.12em] text-slate-300">
          Windows installer for the Halo MCC overlay.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs tracking-[0.12em]">
          <a
            href={latest.file}
            className="border border-sky-400 bg-sky-500/20 px-4 py-2 text-sky-100 transition hover:bg-sky-500/30"
          >
            Download HMCC Overlay (Windows)
          </a>
          <span className="border border-slate-700 px-3 py-2 text-slate-300">
            Version {latest.version}
          </span>
          <span className="border border-slate-700 px-3 py-2 text-slate-300">
            Published {publishedLabel}
          </span>
        </div>

        <div className="mt-8 border border-slate-800 bg-black/30 p-4">
          <h2 className="text-sm tracking-[0.14em] text-slate-200">Install Instructions</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs tracking-[0.1em] text-slate-300">
            <li>Download and run Setup.exe.</li>
            <li>Windows SmartScreen warning is expected (no code signing yet).</li>
            <li>Launch HMCC Overlay from Start Menu after install.</li>
            <li>Press Insert to toggle overlay visibility.</li>
            <li>Overlay appears only when Halo MCC is the focused window.</li>
          </ol>
        </div>

        <div className="mt-6 border border-slate-800 bg-black/30 p-4">
          <h2 className="text-sm tracking-[0.14em] text-slate-200">Checksum (SHA256)</h2>
          <code className="mt-2 block break-all text-xs tracking-[0.08em] text-slate-300">
            {latest.sha256 || "Not published"}
          </code>
        </div>

        <div className="mt-6 border border-slate-800 bg-black/30 p-4">
          <h2 className="text-sm tracking-[0.14em] text-slate-200">Release Notes</h2>
          {latest.notes && latest.notes.length > 0 ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-xs tracking-[0.1em] text-slate-300">
              {latest.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs tracking-[0.1em] text-slate-400">No notes published.</p>
          )}
        </div>
      </div>
    </section>
  );
}
