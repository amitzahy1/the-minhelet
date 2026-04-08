"use client";

import { useState, useEffect } from "react";
import {
  loadAllProfiles,
  loadAllBrackets,
  loadAllSpecialBets,
  loadAllAdvancements,
  loadAllMatchPredictions,
  loadScoringLog,
  type BettorProfile,
  type BettorBracket,
  type BettorSpecialBets,
  type BettorAdvancement,
  type MatchPrediction,
  type ScoringEntry,
} from "@/lib/supabase/shared-data";

interface SharedData {
  profiles: BettorProfile[];
  brackets: BettorBracket[];
  specialBets: BettorSpecialBets[];
  advancements: BettorAdvancement[];
  predictions: MatchPrediction[];
  scoringLog: ScoringEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Simple in-memory cache (shared across hook instances within same page lifecycle)
let cache: {
  profiles?: BettorProfile[];
  brackets?: BettorBracket[];
  specialBets?: BettorSpecialBets[];
  advancements?: BettorAdvancement[];
  predictions?: MatchPrediction[];
  scoringLog?: ScoringEntry[];
  timestamp?: number;
} = {};

const CACHE_TTL = 30_000; // 30 seconds

function isCacheValid() {
  return cache.timestamp && Date.now() - cache.timestamp < CACHE_TTL;
}

/**
 * Hook to load all shared bettor data from Supabase.
 * Caches results for 30 seconds to avoid hammering the API.
 * Falls back gracefully to empty arrays if Supabase is not configured.
 */
export function useSharedData(): SharedData {
  const [data, setData] = useState<Omit<SharedData, "refetch">>({
    profiles: cache.profiles || [],
    brackets: cache.brackets || [],
    specialBets: cache.specialBets || [],
    advancements: cache.advancements || [],
    predictions: cache.predictions || [],
    scoringLog: cache.scoringLog || [],
    loading: !isCacheValid(),
    error: null,
  });

  const fetchAll = async () => {
    if (isCacheValid()) {
      setData({
        profiles: cache.profiles || [],
        brackets: cache.brackets || [],
        specialBets: cache.specialBets || [],
        advancements: cache.advancements || [],
        predictions: cache.predictions || [],
        scoringLog: cache.scoringLog || [],
        loading: false,
        error: null,
      });
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [profiles, brackets, specialBets, advancements, predictions, scoringLog] =
        await Promise.all([
          loadAllProfiles(),
          loadAllBrackets(),
          loadAllSpecialBets(),
          loadAllAdvancements(),
          loadAllMatchPredictions(),
          loadScoringLog(),
        ]);

      cache = { profiles, brackets, specialBets, advancements, predictions, scoringLog, timestamp: Date.now() };

      setData({ profiles, brackets, specialBets, advancements, predictions, scoringLog, loading: false, error: null });
    } catch (e) {
      console.error("Failed to load shared data:", e);
      setData((prev) => ({ ...prev, loading: false, error: String(e) }));
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return { ...data, refetch: fetchAll };
}
