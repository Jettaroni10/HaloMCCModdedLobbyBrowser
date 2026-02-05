"use client";

/*
Audit (2026-02-05)
- GA4 is loaded via `components/analytics/AnalyticsLoader` using gtag.js.
- `components/analytics/AnalyticsTracker` only fires `page_view` with `page_path`.
- App Router navigation relies on manual tracking; no page titles/categories.
- No shared event taxonomy or custom events beyond page views.
*/

const CONSENT_KEY = "analytics_consent";

type AnalyticsPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function readConsent() {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === "denied") return false;
  } catch {
    // ignore
  }
  return true;
}

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function isAnalyticsEnabled() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!gaId) return false;
  const flag = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
  const explicitlyEnabled = flag === "true" || flag === "1";
  const explicitlyDisabled = flag === "false" || flag === "0";
  if (explicitlyDisabled) return false;
  if (isLocalhost() && !explicitlyEnabled) return false;
  return readConsent();
}

export function isAnalyticsDebug() {
  const flag = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG;
  return flag === "true" || flag === "1";
}

function sanitizePayload(payload?: AnalyticsPayload) {
  if (!payload) return undefined;
  const cleaned: AnalyticsPayload = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

export function trackEvent(name: string, payload?: AnalyticsPayload) {
  if (typeof window === "undefined") return;
  if (!isAnalyticsEnabled()) return;
  try {
    const cleaned = sanitizePayload(payload);
    window.gtag?.("event", name, cleaned);
    if (isAnalyticsDebug()) {
      // Debug only: log payloads to verify instrumentation locally.
      console.log("[analytics]", name, cleaned ?? {});
    }
  } catch {
    // Never throw from analytics.
  }
}

export function trackPageView(params: {
  page_path: string;
  page_title: string;
  page_category: string;
}) {
  trackEvent("page_view", params);
}

export function bucketDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds <= 10) return "0-10s";
  if (seconds <= 30) return "10-30s";
  if (seconds <= 120) return "30-120s";
  return "2m+";
}

export function hashId(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

export function getPageInfo(pathname: string) {
  const path = pathname.toLowerCase();
  if (path === "/") return { title: "Home", category: "home" };
  if (path.startsWith("/browse")) return { title: "Browse", category: "browse" };
  if (path.startsWith("/lobbies/"))
    return { title: "Lobby", category: "lobby" };
  if (path.startsWith("/host"))
    return { title: "Host Dashboard", category: "host" };
  if (path.startsWith("/friends"))
    return { title: "Friends", category: "social" };
  if (path.startsWith("/dm"))
    return { title: "Direct Messages", category: "dm" };
  if (path.startsWith("/users/"))
    return { title: "Profile", category: "profile" };
  if (path.startsWith("/settings/profile"))
    return { title: "Profile Settings", category: "profile" };
  if (
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/complete-profile")
  ) {
    return { title: "Authentication", category: "auth" };
  }
  if (path.startsWith("/admin")) return { title: "Admin", category: "admin" };
  if (path.startsWith("/legal")) return { title: "Legal", category: "legal" };
  if (path.startsWith("/dev")) return { title: "Dev", category: "dev" };
  return { title: "Page", category: "other" };
}

export function trackFeatureUsed(featureName: string, payload?: AnalyticsPayload) {
  trackEvent("feature_used", { feature_name: featureName, ...payload });
}
