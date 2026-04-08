// ============================================================================
// WC2026 — Global Betting Store (Zustand)
// Single source of truth for ALL user predictions across all pages
// Groups ↔ Bracket ↔ Special Bets — all synced
// ============================================================================

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";

// --- Types ---

export interface GroupMatchScore {
  home: number | null;
  away: number | null;
}

export interface GroupState {
  order: number[]; // team indices in predicted order [0,1,2,3]
  scores: GroupMatchScore[]; // 6 match scores
}

export interface KnockoutMatchState {
  score1: number | null;
  score2: number | null;
  winner: string | null; // team code
}

export interface SpecialBetsState {
  winner: string;
  finalist1: string;
  finalist2: string;
  semifinalists: string[];
  quarterfinalists: string[];
  topScorerTeam: string;
  topScorerPlayer: string;
  topAssistsTeam: string;
  topAssistsPlayer: string;
  bestAttack: string;
  prolificGroup: string;
  driestGroup: string;
  dirtiestTeam: string;
  matchups: string[]; // ["1", "X", "2"] for each matchup
  penaltiesOverUnder: string;
  mostGoalsMatchStage: string;
  firstRedCardTeam: string;
  youngestScorerTeam: string;
}

export interface BettingState {
  // Group stage: keyed by group letter (A-L)
  groups: Record<string, GroupState>;

  // Knockout: keyed by "r32l_0", "r32r_3", "r16l_1", etc.
  knockout: Record<string, KnockoutMatchState>;

  // Special bets
  specialBets: SpecialBetsState;

  // UI state
  currentGroupIndex: number;
  bracketLocked: boolean;
  lastUpdated: string | null;
}

export interface BettingActions {
  // Groups
  setGroupOrder: (groupId: string, order: number[]) => void;
  setGroupScore: (groupId: string, matchIdx: number, side: "home" | "away", value: number) => void;
  setCurrentGroupIndex: (idx: number) => void;

  // Knockout
  setKnockoutMatch: (matchKey: string, data: Partial<KnockoutMatchState>) => void;

  // Special bets
  setSpecialBet: <K extends keyof SpecialBetsState>(key: K, value: SpecialBetsState[K]) => void;

  // Lock
  lockBracket: () => void;

  // Reset
  resetAll: () => void;

  // Computed
  getGroupFilledCount: (groupId: string) => number;
  getTotalFilledGroups: () => number;
  getTotalFilledMatches: () => number;
  getCompletedGroupsCount: () => number;
}

// --- Initial State ---

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function createInitialGroups(): Record<string, GroupState> {
  const groups: Record<string, GroupState> = {};
  for (const letter of GROUP_LETTERS) {
    groups[letter] = {
      order: [0, 1, 2, 3],
      scores: Array(6).fill(null).map(() => ({ home: null, away: null })),
    };
  }
  return groups;
}

const initialSpecialBets: SpecialBetsState = {
  winner: "",
  finalist1: "",
  finalist2: "",
  semifinalists: ["", "", "", ""],
  quarterfinalists: ["", "", "", "", "", "", "", ""],
  topScorerTeam: "",
  topScorerPlayer: "",
  topAssistsTeam: "",
  topAssistsPlayer: "",
  bestAttack: "",
  prolificGroup: "",
  driestGroup: "",
  dirtiestTeam: "",
  matchups: ["", "", ""],
  penaltiesOverUnder: "",
  mostGoalsMatchStage: "",
  firstRedCardTeam: "",
  youngestScorerTeam: "",
};

// --- Store ---

