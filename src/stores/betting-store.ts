// ============================================================================
// WC2026 — Global Betting Store (Zustand)
// Single source of truth for ALL user predictions across all pages
// Groups ↔ Bracket ↔ Special Bets — all synced
// ============================================================================

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import {
  getStageFromKey,
  cascadeClear,
  clearTeamFromSpecialBets,
  syncAdvancementPicks,
} from "@/lib/tournament/bracket-cascade";
import { revalidateTree1 } from "@/lib/tournament/revalidate-bracket";

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
  roundOf16: string[];
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
  // This is TREE 1 — the pre-tournament "עץ סימולציה" (winner-only simulation).
  knockout: Record<string, KnockoutMatchState>;

  // Tree 2 — "עץ נתוני אמת" (real-data). Same slot keys, but predictions on the
  // REAL knockout matchups (score + winner). Saved per-match to Supabase via
  // saveLiveKnockout (NOT the June-10 path) and scored for knockout results.
  knockoutLive: Record<string, KnockoutMatchState>;

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
  // Tree 2 (real-data) — set a real-match prediction. Local only (no cascade);
  // the page persists to Supabase via saveLiveKnockout with the per-match lock.
  setKnockoutLiveMatch: (matchKey: string, data: Partial<KnockoutMatchState>) => void;

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

// Bracket-cascade helpers (NEXT_MATCH, cascadeClear, clearTeamFromSpecialBets,
// syncAdvancementPicks, getStageFromKey) now live in the framework-agnostic
// module @/lib/tournament/bracket-cascade so the store, the hydrate-time
// re-validator and the admin endpoint all share ONE implementation.

