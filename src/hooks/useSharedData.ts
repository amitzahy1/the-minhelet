"use client";

import { useState, useEffect } from "react";
import {
  loadAllProfiles,
  loadAllBrackets,
  loadAllSpecialBets,
  loadAllAdvancements,
  loadAllMatchPredictions,
  loadAllBetsViaServer,
  loadScoringLog,
  type BettorProfile,
  type BettorBracket,
  type BettorSpecialBets,
  type BettorAdvancement,
  type MatchPrediction,
  type ScoringEntry,
} from "@/lib/supabase/shared-data";
import { isLocked } from "@/lib/constants";

interface SharedData {
  profiles: BettorProfile[];
  brackets: BettorBracket[];
  specialBets: BettorSpecialBets[];
  advancements: BettorAdvancement[];
  predictions: MatchPrediction[];
  scoringLog: ScoringEntry[];
  currentUserId: string | null;
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
  currentUserId?: string | null;
  timestamp?: number;
} = {};

const CACHE_TTL = 30_000; // 30 seconds

function isCacheValid() {
  return cache.timestamp && Date.now() - cache.timestamp < CACHE_TTL;
}

/**
 * Hook to load all shared bettor data from Supabase.
 * After lock deadline: fetches via server API (bypasses RLS) to show all bets.
 * Before lock: fetches directly via client (RLS limits visibility).
 * Caches results for 30 seconds to avoid hammering the API.
 */
export function useSharedData(): SharedData {
  const [data, setData] = useState<Omit<SharedData, "refetch">>({
    profiles: cache.profiles || [],
    brackets: cache.brackets || [],
    specialBets: cache.specialBets || [],
    advancements: cache.advancements || [],
    predictions: cache.predictions || [],
    scoringLog: cache.scoringLog || [],
    currentUserId: cache.currentUserId || null,
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
        currentUserId: cache.currentUserId || null,
        loading: false,
        error: null,
      });
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Always load profiles, predictions, and scoring log via client
      const [profiles, predictions, scoringLog] = await Promise.all([
        loadAllProfiles(),
        loadAllMatchPredictions(),
        loadScoringLog(),
      ]);

      let brackets: BettorBracket[];
      let specialBets: BettorSpecialBets[];
      let advancements: BettorAdvancement[];
      let currentUserId: string | null = null;

      // After lock: use server API to bypass RLS and get all bets
      if (isLocked()) {
        const serverData = await loadAllBetsViaServer();
        if (serverData) {
          brackets = serverData.brackets;
          specialBets = serverData.specialBets;
          advancements = serverData.advancements;
          currentUserId = serverData.currentUserId;
        } else {
          // Fallback to client queries if server API fails
          [brackets, specialBets, advancements] = await Promise.all([
            loadAllBrackets(),
            loadAllSpecialBets(),
            loadAllAdvancements(),
          ]);
        }
      } else {
        // Before lock: use client queries (RLS limits to own data)
        [brackets, specialBets, advancements] = await Promise.all([
          loadAllBrackets(),
          loadAllSpecialBets(),
          loadAllAdvancements(),
        ]);
      }

      cache = { profiles, brackets, specialBets, advancements, predictions, scoringLog, currentUserId, timestamp: Date.now() };

      setData({ profiles, brackets, specialBets, advancements, predictions, scoringLog, currentUserId, loading: false, error: null });
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
