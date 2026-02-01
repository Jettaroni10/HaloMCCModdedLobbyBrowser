const perfEnabled =
  process.env.PERF_LOGS === "1" || process.env.NODE_ENV !== "production";

export function logPerf(label: string, startMs: number, meta?: unknown) {
  if (!perfEnabled) return;
  const durationMs = Date.now() - startMs;
  if (meta) {
    console.info(`[perf] ${label} ${durationMs}ms`, meta);
    return;
  }
  console.info(`[perf] ${label} ${durationMs}ms`);
}