const initialSpecialBets: SpecialBetsState = {
  winner: "",
  finalist1: "",
  finalist2: "",
  semifinalists: ["", "", "", ""],
  quarterfinalists: ["", "", "", "", "", "", "", ""],
  roundOf16: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],

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
      knockoutLive: {},
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
            const downstream = cascadeClear(state.knockout, matchKey, oldWinner);
            const specialsCleared = clearTeamFromSpecialBets(state.specialBets, oldWinner, getStageFromKey(matchKey));
            const total = downstream + specialsCleared;
            if (total > 0 && typeof window !== "undefined") {
              // Fire a transient toast so the user notices the cascade.
              // Dynamic import keeps the store tree-shakeable on the server.
              import("./toast-store").then((m) => {
                m.useToastStore.getState().push(
                  `עדכנת מנצחת — ניקינו ${total} הימורים שהסתמכו על ${oldWinner}`,
                  "warning",
                  5000
                );
              });
            }
          }

          // Always keep advancement picks in sync with the bracket
          syncAdvancementPicks(state.knockout, state.specialBets);
          state.lastUpdated = new Date().toISOString();
        }),

      // Tree 2 (real-data). No cascade/advancement-sync: the next round's teams
      // come from REAL results, not the user's picked winners, so each real
      // match is an independent prediction. Supabase save is the page's job
      // (saveLiveKnockout, which enforces the per-match 1h-before-kickoff lock).
      setKnockoutLiveMatch: (matchKey, data) =>
        set((state) => {
          const oldWinner = state.knockoutLive[matchKey]?.winner;
          if (!state.knockoutLive[matchKey]) {
            state.knockoutLive[matchKey] = { score1: null, score2: null, winner: null };
          }
          Object.assign(state.knockoutLive[matchKey], data);
          const newWinner = state.knockoutLive[matchKey].winner;
          // Forward-fill cascade (same as the simulation tree): when the picked
          // winner changes, clear downstream picks that relied on the old one,
          // so the bracket the user fills forward stays consistent. No
          // advancement-sync here — Tree 2 doesn't feed advancement bets.
          if (oldWinner && oldWinner !== newWinner) {
            cascadeClear(state.knockoutLive, matchKey, oldWinner);
          }
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
          state.knockoutLive = {};
          state.specialBets = initialSpecialBets;
          state.currentGroupIndex = 0;
          state.bracketLocked = false;
          state.lastUpdated = null;
        }),

      // --- Hydrate from Supabase (server is source of truth) ---
      hydrateFromSupabase: async () => {
        try {
          const { loadBetsFromSupabase } = await import("@/lib/supabase/sync");
          const { data, serverUpdatedAt } = await loadBetsFromSupabase();

          // Cross-device resolution: the SERVER is the source of truth on load.
          // Apply it unless this device's LOCAL state is genuinely newer (i.e.
          // unsaved edits made here since the last server save) — only then do
          // we keep local so we don't clobber it (autosave will push it up).
          //
          // This fixes the cross-device bug where bets filled on one device did
          // NOT appear on another: the second device's stale localStorage (e.g.
          // groups only) used to block the server load and leave knockout /
          // specials empty. Now newer-server always wins.
          if (data && serverUpdatedAt && get().lastUpdated) {
            const serverTs = new Date(serverUpdatedAt).getTime();
            const localTs = new Date(get().lastUpdated!).getTime();
            if (localTs > serverTs + 60000) {
              return; // local has newer unsaved edits → keep them, don't overwrite
            }
          }

          // Gate the subscribe so the DB-overwrite isn't treated as a user
          // edit — otherwise the "pending" toast flashes on every login
          // whenever the server state differs from localStorage (e.g. after
          // an admin DB reset).
          isHydrating = true;
          set((state) => {
            if (!data) {
              // DB has nothing for this user → reset local state so ghost
              // counts from localStorage don't stick around.
              state.groups = createInitialGroups();
              state.knockout = {};
              state.knockoutLive = {};
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
            state.knockoutLive = data.knockoutLive || {};
            if (data.specialBets) {
              // The save pipeline strips empty strings via filter(Boolean),
              // so the DB can return shorter arrays than the UI expects
              // (e.g. semifinalists=["TUR"] instead of ["TUR","","",""]).
              // Pad to the canonical lengths so each position still has an
              // input rendered.
              const pad = (arr: unknown, len: number): string[] => {
                const a = Array.isArray(arr) ? arr.map((v) => (typeof v === "string" ? v : "")) : [];
                while (a.length < len) a.push("");
                return a.slice(0, len);
              };
              const sb = data.specialBets;
              state.specialBets = {
                ...initialSpecialBets,
                ...sb,
                semifinalists: pad(sb.semifinalists, 4),
                quarterfinalists: pad(sb.quarterfinalists, 8),
                roundOf16: pad(sb.roundOf16, 16),
                matchups: pad(sb.matchups, 3),
              };
            } else {
              state.specialBets = initialSpecialBets;
            }
            state.lastUpdated = new Date().toISOString();
          });

          // Silent migration: clear SIMULATION-TREE (Tree 1) picks invalidated by
          // the corrected FIFA Annex C thirds, so a user never silently scores 0
          // on a pick referencing a team no longer in its slot. This touches ONLY
          // `knockout` (Tree 1) + the advancement bets — NOT `knockoutLive`
          // (Tree 2), whose matchups come from real results, not our computation.
          let revalCount = 0;
          set((state) => {
            const res = revalidateTree1(state.groups, state.knockout, state.specialBets);
            if (res.changed) {
              state.knockout = res.knockout;
              state.specialBets = res.specialBets;
              revalCount = res.invalidSlots.length;
              state.lastUpdated = new Date().toISOString();
            }
          });

          // Re-snapshot the milestone counts so the next edit is compared
          // against the freshly-loaded server state, not the pre-hydration one.
          snapshotCounts();

          if (revalCount > 0) {
            // Persist the correction once so it isn't re-cleared every load.
            // (If the deadline already passed the save is rejected — admin bulk
            // re-validation handles post-lock remediation.)
            try {
              const { saveBetsToSupabase } = await import("@/lib/supabase/sync");
              await saveBetsToSupabase(get());
            } catch { /* will re-save on the next edit */ }
            if (typeof window !== "undefined") {
              import("./toast-store").then((m) =>
                m.useToastStore.getState().push(
                  `${revalCount} הימורים בעץ הסימולציה עודכנו: יריבות מקום-3 שהשתנו לפי חוקי פיפ״א`,
                  "warning",
                  7000,
                ),
              );
            }
          }
        } catch (e) {
          console.warn("hydrateFromSupabase failed:", e);
          // Offline fallback: restore from IndexedDB if available
          try {
            const { readBetsFromIDB } = await import("@/lib/idb-cache");
            const cached = await readBetsFromIDB();
            if (cached) {
              isHydrating = true;
              set((state) => {
                if (cached.groups) state.groups = cached.groups as typeof state.groups;
                if (cached.knockout) state.knockout = cached.knockout as typeof state.knockout;
                if (cached.knockoutLive) state.knockoutLive = cached.knockoutLive as typeof state.knockoutLive;
                if (cached.specialBets) state.specialBets = cached.specialBets as typeof state.specialBets;
                state.lastUpdated = new Date().toISOString();
              });
              isHydrating = false;
            }
          } catch { /* IDB also unavailable */ }
        } finally {
          // Re-open the subscribe gate so real user edits are captured.
          isHydrating = false;
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
            // Keep batch baselines in sync after a manual save too.
            lastSavedKnockoutCount = state.getKnockoutFilledCount();
            lastSavedSpecialsCount = state.getSpecialsFilledCount();
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
        knockoutLive: {},
        specialBets: initialSpecialBets,
        currentGroupIndex: 0,
        bracketLocked: false,
        lastUpdated: null,
      }),
      // Repair the persisted shape on rehydrate. zustand persist shallow-merges
      // the stored object over the initial state, so `specialBets` is REPLACED
      // wholesale — any array field added after a user last saved (e.g.
      // roundOf16) comes back `undefined` and crashes every consumer that calls
      // .filter / .map / spread on it. Deep-default specialBets from
      // initialSpecialBets and pad every array to its canonical length.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BettingState>;
        const padArr = (v: unknown, n: number): string[] => {
          const a = Array.isArray(v) ? (v as string[]).slice(0, n) : [];
          while (a.length < n) a.push("");
          return a;
        };
        const sb: SpecialBetsState = { ...initialSpecialBets, ...(p.specialBets ?? {}) };
        sb.semifinalists = padArr(sb.semifinalists, 4);
        sb.quarterfinalists = padArr(sb.quarterfinalists, 8);
        sb.roundOf16 = padArr(sb.roundOf16, 16);
        sb.matchups = padArr(sb.matchups, 3);
        return { ...current, ...p, specialBets: sb } as BettingState & BettingActions;
      },
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
                  knockoutLive: state.knockoutLive,
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

