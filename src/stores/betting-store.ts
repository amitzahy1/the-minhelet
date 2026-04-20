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

  // Manual save — user-initiated save that bypasses the "only save on milestone" rule.
  saveNow: () => Promise<{ success: boolean; error?: string }>;

  // Hydrate from Supabase — server is source of truth. Overwrites the local
  // store with whatever the DB has for the logged-in user. If the DB is
  // empty (e.g. after an admin reset), this resets the local state to blank.
  hydrateFromSupabase: () => Promise<void>;

  // Computed
  getGroupFilledCount: (groupId: string) => number;
  getTotalFilledGroups: () => number;
  getTotalFilledMatches: () => number;
  getCompletedGroupsCount: () => number;
  getKnockoutFilledCount: () => number;
  getSpecialsFilledCount: () => number;
  areAllBetsFilled: () => boolean;
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

      // --- Hydrate from Supabase (server is source of truth) ---
      hydrateFromSupabase: async () => {
        try {
          const { loadBetsFromSupabase } = await import("@/lib/supabase/sync");
          const { data } = await loadBetsFromSupabase();
          set((state) => {
            if (!data) {
              // DB has nothing for this user → reset local state so ghost
              // counts from localStorage don't stick around.
              state.groups = createInitialGroups();
              state.knockout = {};
              state.specialBets = initialSpecialBets;
              state.lastUpdated = null;
              return;
            }
            // Overwrite with server data, merging group score shape defensively.
            if (data.groups && Object.keys(data.groups).length > 0) {
              const merged = createInitialGroups();
              for (const [g, v] of Object.entries(data.groups)) {
                if (v && typeof v === "object") {
                  merged[g] = {
                    order: v.order ?? [0, 1, 2, 3],
                    scores: v.scores ?? merged[g].scores,
                  };
                }
              }
              state.groups = merged;
            } else {
              state.groups = createInitialGroups();
            }
            state.knockout = data.knockout || {};
            if (data.specialBets) {
              state.specialBets = { ...initialSpecialBets, ...data.specialBets };
            } else {
              state.specialBets = initialSpecialBets;
            }
            state.lastUpdated = new Date().toISOString();
          });
          // Re-snapshot the milestone counts so the next edit is compared
          // against the freshly-loaded server state, not the pre-hydration one.
          snapshotCounts();
        } catch (e) {
          console.warn("hydrateFromSupabase failed:", e);
        }
      },

      // --- Manual save (explicit user action) ---
      saveNow: async () => {
        const state = get();
        const saveStatus = typeof window !== "undefined"
          ? (await import("./save-status-store")).useSaveStatus.getState()
          : null;
        saveStatus?.markSaving();
        try {
          const { saveBetsToSupabase } = await import("@/lib/supabase/sync");
          const result = await saveBetsToSupabase(state);
          if (result.success) {
            saveStatus?.markSaved();
            return { success: true };
          }
          saveStatus?.markError(result.error);
          return { success: false, error: result.error };
        } catch (e) {
          const msg = String(e);
          saveStatus?.markError(msg);
          return { success: false, error: msg };
        }
      },

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

      getKnockoutFilledCount: () => {
        return Object.values(get().knockout).filter((m) => m.winner).length;
      },

      getSpecialsFilledCount: () => {
        const sb = get().specialBets;
        let count = 0;
        if (sb.winner) count++;
        if (sb.finalist1) count++;
        if (sb.finalist2) count++;
        count += sb.quarterfinalists.filter(Boolean).length;
        count += sb.semifinalists.filter(Boolean).length;
        if (sb.topScorerPlayer) count++;
        if (sb.topAssistsPlayer) count++;
        if (sb.bestAttack) count++;
        if (sb.dirtiestTeam) count++;
        if (sb.prolificGroup) count++;
        if (sb.driestGroup) count++;
        count += sb.matchups.filter(Boolean).length;
        if (sb.penaltiesOverUnder) count++;
        return count;
      },

      areAllBetsFilled: () => {
        return get().getCompletedGroupsCount() === 12
          && get().getKnockoutFilledCount() === 31
          && get().getSpecialsFilledCount() === 25;
      },
    })),
    {
      name: "wc2026-bets",
      // v2 (2026-04-20): coincides with the switch to milestone-only saves
      // and a server-side reset. Any localStorage written by v1 is discarded
      // so every user starts from a blank slate without the ghost counts.
      version: 2,
      migrate: () => ({
        groups: createInitialGroups(),
        knockout: {},
        specialBets: initialSpecialBets,
        currentGroupIndex: 0,
        bracketLocked: false,
        lastUpdated: null,
      }),
      skipHydration: true,
      onRehydrateStorage: () => {
        return (state) => {
          if (state && typeof window !== "undefined") {
            // Mark hydration as done, reset save-status so no ghost toast fires
            setTimeout(() => {
              hasHydrated = true;
              snapshotCounts();
              import("./save-status-store").then((m) => m.useSaveStatus.getState().reset());
            }, 0);

            // Daily snapshot to localStorage (backup only)
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
  const saveStatus = typeof window !== "undefined"
    ? (await import("./save-status-store")).useSaveStatus.getState()
    : null;
  saveStatus?.markSaving();

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
  let ok = true;
  let errorMsg = "";
  try {
    const { saveBetsToSupabase } = await import("@/lib/supabase/sync");
    const result = await saveBetsToSupabase(state);
    if (!result.success) {
      ok = false;
      errorMsg = result.error || "שמירה נכשלה";
      console.error("Supabase save failed:", result.error);
    }
  } catch (e) {
    ok = false;
    errorMsg = String(e);
    console.error("Failed to save to Supabase:", e);
  }

  if (ok) saveStatus?.markSaved();
  else saveStatus?.markError(errorMsg);

  hasPendingChanges = false;
}

// Milestone tracking — we only auto-save when a stage transitions from
// "partial" → "complete" (or when the user edits a bet while already at 100%).
// Before that, the user must click the explicit "Save" button on each page.
// This stops us from hammering Supabase with every single keystroke while
// still providing a safety-net save at the end of each stage.
let lastCounts = { groups: 0, knockout: 0, specials: 0, allDone: false };
let lastGroupFilled: Record<string, number> = {};
let hasHydrated = false;

function countGroupFilled(state: BettingState, letter: string): number {
  return (state.groups[letter]?.scores || []).filter((s) => s.home !== null && s.away !== null).length;
}

// Hydrate initial counts on first load so we don't spuriously save on rehydrate.
function snapshotCounts() {
  const s = useBettingStore.getState();
  lastCounts = {
    groups: s.getCompletedGroupsCount(),
    knockout: s.getKnockoutFilledCount(),
    specials: s.getSpecialsFilledCount(),
    allDone: s.areAllBetsFilled(),
  };
  lastGroupFilled = {};
  for (const letter of GROUP_LETTERS) lastGroupFilled[letter] = countGroupFilled(s, letter);
}

if (typeof window !== "undefined") {
  useBettingStore.subscribe((state) => {
    // Don't treat hydration as a user change — it would flash the "pending"
    // toast on every page load and trigger a phantom save cycle.
    if (!hasHydrated) return;

    hasPendingChanges = true;

    // Always update the save-status indicator to "pending" so the user sees
    // "שינויים לא נשמרו — לחץ שמור" right away.
    import("./save-status-store").then((m) => m.useSaveStatus.getState().markPending());

    // Compute fresh completion counts
    const groups = GROUP_LETTERS.filter((l) => (state.groups[l]?.scores || []).filter((s) => s.home !== null && s.away !== null).length === 6).length;
    const knockout = Object.values(state.knockout).filter((m) => m.winner).length;
    const sb = state.specialBets;
    let specials = 0;
    if (sb.winner) specials++;
    if (sb.finalist1) specials++;
    if (sb.finalist2) specials++;
    specials += sb.quarterfinalists.filter(Boolean).length;
    specials += sb.semifinalists.filter(Boolean).length;
    if (sb.topScorerPlayer) specials++;
    if (sb.topAssistsPlayer) specials++;
    if (sb.bestAttack) specials++;
    if (sb.dirtiestTeam) specials++;
    if (sb.prolificGroup) specials++;
    if (sb.driestGroup) specials++;
    specials += sb.matchups.filter(Boolean).length;
    if (sb.penaltiesOverUnder) specials++;

    const allDone = groups === 12 && knockout === 31 && specials === 25;

    // Per-group completion detection — fires when the user enters the LAST
    // match score of any single group, independent of the overall stage
    // rollup. Gives each completed group its own safety-net save.
    const currentGroupFilled: Record<string, number> = {};
    for (const letter of GROUP_LETTERS) currentGroupFilled[letter] = countGroupFilled(state, letter);
    const anyGroupJustCompleted = GROUP_LETTERS.some((letter) => {
      const prev = lastGroupFilled[letter] ?? 0;
      return prev < 6 && currentGroupFilled[letter] === 6;
    });
    lastGroupFilled = currentGroupFilled;

    // Milestone detection: auto-save when a stage transitions incomplete → complete.
    const groupsJustCompleted = lastCounts.groups < 12 && groups === 12;
    const knockoutJustCompleted = lastCounts.knockout < 31 && knockout === 31;
    const specialsJustCompleted = lastCounts.specials < 25 && specials === 25;

    // Once fully complete, EVERY edit auto-saves (debounced 5s). Any single
    // group finishing also triggers a save so the user never has >1 group
    // of unsaved progress.
    const shouldAutoSave = allDone
      || anyGroupJustCompleted
      || groupsJustCompleted
      || knockoutJustCompleted
      || specialsJustCompleted;

    lastCounts = { groups, knockout, specials, allDone };

    if (shouldAutoSave) {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => performSave(state), allDone ? 3000 : 1000);
    }
    // else: don't save — user must click the manual "Save" button on the page.
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