export const useBettingStore = create<BettingState & BettingActions>()(
  persist(
    immer((set, get) => ({
      // State
      groups: createInitialGroups(),
      knockout: {},
      specialBets: initialSpecialBets,
      currentGroupIndex: 0,
      bracketLocked: false,
      lastUpdated: null,

      // --- Group Actions ---
      setGroupOrder: (groupId, order) =>
        set((state) => {
          state.groups[groupId].order = order;
          state.lastUpdated = new Date().toISOString();
        }),

      setGroupScore: (groupId, matchIdx, side, value) =>
        set((state) => {
          const group = state.groups[groupId];
          if (!group) return;
          group.scores[matchIdx][side] = value;
          // Auto-set other side to 0 if null
          const otherSide = side === "home" ? "away" : "home";
          if (group.scores[matchIdx][otherSide] === null) {
            group.scores[matchIdx][otherSide] = 0;
          }
          state.lastUpdated = new Date().toISOString();
        }),

      setCurrentGroupIndex: (idx) =>
        set((state) => {
          state.currentGroupIndex = idx;
        }),

      // --- Knockout Actions ---
      setKnockoutMatch: (matchKey, data) =>
        set((state) => {
          if (!state.knockout[matchKey]) {
            state.knockout[matchKey] = { score1: null, score2: null, winner: null };
          }
          Object.assign(state.knockout[matchKey], data);
          state.lastUpdated = new Date().toISOString();
        }),

      // --- Special Bets Actions ---
      setSpecialBet: (key, value) =>
        set((state) => {
          (state.specialBets as Record<string, unknown>)[key] = value;
          state.lastUpdated = new Date().toISOString();
        }),

      // --- Lock ---
      lockBracket: () =>
        set((state) => {
          state.bracketLocked = true;
          state.lastUpdated = new Date().toISOString();
        }),

      // --- Reset ---
      resetAll: () =>
        set((state) => {
          state.groups = createInitialGroups();
          state.knockout = {};
          state.specialBets = initialSpecialBets;
          state.currentGroupIndex = 0;
          state.bracketLocked = false;
          state.lastUpdated = null;
        }),

      // --- Computed ---
      getGroupFilledCount: (groupId) => {
        const group = get().groups[groupId];
        if (!group) return 0;
        return group.scores.filter((s) => s.home !== null && s.away !== null).length;
      },

      getTotalFilledGroups: () => {
        return GROUP_LETTERS.reduce((sum, letter) => {
          return sum + get().getGroupFilledCount(letter);
        }, 0);
      },

      getTotalFilledMatches: () => {
        const groupMatches = get().getTotalFilledGroups();
        const knockoutMatches = Object.values(get().knockout).filter((m) => m.winner).length;
        return groupMatches + knockoutMatches;
      },

      getCompletedGroupsCount: () => {
        return GROUP_LETTERS.filter((letter) => get().getGroupFilledCount(letter) === 6).length;
      },
    })),
    {
      name: "wc2026-bets",
      skipHydration: true,
      onRehydrateStorage: () => {
        return (state) => {
          // Auto-save daily snapshot on rehydrate
          if (state && typeof window !== "undefined") {
            try {
              const today = new Date().toISOString().split("T")[0];
              const key = `wc2026-backup-${today}`;
              if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify({
                  exportedAt: new Date().toISOString(),
                  groups: state.groups,
                  knockout: state.knockout,
                  specialBets: state.specialBets,
                }));
              }
            } catch { /* ignore */ }
          }
        };
      },
    }
  )
);

// Auto-save on every change (debounced) — localStorage + Supabase
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let hasPendingChanges = false;

async function performSave(state: BettingState) {
  // 1. Save to localStorage backup
  try {
    const today = new Date().toISOString().split("T")[0];
    const key = `wc2026-backup-${today}`;
    localStorage.setItem(key, JSON.stringify({
      exportedAt: new Date().toISOString(),
      groups: state.groups,
      knockout: state.knockout,
      specialBets: state.specialBets,
    }));
  } catch { /* localStorage full or unavailable */ }

  // 2. Save to Supabase (if logged in)
  try {
    const { saveBetsToSupabase } = await import("@/lib/supabase/sync");
    const result = await saveBetsToSupabase(state);
    if (!result.success) {
      console.error("Supabase save failed:", result.error);
    }
  } catch (e) {
    console.error("Failed to save to Supabase:", e);
  }

  hasPendingChanges = false;
}

if (typeof window !== "undefined") {
  useBettingStore.subscribe((state) => {
    hasPendingChanges = true;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => performSave(state), 5000);
  });

  // Force-save on page unload to prevent data loss
  window.addEventListener("beforeunload", () => {
    if (hasPendingChanges) {
      const state = useBettingStore.getState();
      // Synchronous localStorage save (best effort)
      try {
        const today = new Date().toISOString().split("T")[0];
        localStorage.setItem(`wc2026-backup-${today}`, JSON.stringify({
          exportedAt: new Date().toISOString(),
          groups: state.groups,
          knockout: state.knockout,
          specialBets: state.specialBets,
        }));
      } catch { /* ignore */ }
      // Attempt async Supabase save via sendBeacon (fire-and-forget)
      try {
        navigator.sendBeacon("/api/sync-beacon", JSON.stringify({
          groups: state.groups,
          knockout: state.knockout,
          specialBets: state.specialBets,
        }));
      } catch { /* ignore */ }
    }
  });
}