// Batch-save baselines: after a successful save we snapshot the current
// knockout / specials counts here. The subscribe callback compares against
// these to fire another auto-save every BATCH_EVERY net edits — so the user
// never has more than a handful of unsaved picks in either stage.
let lastSavedKnockoutCount = 0;
let lastSavedSpecialsCount = 0;
const BATCH_EVERY = 5;

async function performSave(state: BettingState) {
  const saveStatus = typeof window !== "undefined"
    ? (await import("./save-status-store")).useSaveStatus.getState()
    : null;
  saveStatus?.markSaving();

  // Snapshot for optimistic rollback
  const snapshot = {
    groups: JSON.parse(JSON.stringify(state.groups)),
    knockout: JSON.parse(JSON.stringify(state.knockout)),
    knockoutLive: JSON.parse(JSON.stringify(state.knockoutLive)),
    specialBets: JSON.parse(JSON.stringify(state.specialBets)),
  };

  // 1. Save to IndexedDB (offline cache — fire and forget)
  import("@/lib/idb-cache").then(({ writeBetsToIDB }) =>
    writeBetsToIDB({ groups: state.groups, knockout: state.knockout, knockoutLive: state.knockoutLive, specialBets: state.specialBets })
  );

  // 2. Save to localStorage backup
  try {
    const today = new Date().toISOString().split("T")[0];
    const key = `wc2026-backup-${today}`;
    localStorage.setItem(key, JSON.stringify({
      exportedAt: new Date().toISOString(),
      groups: state.groups,
      knockout: state.knockout,
      knockoutLive: state.knockoutLive,
      specialBets: state.specialBets,
    }));
  } catch { /* localStorage full or unavailable */ }

  // 3. Save to Supabase (if logged in)
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

  if (ok) {
    saveStatus?.markSaved();
    // Subtle haptic pulse on mobile to confirm save
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);
    // Reset batch baselines so the next 5 edits are counted from here.
    lastSavedKnockoutCount = Object.values(state.knockout).filter((m) => m.winner).length;
    const sb = state.specialBets;
    let sc = 0;
    if (sb.winner) sc++;
    if (sb.finalist1) sc++;
    if (sb.finalist2) sc++;
    sc += sb.quarterfinalists.filter(Boolean).length;
    sc += sb.semifinalists.filter(Boolean).length;
    if (sb.topScorerPlayer) sc++;
    if (sb.topAssistsPlayer) sc++;
    if (sb.bestAttack) sc++;
    if (sb.dirtiestTeam) sc++;
    if (sb.prolificGroup) sc++;
    if (sb.driestGroup) sc++;
    sc += sb.matchups.filter(Boolean).length;
    if (sb.penaltiesOverUnder) sc++;
    lastSavedSpecialsCount = sc;
  } else {
    saveStatus?.markError(errorMsg);
    // Optimistic rollback: restore pre-save snapshot so UI state stays consistent
    useBettingStore.setState((s) => {
      s.groups = snapshot.groups;
      s.knockout = snapshot.knockout;
      s.knockoutLive = snapshot.knockoutLive;
      s.specialBets = snapshot.specialBets;
    });
  }

  hasPendingChanges = false;
}

// Milestone tracking — we only auto-save when a stage transitions from
// "partial" → "complete" (or when the user edits a bet while already at 100%).
// Before that, the user must click the explicit "Save" button on each page.
// This stops us from hammering Supabase with every single keystroke while
// still providing a safety-net save at the end of each stage.
let lastCounts = { groups: 0, knockout: 0, specials: 0, allDone: false };
let lastGroupFilled: Record<string, number> = {};
let lastBetSig = "";
// Fingerprint of just the special-bets object. Any change auto-saves (debounced)
// so individual special picks are never left unsaved — they used to require the
// manual Save button or a 5-edit batch, so a few picks could be wiped by the
// next server-authoritative hydration (refresh / redeploy).
let lastSpecialsSig = "";
let hasHydrated = false;
// True while hydrateFromSupabase is overwriting local state with DB content.
// The subscribe callback must ignore these writes — they're not user edits.
let isHydrating = false;

