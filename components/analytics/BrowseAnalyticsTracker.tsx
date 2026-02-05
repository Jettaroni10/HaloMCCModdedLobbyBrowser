"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

type Filters = {
  game?: string | null;
  region?: string | null;
  voice?: string | null;
  vibe?: string | null;
  tags?: string | null;
  sort?: string | null;
};

function readParam(params: URLSearchParams | null, key: string) {
  const value = params?.get(key);
  return value && value.trim().length > 0 ? value : null;
}

export default function BrowseAnalyticsTracker() {
  const searchParams = useSearchParams();
  const prevRef = useRef<Filters | null>(null);

  const filters = useMemo<Filters>(() => {
    return {
      game: readParam(searchParams, "game"),
      region: readParam(searchParams, "region"),
      voice: readParam(searchParams, "voice"),
      vibe: readParam(searchParams, "vibe"),
      tags: readParam(searchParams, "tags"),
      sort: readParam(searchParams, "sort"),
    };
  }, [searchParams]);

  useEffect(() => {
    if (!prevRef.current) {
      trackEvent("browse_opened");
      prevRef.current = filters;
      return;
    }

    const prev = prevRef.current;
    (["game", "region", "voice", "vibe", "tags"] as const).forEach((key) => {
      if (prev[key] !== filters[key]) {
        trackEvent("browse_filter_changed", {
          filter_type: key,
          filter_value: filters[key] ?? "",
        });
      }
    });

    if (prev.sort !== filters.sort) {
      trackEvent("browse_sort_changed", {
        sort_type: filters.sort ?? "",
      });
    }

    prevRef.current = filters;
  }, [filters]);

  return null;
}
