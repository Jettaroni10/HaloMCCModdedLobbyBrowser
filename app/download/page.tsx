"use client";

import { useEffect, useMemo, useState } from "react";

type LatestDownload = {
  version: string;
  publishedAt: string;
  file: string;
  sha256: string;
  notes: string;
  checksumFile: string | null;
  source: "github" | "local";
};

type HealthState = {
  metadata: boolean;
  installer: boolean;
  checksum: boolean;
};

type GitHubAsset = {
  name?: string;
  browser_download_url?: string;
};

type GitHubRelease = {
  tag_name?: string;
  body?: string;
  published_at?: string;
  assets?: GitHubAsset[];
};

const LOCAL_LATEST_URL = "/downloads/latest.json";
const GITHUB_LATEST_URL =
  "https://api.github.com/repos/Jettaroni10/HaloMCCModdedLobbyBrowser/releases/latest";
const FALLBACK_FILE = "/downloads/HMCC-Overlay-Setup.exe";

function isValidLocalLatest(input: unknown): input is {
  version: string;
  publishedAt: string;
  file: string;
  sha256: string;
  notes: string;
} {
  if (!input || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort().join(",");
  if (keys !== "file,notes,publishedAt,sha256,version") return false;
  return (
    typeof record.version === "string" &&
    typeof record.publishedAt === "string" &&
    typeof record.file === "string" &&
    typeof record.sha256 === "string" &&
    typeof record.notes === "string"
  );
}

function normalizeLocalLatest(input: {
  version: string;
  publishedAt: string;
  file: string;
  sha256: string;
  notes: string;
}): LatestDownload {
  return {
    version: input.version,
    publishedAt: input.publishedAt,
    file: input.file,
    sha256: input.sha256,
    notes: input.notes,
    checksumFile: `${input.file}.sha256`,
    source: "local",
  };
}

function normalizeGitHubRelease(input: unknown): LatestDownload | null {
  if (!input || typeof input !== "object") return null;
  const release = input as GitHubRelease;
  if (!Array.isArray(release.assets)) return null;

  const exeAsset = release.assets.find((asset) =>
    String(asset.name || "").toLowerCase().endsWith(".exe")
  );
  if (!exeAsset?.browser_download_url) return null;

  const checksumAsset = release.assets.find((asset) =>
    String(asset.name || "").toLowerCase().endsWith(".exe.sha256")
  );

  const rawTag = String(release.tag_name || "").trim();
  const version = rawTag.replace(/^v/i, "") || "Unknown";
  const notes = String(release.body || "").trim();

  return {
    version,
    publishedAt: String(release.published_at || ""),
    file: exeAsset.browser_download_url,
    sha256: "",
    notes: notes || "No release notes provided.",
    checksumFile: checksumAsset?.browser_download_url || null,
    source: "github",
  };
}

async function checkReachable(url: string | null): Promise<boolean> {
  if (!url) return false;
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
    const get = await fetch(url, { method: "GET", cache: "no-store" });
    return get.ok;
  } catch {
    return false;
  }
}

