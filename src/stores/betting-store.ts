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

// --- Bracket tree: each match key → the downstream match it feeds ---

const NEXT_MATCH: Record<string, string> = {
  // R32 → R16
  r32l_0: "r16l_0", r32l_1: "r16l_0",
  r32l_2: "r16l_1", r32l_3: "r16l_1",
  r32l_4: "r16l_2", r32l_5: "r16l_2",
  r32l_6: "r16l_3", r32l_7: "r16l_3",
  r32r_0: "r16r_0", r32r_1: "r16r_0",
  r32r_2: "r16r_1", r32r_3: "r16r_1",
  r32r_4: "r16r_2", r32r_5: "r16r_2",
  r32r_6: "r16r_3", r32r_7: "r16r_3",
  // R16 → QF
  r16l_0: "qfl_0", r16l_1: "qfl_0",
  r16l_2: "qfl_1", r16l_3: "qfl_1",
  r16r_0: "qfr_0", r16r_1: "qfr_0",
  r16r_2: "qfr_1", r16r_3: "qfr_1",
  // QF → SF
  qfl_0: "sfl_0", qfl_1: "sfl_0",
  qfr_0: "sfr_0", qfr_1: "sfr_0",
  // SF → Final
  sfl_0: "final", sfr_0: "final",
};

function getStageFromKey(matchKey: string): string {
  if (matchKey.startsWith("r32")) return "r32";
  if (matchKey.startsWith("r16")) return "r16";
  if (matchKey.startsWith("qf")) return "qf";
  if (matchKey.startsWith("sf")) return "sf";
  return "final";
}

/** Recursively clear downstream matches whose winner is the removed team */
function cascadeClear(
  knockout: Record<string, KnockoutMatchState>,
  matchKey: string,
  oldWinner: string
) {
  const nextKey = NEXT_MATCH[matchKey];
  if (!nextKey) return;
  const nextMatch = knockout[nextKey];
  if (nextMatch?.winner === oldWinner) {
    knockout[nextKey] = { score1: null, score2: null, winner: null };
    cascadeClear(knockout, nextKey, oldWinner);
  }
}

/** Clear eliminated team from special bets at the appropriate levels */
function clearTeamFromSpecialBets(
  sb: SpecialBetsState,
  teamCode: string,
  fromStage: string
) {
  const STAGES = ["r32", "r16", "qf", "sf", "final"];
  const idx = STAGES.indexOf(fromStage);

  // R32 or R16 change → team can't reach QF
  if (idx <= 1) {
    sb.quarterfinalists = sb.quarterfinalists.map(s => (s === teamCode ? "" : s));
  }
  // R32, R16, or QF change → team can't reach SF
  if (idx <= 2) {
    sb.semifinalists = sb.semifinalists.map(s => (s === teamCode ? "" : s));
  }
  // R32–SF change → team can't reach final
  if (idx <= 3) {
    if (sb.finalist1 === teamCode) sb.finalist1 = "";
    if (sb.finalist2 === teamCode) sb.finalist2 = "";
  }
  // Any change → team can't be winner
  if (sb.winner === teamCode) sb.winner = "";
}

/** Sync advancement picks from knockout tree (bracket is source of truth) */
function syncAdvancementPicks(
  knockout: Record<string, KnockoutMatchState>,
  sb: SpecialBetsState
) {
  const qf = [
    knockout.r16l_0?.winner, knockout.r16l_1?.winner,
    knockout.r16l_2?.winner, knockout.r16l_3?.winner,
    knockout.r16r_0?.winner, knockout.r16r_1?.winner,
    knockout.r16r_2?.winner, knockout.r16r_3?.winner,
  ];
  sb.quarterfinalists = sb.quarterfinalists.map((v, i) => qf[i] || v);

  const sf = [
    knockout.qfl_0?.winner, knockout.qfl_1?.winner,
    knockout.qfr_0?.winner, knockout.qfr_1?.winner,
  ];
  sb.semifinalists = sb.semifinalists.map((v, i) => sf[i] || v);

  const f1 = knockout.sfl_0?.winner;
  const f2 = knockout.sfr_0?.winner;
  if (f1) sb.finalist1 = f1;
  if (f2) sb.finalist2 = f2;

  const w = knockout.final?.winner;
  if (w) sb.winner = w;
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
          const oldWinner = state.knockout[matchKey]?.winner;
          if (!state.knockout[matchKey]) {
            state.knockout[matchKey] = { score1: null, score2: null, winner: null };
          }
          Object.assign(state.knockout[matchKey], data);
          const newWinner = state.knockout[matchKey].winner;

          // Cascade-clear downstream matches + special bets when winner changes
          if (oldWinner && oldWinner !== newWinner) {
            cascadeClear(state.knockout, matchKey, oldWinner);
            clearTeamFromSpecialBets(state.specialBets, oldWinner, getStageFromKey(matchKey));
          }

          // Always keep advancement picks in sync with the bracket
          syncAdvancementPicks(state.knockout, state.specialBets);
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
          if (state && typeof window !== "undefined") {
            // Auto-save daily snapshot to localStorage
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

            // Auto-sync to Supabase on page load (catches data that was never synced)
            setTimeout(async () => {
              try {
                const { saveBetsToSupabase } = await import("@/lib/supabase/sync");
                const currentState = useBettingStore.getState();
                const hasData = Object.values(currentState.groups).some(g =>
                  g.scores.some(s => s.home !== null)
                );
                if (hasData) {
                  const result = await saveBetsToSupabase(currentState);
                  if (result.success) console.log("Auto-synced to Supabase on load");
                  else console.warn("Auto-sync failed:", result.error);
                }
              } catch { /* silent */ }
            }, 3000);
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
