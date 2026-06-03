"use client";

// ============================================================================
// useScoring — resolve the live scoring point values (from `scoring_config`).
//
// Lightweight companion to useSharedData: fetches only the one tiny config row,
// so display-only pages (rules, live, special tracker) can show the exact same
// numbers the scorers use without pulling every bettor's brackets.
//
// Returns the built-in SCORING constant immediately, then swaps in the
// DB-resolved values once loaded — so the UI never renders blank or NaN.
// ============================================================================

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SCORING, type ScoringValues } from "@/types";
import {
  scoringFromConfig,
  SCORING_CONFIG_COLUMNS,
  type ScoringConfigRow,
} from "@/lib/scoring/config";

// Module-level cache shared across hook instances within a page lifecycle.
let cache: { scoring?: ScoringValues; timestamp?: number } = {};
const CACHE_TTL = 60_000; // 60s

/**
 * Fetch + resolve the scoring config (used by useScoring and useSharedData).
 * Caches the resolved values for CACHE_TTL so repeated calls across hook
 * instances don't re-hit Supabase. Always resolves (falls back to SCORING).
 */
export async function fetchScoringValues(): Promise<ScoringValues> {
  if (cache.scoring && cache.timestamp && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.scoring;
  }
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("scoring_config")
      .select(SCORING_CONFIG_COLUMNS)
      .limit(1)
      .maybeSingle();
    const resolved = scoringFromConfig(data as Partial<ScoringConfigRow> | null);
    cache = { scoring: resolved, timestamp: Date.now() };
    return resolved;
  } catch {
    // Network/RLS failure → last good value, else the built-in defaults.
    return cache.scoring ?? SCORING;
  }
}

/** Hook: live scoring point values, defaulting to the SCORING constant. */
export function useScoring(): ScoringValues {
  const [scoring, setScoring] = useState<ScoringValues>(cache.scoring ?? SCORING);

  useEffect(() => {
    let active = true;
    // setState only inside the async resolution — never synchronously in the
    // effect body (cache hits resolve immediately via the Promise).
    fetchScoringValues().then((s) => {
      if (active) setScoring(s);
    });
    return () => {
      active = false;
    };
  }, []);

  return scoring;
}
