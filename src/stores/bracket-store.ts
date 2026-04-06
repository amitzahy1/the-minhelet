// ============================================================================
// WC2026 — Bracket Builder Zustand Store
// ============================================================================

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  GroupPrediction,
  GroupMatchPrediction,
  KnockoutMatchPrediction,
  KnockoutTree,
  GroupStandingEntry,
} from "@/types";
import { calculateStandings, validateGroupOrder } from "@/lib/tournament/standings";
import { getGroupTeams } from "@/lib/tournament/groups";

// Current step in the bracket builder wizard
export type BracketStep = "groups" | "third-place" | "knockout" | "specials" | "review";

interface BracketState {
  // Current wizard step
  currentStep: BracketStep;

  // Group stage predictions (keyed by group letter A-L)
  groups: Record<string, GroupPrediction>;

  // Which 8 third-place groups qualify
  thirdPlaceQualifiers: string[];

  // Knockout bracket
  knockoutTree: KnockoutTree;

  // Predicted champion
  champion: string | null;

  // Whether the bracket is locked
  isLocked: boolean;

  // Active group being edited (for mobile focus)
  activeGroup: string | null;
}

interface BracketActions {
  // Navigation
  setStep: (step: BracketStep) => void;
  setActiveGroup: (groupId: string | null) => void;

  // Group stage
  setGroupOrder: (groupId: string, order: string[]) => void;
  setGroupMatchScore: (
    groupId: string,
    matchIndex: number,
    homeGoals: number,
    awayGoals: number
  ) => void;
  recalculateGroupStandings: (groupId: string) => void;

  // Third place
  toggleThirdPlaceQualifier: (groupId: string) => void;

  // Knockout
  setKnockoutMatchResult: (
    stage: keyof KnockoutTree,
    matchIndex: number,
    prediction: KnockoutMatchPrediction
  ) => void;

  // Lock
  lockBracket: () => void;

  // Reset
  resetBracket: () => void;

  // Computed
  getCompletionStatus: () => {
    groupsComplete: number;
    totalGroups: number;
    thirdPlaceComplete: boolean;
    knockoutComplete: boolean;
    isFullyComplete: boolean;
  };
}

const initialKnockoutTree: KnockoutTree = {
  r32: [],
  r16: [],
  qf: [],
  sf: [],
  third_place: null,
  final: null,
};

function createEmptyGroupPrediction(groupId: string): GroupPrediction {
  const teams = getGroupTeams(groupId);
  return {
    order: teams.map((t) => t.code),
    matches: generateGroupMatches(groupId, teams.map((t) => t.code)),
    standings: [],
    is_valid: false,
  };
}

/**
 * Generate all 6 matches for a group of 4 teams (round-robin).
 */
function generateGroupMatches(
  groupId: string,
  teamCodes: string[]
): GroupMatchPrediction[] {
  const matches: GroupMatchPrediction[] = [];
  let matchId = getGroupStartMatchId(groupId);

  // Round-robin: each team plays every other team once
  // Standard FIFA order: MD1: 1v2, 3v4; MD2: 1v3, 4v2; MD3: 4v1, 2v3
  const [t1, t2, t3, t4] = teamCodes;
  const pairings = [
    [t1, t2], // MD1
    [t3, t4], // MD1
    [t1, t3], // MD2
    [t4, t2], // MD2
    [t4, t1], // MD3
    [t2, t3], // MD3
  ];

  for (const [home, away] of pairings) {
    matches.push({
      match_id: matchId++,
      home_team_code: home,
      away_team_code: away,
      home_goals: 0,
      away_goals: 0,
    });
  }

  return matches;
}

function getGroupStartMatchId(groupId: string): number {
  const groupIndex = groupId.charCodeAt(0) - "A".charCodeAt(0);
  return groupIndex * 6 + 1; // Groups have 6 matches each
}

// Initialize all 12 groups
function initializeGroups(): Record<string, GroupPrediction> {
  const groups: Record<string, GroupPrediction> = {};
  for (const letter of "ABCDEFGHIJKL") {
    groups[letter] = createEmptyGroupPrediction(letter);
  }
  return groups;
}