function countGroupFilled(state: BettingState, letter: string): number {
  return (state.groups[letter]?.scores || []).filter((s) => s.home !== null && s.away !== null).length;
}

/** A cheap, stable fingerprint of just the *persisted-to-DB* bet fields.
 *  Ignores UI-only state (currentGroupIndex, bracketLocked). Used by the
 *  subscribe callback to ignore non-bet changes (navigation, hydration
 *  writing the same data back, etc.) — those must not flip the "pending"
 *  indicator or trigger a save.
 */
function betSig(state: BettingState): string {
  return JSON.stringify({ g: state.groups, k: state.knockout, s: state.specialBets });
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
  lastBetSig = betSig(s);
  lastSpecialsSig = JSON.stringify(s.specialBets);
  // Align batch baselines with the just-hydrated DB state so the first 5
  // edits after login are the ones that trip the batch save, not counted
  // from zero.
  lastSavedKnockoutCount = lastCounts.knockout;
  lastSavedSpecialsCount = lastCounts.specials;
}

if (typeof window !== "undefined") {
  useBettingStore.subscribe((state) => {
    // Don't treat initial localStorage hydration as a user change.
    if (!hasHydrated) return;
    // Don't treat DB→local hydration as a user change either — when the
    // server state differs from localStorage (e.g. after an admin reset),
    // this write will change the sig but must not flash "pending".
    if (isHydrating) {
      lastBetSig = betSig(state);
      lastSpecialsSig = JSON.stringify(state.specialBets);
      return;
    }

    // Ignore non-bet mutations (currentGroupIndex etc.) so the save toast
    // doesn't flash when the user just navigates around.
    const sig = betSig(state);
    if (sig === lastBetSig) return;
    lastBetSig = sig;

    // Did the special-bets object itself change this tick? Every special pick
    // must auto-save (debounced) — see lastSpecialsSig note above.
    const specialsSig = JSON.stringify(state.specialBets);
    const specialsChanged = specialsSig !== lastSpecialsSig;
    lastSpecialsSig = specialsSig;

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

    // Batch detection: every N net edits within knockout or specials trips a
    // safety-net save so the user never has >N unsaved picks in either stage.
    // Math.abs handles both inserts and deletes (cascade-clear decreases the
    // count, which is still a write-worthy event).
    const knockoutBatchHit = Math.abs(knockout - lastSavedKnockoutCount) >= BATCH_EVERY;
    const specialsBatchHit = Math.abs(specials - lastSavedSpecialsCount) >= BATCH_EVERY;

    // Once fully complete, EVERY edit auto-saves (debounced 3s). Any single
    // group finishing, any stage completing, and every 5 knockout/specials
    // edits also fire a save — so no user loses more than a handful of picks.
    const shouldAutoSave = allDone
      || anyGroupJustCompleted
      || groupsJustCompleted
      || knockoutJustCompleted
      || specialsJustCompleted
      || knockoutBatchHit
      || specialsBatchHit
      || specialsChanged; // every special pick saves (debounced), never batched-away

    lastCounts = { groups, knockout, specials, allDone };

    // Auto-save EVERY real bet edit (debounced). We only reach here when the
    // bet signature actually changed — navigation and DB→local hydration are
    // filtered out above — so this is a genuine pick in groups, the simulation
    // knockout tree, or specials. None of them rely on the manual Save button
    // or a batch threshold anymore, so no pick can sit unsaved and be wiped by
    // the next server-authoritative hydration (a refresh or a redeploy). The
    // `shouldAutoSave` milestone flags now only shorten the debounce window;
    // the real-data knockout tree saves per-slot on its own page.
    if (saveTimeout) clearTimeout(saveTimeout);
    const debounceMs = allDone ? 3000 : shouldAutoSave ? 700 : 1200;
    saveTimeout = setTimeout(() => performSave(state), debounceMs);
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
          knockoutLive: state.knockoutLive,
          specialBets: state.specialBets,
        }));
      } catch { /* ignore */ }
      // Attempt async Supabase save via sendBeacon (fire-and-forget)
      try {
        navigator.sendBeacon("/api/sync-beacon", JSON.stringify({
          groups: state.groups,
          knockout: state.knockout,
          knockoutLive: state.knockoutLive,
          specialBets: state.specialBets,
        }));
      } catch { /* ignore */ }
    }
  });
}