export default function DownloadPage() {
  const [latest, setLatest] = useState<LatestDownload | null>(null);
  const [health, setHealth] = useState<HealthState>({
    metadata: false,
    installer: false,
    checksum: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let parsedLatest: LatestDownload | null = null;
      let metadataUrl = GITHUB_LATEST_URL;

      try {
        const githubResponse = await fetch(GITHUB_LATEST_URL, {
          cache: "no-store",
          headers: {
            Accept: "application/vnd.github+json",
          },
        });
        if (githubResponse.ok) {
          const githubJson = await githubResponse.json();
          parsedLatest = normalizeGitHubRelease(githubJson);
        }
      } catch {
        parsedLatest = null;
      }

      if (!parsedLatest) {
        metadataUrl = LOCAL_LATEST_URL;
        try {
          const localResponse = await fetch(LOCAL_LATEST_URL, {
            cache: "no-store",
          });
          if (localResponse.ok) {
            const localJson = await localResponse.json();
            if (isValidLocalLatest(localJson)) {
              parsedLatest = normalizeLocalLatest(localJson);
            }
          }
        } catch {
          parsedLatest = null;
        }
      }

      const installerUrl = parsedLatest?.file || FALLBACK_FILE;
      const checksumUrl = parsedLatest?.checksumFile || null;
      const [metadataOk, installerOk, checksumOk] = await Promise.all([
        checkReachable(metadataUrl),
        checkReachable(installerUrl),
        checkReachable(checksumUrl),
      ]);

      if (cancelled) return;
      setLatest(parsedLatest);
      setHealth({
        metadata: metadataOk,
        installer: installerOk,
        checksum: checksumOk,
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const publishedLabel = useMemo(() => {
    if (!latest?.publishedAt) return "Unknown";
    const date = new Date(latest.publishedAt);
    if (Number.isNaN(date.getTime())) return latest.publishedAt;
    return date.toLocaleDateString();
  }, [latest?.publishedAt]);

  const installerHref = latest?.file || FALLBACK_FILE;
  const checksumHref = latest?.checksumFile || null;
  const sourceLabel =
    latest?.source === "github"
      ? "GitHub Releases"
      : latest?.source === "local"
      ? "Local metadata fallback"
      : "No source";

  function statusDot(ok: boolean) {
    return ok ? "bg-emerald-400" : "bg-rose-500";
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <div className="border border-slate-700/70 bg-slate-950/70 p-6 shadow-[0_16px_60px_rgba(5,10,18,0.5)]">
        <h1 className="text-2xl tracking-[0.2em] text-slate-100">
          Download HMCC Overlay
        </h1>
        <p className="mt-2 text-xs tracking-[0.12em] text-slate-300">
          Windows installer for the Halo MCC overlay.
        </p>

        {latest ? (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs tracking-[0.12em]">
              <a
                href={installerHref}
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
            <p className="mt-2 text-xs tracking-[0.12em] text-slate-400">
              Source: {sourceLabel}
            </p>
            <a
              href={installerHref}
              className="mt-3 inline-block text-xs tracking-[0.12em] text-sky-300 underline underline-offset-2"
            >
              Direct download
            </a>

            <div className="mt-6 border border-slate-800 bg-black/30 p-4">
              <h2 className="text-sm tracking-[0.14em] text-slate-200">
                Checksum (SHA256)
              </h2>
              {latest.sha256 ? (
                <code className="mt-2 block break-all text-xs tracking-[0.08em] text-slate-300">
                  {latest.sha256}
                </code>
              ) : (
                <p className="mt-2 text-xs tracking-[0.1em] text-slate-400">
                  SHA256 not provided by release metadata.
                </p>
              )}
              {checksumHref && (
                <a
                  href={checksumHref}
                  className="mt-2 inline-block text-xs tracking-[0.12em] text-sky-300 underline underline-offset-2"
                >
                  Download .sha256 file
                </a>
              )}
            </div>

            <div className="mt-6 border border-slate-800 bg-black/30 p-4">
              <h2 className="text-sm tracking-[0.14em] text-slate-200">
                Release Notes
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-xs tracking-[0.1em] text-slate-300">
                {latest.notes}
              </p>
            </div>
          </>
        ) : (
          <div className="mt-6 border border-rose-700/70 bg-rose-950/30 p-4 text-xs tracking-[0.1em] text-rose-200">
            {loading ? "Loading release metadata..." : "No release posted yet."}
          </div>
        )}

        <div className="mt-8 border border-slate-800 bg-black/30 p-4">
          <h2 className="text-sm tracking-[0.14em] text-slate-200">
            Install Instructions
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs tracking-[0.1em] text-slate-300">
            <li>Download and run Setup.exe.</li>
            <li>Windows SmartScreen warning is expected (no code signing yet).</li>
            <li>Launch HMCC Overlay from Start Menu after install.</li>
            <li>Press Insert to toggle overlay visibility.</li>
            <li>Overlay appears only when Halo MCC is the focused window.</li>
          </ol>
        </div>

        <div className="mt-6 border border-slate-800 bg-black/30 p-4">
          <h2 className="text-sm tracking-[0.14em] text-slate-200">
            Download Health
          </h2>
          <div className="mt-3 space-y-2 text-xs tracking-[0.1em] text-slate-300">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDot(health.metadata)}`} />
              <span>release metadata reachable</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDot(health.installer)}`} />
              <span>installer reachable</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDot(health.checksum)}`} />
              <span>sha256 reachable</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