export const useBracketStore = create<BracketState & BracketActions>()(
  immer((set, get) => ({
    // State
    currentStep: "groups",
    groups: initializeGroups(),
    thirdPlaceQualifiers: [],
    knockoutTree: initialKnockoutTree,
    champion: null,
    isLocked: false,
    activeGroup: null,

    // Navigation
    setStep: (step) =>
      set((state) => {
        state.currentStep = step;
      }),

    setActiveGroup: (groupId) =>
      set((state) => {
        state.activeGroup = groupId;
      }),

    // Group stage — reorder teams
    setGroupOrder: (groupId, order) =>
      set((state) => {
        const group = state.groups[groupId];
        if (!group) return;
        group.order = order;
        // Recalculate and validate
        const teams = getGroupTeams(groupId);
        group.standings = calculateStandings(
          teams.map((t) => ({ id: t.id, code: t.code })),
          group.matches
        );
        group.is_valid = validateGroupOrder(order, group.standings);
      }),

    // Group stage — set match score
    setGroupMatchScore: (groupId, matchIndex, homeGoals, awayGoals) =>
      set((state) => {
        const group = state.groups[groupId];
        if (!group || !group.matches[matchIndex]) return;
        group.matches[matchIndex].home_goals = homeGoals;
        group.matches[matchIndex].away_goals = awayGoals;
        // Recalculate standings
        const teams = getGroupTeams(groupId);
        group.standings = calculateStandings(
          teams.map((t) => ({ id: t.id, code: t.code })),
          group.matches
        );
        group.is_valid = validateGroupOrder(group.order, group.standings);
      }),

    recalculateGroupStandings: (groupId) =>
      set((state) => {
        const group = state.groups[groupId];
        if (!group) return;
        const teams = getGroupTeams(groupId);
        group.standings = calculateStandings(
          teams.map((t) => ({ id: t.id, code: t.code })),
          group.matches
        );
        group.is_valid = validateGroupOrder(group.order, group.standings);
      }),

    // Third place
    toggleThirdPlaceQualifier: (groupId) =>
      set((state) => {
        const index = state.thirdPlaceQualifiers.indexOf(groupId);
        if (index >= 0) {
          state.thirdPlaceQualifiers.splice(index, 1);
        } else if (state.thirdPlaceQualifiers.length < 8) {
          state.thirdPlaceQualifiers.push(groupId);
        }
      }),

    // Knockout
    setKnockoutMatchResult: (stage, matchIndex, prediction) =>
      set((state) => {
        if (stage === "third_place") {
          state.knockoutTree.third_place = prediction;
        } else if (stage === "final") {
          state.knockoutTree.final = prediction;
          state.champion = prediction.winner_code;
        } else {
          const arr = state.knockoutTree[stage];
          if (Array.isArray(arr)) {
            arr[matchIndex] = prediction;
          }
        }
      }),

    // Lock
    lockBracket: () =>
      set((state) => {
        state.isLocked = true;
      }),

    // Reset
    resetBracket: () =>
      set((state) => {
        state.currentStep = "groups";
        state.groups = initializeGroups();
        state.thirdPlaceQualifiers = [];
        state.knockoutTree = initialKnockoutTree;
        state.champion = null;
        state.isLocked = false;
        state.activeGroup = null;
      }),

    // Computed: completion status
    getCompletionStatus: () => {
      const state = get();
      const validGroups = Object.values(state.groups).filter(
        (g) => g.is_valid
      ).length;

      return {
        groupsComplete: validGroups,
        totalGroups: 12,
        thirdPlaceComplete: state.thirdPlaceQualifiers.length === 8,
        knockoutComplete:
          state.knockoutTree.r32.length === 16 &&
          state.knockoutTree.r16.length === 8 &&
          state.knockoutTree.qf.length === 4 &&
          state.knockoutTree.sf.length === 2 &&
          state.knockoutTree.final !== null &&
          state.knockoutTree.third_place !== null,
        isFullyComplete:
          validGroups === 12 &&
          state.thirdPlaceQualifiers.length === 8 &&
          state.champion !== null,
      };
    },
  }))
);
