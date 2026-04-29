"use client";

// ============================================================================
// Special-Bets Tracker — compare page "הימורים מיוחדים" tab (live data view)
// ============================================================================
// One card per special-bet category. Each card shows:
//   1. Live leaderboard for that category (top N from Football-Data or
//      computed from demo_match_results or admin-entered actual).
//   2. Each bettor's pick + on-track badge (🏆 leading / 📈 top-3 /
//      📊 listed / 📉 behind / ✓ hit / ❌ not in running).
//
// Design language mirrors the rest of the compare page: rounded-2xl cards,
// blue-indigo gradient headers, Secular One for Hebrew, Inter for numbers.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { MATCHUPS } from "@/lib/matchups";
import type {
  TournamentStatsPayload,
  ScorerRow,
  TeamGoalStats,
  GroupGoalStats,
  TournamentActuals,
} from "@/lib/tournament-stats";

// -- Types ----------------------------------------------------------------

export interface BettorLike {
  userId: string;
  name: string;
  isYou?: boolean;
  // Mirror of special_bets fields
  topScorerPlayer: string | null;
  topAssistsPlayer: string | null;
  bestAttack: string | null;
  dirtiestTeam: string | null;
  prolificGroup: string | null;
  driestGroup: string | null;
  matchup1: "1" | "X" | "2" | null;
  matchup2: "1" | "X" | "2" | null;
  matchup3: "1" | "X" | "2" | null;
  penalties: "OVER" | "UNDER" | null;
}

type PickStatus = "hit" | "leading" | "onTrack" | "listed" | "behind" | "notInRace" | "tied" | "empty";

interface PickEval {
  userId: string;
  name: string;
  isYou?: boolean;
  pickLabel: string;
  status: PickStatus;
  note?: string; // e.g. "#3 במירוץ" or "5⚽"
}

// -- Helpers ----------------------------------------------------------------

function statusStyle(s: PickStatus): { bg: string; text: string; icon: string; label: string } {
  switch (s) {
    case "hit":       return { bg: "bg-green-100", text: "text-green-800", icon: "✓", label: "תפס!" };
    case "leading":   return { bg: "bg-emerald-50 border border-emerald-300", text: "text-emerald-800", icon: "🏆", label: "מוביל" };
    case "onTrack":   return { bg: "bg-amber-50 border border-amber-200", text: "text-amber-800", icon: "📈", label: "בדרך" };
    case "listed":    return { bg: "bg-blue-50/70 border border-blue-200", text: "text-blue-800", icon: "📊", label: "במירוץ" };
    case "tied":      return { bg: "bg-amber-50 border border-amber-200", text: "text-amber-800", icon: "🤝", label: "תיקו" };
    case "behind":    return { bg: "bg-orange-50/60 border border-orange-200", text: "text-orange-700", icon: "📉", label: "מאחור" };
    case "notInRace": return { bg: "bg-gray-50 border border-gray-200", text: "text-gray-500", icon: "❌", label: "לא במירוץ" };
    case "empty":     return { bg: "bg-gray-50 border border-dashed border-gray-200", text: "text-gray-400", icon: "—", label: "לא הימר" };
  }
}

function rankToStatus(rank: number | null, actualIsDecided: boolean, matchesPick: boolean): PickStatus {
  if (actualIsDecided) return matchesPick ? "hit" : "notInRace";
  if (rank === null) return "notInRace";
  if (rank === 1) return "leading";
  if (rank <= 3) return "onTrack";
  if (rank <= 10) return "listed";
  return "behind";
}

// -- Card primitives --------------------------------------------------------

function CategoryCard({
  title,
  subtitle,
  icon,
  leaders,
  picks,
  empty,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  leaders: Array<{ label: string; value: string; isActual?: boolean }>;
  picks: PickEval[];
  empty?: boolean;
}) {
  const hits = picks.filter((p) => p.status === "hit" || p.status === "leading").length;
  const onTrack = picks.filter((p) => p.status === "onTrack").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header — matches site style */}
      <div className="px-4 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {!empty && (
          <div className="flex items-center gap-1.5 text-[11px] shrink-0">
            {hits > 0 && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-bold">🏆 {hits}</span>}
            {onTrack > 0 && <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-bold">📈 {onTrack}</span>}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Current leaders */}
        {leaders.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide" style={{ fontFamily: "var(--font-inter)" }}>
              {empty ? "טרם נקבע" : "בראש המירוץ"}
            </p>
            <ol className="space-y-1">
              {leaders.slice(0, 5).map((l, i) => (
                <li
                  key={i}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${
                    i === 0 ? "bg-gradient-to-l from-amber-50 to-yellow-50 border border-amber-200" : "bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`text-[11px] font-black w-5 text-center ${i === 0 ? "text-amber-700" : "text-gray-400"}`} style={{ fontFamily: "var(--font-inter)" }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-bold text-gray-800 truncate">{l.label}</span>
                  </span>
                  <span className="text-xs font-bold text-gray-700 tabular-nums shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
                    {l.value}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Bettors' picks */}
        <div>
          <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide" style={{ fontFamily: "var(--font-inter)" }}>הימורי המשתתפים</p>
          <div className="flex flex-wrap gap-1.5">
            {picks.map((p) => {
              const s = statusStyle(p.status);
              return (
                <span
                  key={p.userId}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.bg} ${s.text} ${p.isYou ? "ring-1 ring-inset ring-blue-300" : ""}`}
                  title={`${p.name}: ${p.pickLabel} · ${s.label}${p.note ? ` · ${p.note}` : ""}`}
                >
                  <span className="shrink-0">{s.icon}</span>
                  <span style={{ fontFamily: "var(--font-secular)" }}>{p.name}</span>
                  {p.isYou && <span className="bg-blue-100 text-blue-700 rounded px-1 text-[9px]">אתה</span>}
                  <span className="text-gray-500 font-medium">· {p.pickLabel}</span>
                  {p.note && <span className="text-gray-400 text-[10px]">· {p.note}</span>}
                </span>
              );
            })}
            {picks.length === 0 && <span className="text-[11px] text-gray-400">אף מהמר לא בחר</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Per-category evaluators ------------------------------------------------

function evalPlayerPick(
  bettors: BettorLike[],
  getBettorPick: (b: BettorLike) => string | null,
  scorers: ScorerRow[],
  actualWinner: string | null,
  sortBy: "goals" | "assists"
): PickEval[] {
  const sorted = [...scorers].sort(
    (a, b) => (sortBy === "goals" ? b.goals - a.goals : b.assists - a.assists) ||
              (sortBy === "goals" ? b.assists - a.assists : b.goals - a.goals)
  );
  return bettors.map((b) => {
    const pick = getBettorPick(b);
    if (!pick) {
      return { userId: b.userId, name: b.name, isYou: b.isYou, pickLabel: "—", status: "empty" as PickStatus };
    }
    // Case-insensitive, partial-match lookup — stored names may differ slightly
    const normalized = pick.toLowerCase();
    const rankIdx = sorted.findIndex((s) => s.name.toLowerCase().includes(normalized) || normalized.includes(s.name.toLowerCase()));
    const found = rankIdx >= 0 ? sorted[rankIdx] : null;
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const actualDecided = !!actualWinner;
    const matches = actualWinner ? pick.toLowerCase().includes(actualWinner.toLowerCase()) || actualWinner.toLowerCase().includes(pick.toLowerCase()) : false;
    const status = rankToStatus(rank, actualDecided, matches);
    const metric = found ? `${sortBy === "goals" ? found.goals : found.assists}${sortBy === "goals" ? "⚽" : "🎯"}` : "";
    return {
      userId: b.userId,
      name: b.name,
      isYou: b.isYou,
      pickLabel: pick,
      status,
      note: rank ? `#${rank}${metric ? ` · ${metric}` : ""}` : (found ? metric : "לא רשום"),
    };
  });
}

function evalTeamPick(
  bettors: BettorLike[],
  getBettorPick: (b: BettorLike) => string | null,
  teamStats: TeamGoalStats[],
  actualWinner: string | null,
  sortBy: "goalsFor" | "cards" | "goalsAgainst",
  metricLabel: string
): PickEval[] {
  const sorted = [...teamStats].sort((a, b) => {
    if (sortBy === "goalsFor") return b.goalsFor - a.goalsFor;
    if (sortBy === "goalsAgainst") return b.goalsAgainst - a.goalsAgainst;
    return (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2);
  });
  return bettors.map((b) => {
    const pick = getBettorPick(b);
    if (!pick) {
      return { userId: b.userId, name: b.name, isYou: b.isYou, pickLabel: "—", status: "empty" as PickStatus };
    }
    const rankIdx = sorted.findIndex((t) => t.code === pick);
    const found = rankIdx >= 0 ? sorted[rankIdx] : null;
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const actualDecided = !!actualWinner;
    const matches = actualWinner === pick;
    const status = rankToStatus(rank, actualDecided, matches);
    const metric = found
      ? sortBy === "goalsFor" ? `${found.goalsFor}${metricLabel}` :
        sortBy === "goalsAgainst" ? `${found.goalsAgainst}${metricLabel}` :
        `${found.yellowCards}🟨 ${found.redCards}🟥`
      : "לא שיחקה";
    return {
      userId: b.userId,
      name: b.name,
      isYou: b.isYou,
      pickLabel: `${getFlag(pick)} ${getTeamNameHe(pick) || pick}`,
      status,
      note: rank ? `#${rank} · ${metric}` : metric,
    };
  });
}

function evalGroupPick(
  bettors: BettorLike[],
  getBettorPick: (b: BettorLike) => string | null,
  groupStats: GroupGoalStats[],
  actualWinner: string | null,
  sortOrder: "mostGoals" | "fewestGoals"
): PickEval[] {
  const sorted = [...groupStats].sort((a, b) => sortOrder === "mostGoals" ? b.goals - a.goals : a.goals - b.goals);
  return bettors.map((b) => {
    const pick = getBettorPick(b);
    if (!pick) {
      return { userId: b.userId, name: b.name, isYou: b.isYou, pickLabel: "—", status: "empty" as PickStatus };
    }
    const rankIdx = sorted.findIndex((g) => g.letter === pick);
    const found = rankIdx >= 0 ? sorted[rankIdx] : null;
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const actualDecided = !!actualWinner;
    const matches = actualWinner === pick;
    const status = rankToStatus(rank, actualDecided, matches);
    const metric = found ? `${found.goals}⚽ · ${found.matches} מש׳` : "טרם";
    return {
      userId: b.userId,
      name: b.name,
      isYou: b.isYou,
      pickLabel: `בית ${pick}`,
      status,
      note: rank ? `#${rank} · ${metric}` : metric,
    };
  });
}

function evalMatchupPick(
  bettors: BettorLike[],
  matchupIdx: 0 | 1 | 2,
  actualResult: "1" | "X" | "2" | null
): PickEval[] {
  const mu = MATCHUPS[matchupIdx];
  return bettors.map((b) => {
    const pick = ([b.matchup1, b.matchup2, b.matchup3] as const)[matchupIdx];
    if (!pick) {
      return { userId: b.userId, name: b.name, isYou: b.isYou, pickLabel: "—", status: "empty" as PickStatus };
    }
    const pickLabel = pick === "1" ? mu.p1Short : pick === "2" ? mu.p2Short : "שווה";
    if (!actualResult) {
      return { userId: b.userId, name: b.name, isYou: b.isYou, pickLabel, status: "listed" as PickStatus, note: "ממתין לתוצאה" };
    }
    const matches = pick === actualResult;
    return {
      userId: b.userId,
      name: b.name,
      isYou: b.isYou,
      pickLabel,
      status: matches ? ("hit" as PickStatus) : ("notInRace" as PickStatus),
    };
  });
}

function evalPenaltiesPick(
  bettors: BettorLike[],
  actualTotal: number | null,
  actualResult: "OVER" | "UNDER" | null,
  threshold = 18.5
): PickEval[] {
  return bettors.map((b) => {
    const pick = b.penalties;
    if (!pick) {
      return { userId: b.userId, name: b.name, isYou: b.isYou, pickLabel: "—", status: "empty" as PickStatus };
    }
    const pickLabel = pick === "OVER" ? `מעל ${threshold}` : `מתחת ${threshold}`;
    if (actualResult) {
      return {
        userId: b.userId,
        name: b.name,
        isYou: b.isYou,
        pickLabel,
        status: pick === actualResult ? "hit" : "notInRace",
        note: actualTotal != null ? `בפועל: ${actualTotal}` : undefined,
      };
    }
    if (actualTotal == null) {
      return { userId: b.userId, name: b.name, isYou: b.isYou, pickLabel, status: "listed", note: "טרם הוכרע" };
    }
    const currentlyOver = actualTotal > threshold;
    const onTrack = (pick === "OVER" && currentlyOver) || (pick === "UNDER" && !currentlyOver);
    return {
      userId: b.userId,
      name: b.name,
      isYou: b.isYou,
      pickLabel,
      status: onTrack ? "onTrack" : "behind",
      note: `בפועל: ${actualTotal}`,
    };
  });
}

// -- Main component ---------------------------------------------------------

import type { BettorSpecialBets } from "@/lib/supabase/shared-data";

export function SpecialTrackerView({
  bettors,
  specialBets,
  currentUserId,
}: {
  bettors?: BettorLike[];
  specialBets?: BettorSpecialBets[];
  currentUserId?: string | null;
}) {
  // Build the BettorLike list from either an explicit `bettors` prop (legacy
  // callers) or the raw shared-data specialBets array (preferred).
  const normalizedBettors: BettorLike[] = useMemo(() => {
    if (bettors && bettors.length > 0) return bettors;
    if (!specialBets) return [];
    return specialBets.map<BettorLike>((sb) => {
      const parts = (sb.matchupPick ?? "").split(",");
      return {
        userId: sb.userId,
        name: sb.displayName || "ללא שם",
        isYou: sb.userId === currentUserId,
        topScorerPlayer: sb.topScorerPlayer,
        topAssistsPlayer: sb.topAssistsPlayer,
        bestAttack: sb.bestAttackTeam,
        dirtiestTeam: sb.dirtiestTeam,
        prolificGroup: sb.prolificGroup,
        driestGroup: sb.driestGroup,
        matchup1: (parts[0] as "1" | "X" | "2" | null) || null,
        matchup2: (parts[1] as "1" | "X" | "2" | null) || null,
        matchup3: (parts[2] as "1" | "X" | "2" | null) || null,
        penalties: (sb.penaltiesOverUnder as "OVER" | "UNDER" | null) || null,
      };
    });
  }, [bettors, specialBets, currentUserId]);

  const [stats, setStats] = useState<TournamentStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/tournament-stats");
        const data = await res.json();
        if (!alive) return;
        if ("error" in data) {
          setError(String(data.error));
        } else {
          setStats(data as TournamentStatsPayload);
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const cards = useMemo(() => {
    if (!stats) return null;
    const actuals: TournamentActuals | null = stats.actuals;
    const bettorsEval = normalizedBettors;

    // Category 1: Top scorer (player)
    const topScorer = {
      title: "מלך שערים",
      subtitle: actuals?.top_scorer_player ? `בפועל: ${actuals.top_scorer_player}` : "מי יסיים עם הכי הרבה גולים",
      icon: "⚽",
      leaders: stats.scorers.slice(0, 5).map((s) => ({
        label: `${getFlag(s.team)} ${s.name}`,
        value: `${s.goals}⚽`,
      })),
      picks: evalPlayerPick(bettorsEval, (b) => b.topScorerPlayer, stats.scorers, actuals?.top_scorer_player ?? null, "goals"),
      empty: stats.scorers.length === 0,
    };

    // Category 2: Top assists
    const topAssists = {
      title: "מלך בישולים",
      subtitle: actuals?.top_assists_player ? `בפועל: ${actuals.top_assists_player}` : "מי יסיים עם הכי הרבה בישולים",
      icon: "🎯",
      leaders: stats.assistsLeaders.slice(0, 5).map((s) => ({
        label: `${getFlag(s.team)} ${s.name}`,
        value: `${s.assists}🎯`,
      })),
      picks: evalPlayerPick(bettorsEval, (b) => b.topAssistsPlayer, stats.assistsLeaders, actuals?.top_assists_player ?? null, "assists"),
      empty: stats.assistsLeaders.length === 0,
    };

    // Category 3: Best attack (team with most goals)
    const bestAttack = {
      title: "ההתקפה הכי פורייה",
      subtitle: actuals?.best_attack_team ? `בפועל: ${actuals.best_attack_team}` : "הנבחרת שכבשה הכי הרבה",
      icon: "🔥",
      leaders: stats.teamStats.slice(0, 5).map((t) => ({
        label: `${getFlag(t.code)} ${getTeamNameHe(t.code) || t.code}`,
        value: `${t.goalsFor}⚽`,
      })),
      picks: evalTeamPick(bettorsEval, (b) => b.bestAttack, stats.teamStats, actuals?.best_attack_team ?? null, "goalsFor", "⚽"),
      empty: stats.teamStats.length === 0,
    };

    // Category 4: Dirtiest team (most cards)
    const dirtiestRows = [...stats.teamStats].sort((a, b) =>
      (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2)
    );
    const dirtiest = {
      title: "הכסחנית של הטורניר",
      subtitle: actuals?.dirtiest_team ? `בפועל: ${actuals.dirtiest_team}` : "הכי הרבה כרטיסים",
      icon: "🟨",
      leaders: dirtiestRows.slice(0, 5).map((t) => ({
        label: `${getFlag(t.code)} ${getTeamNameHe(t.code) || t.code}`,
        value: `${t.yellowCards}🟨 ${t.redCards}🟥`,
      })),
      picks: evalTeamPick(bettorsEval, (b) => b.dirtiestTeam, dirtiestRows, actuals?.dirtiest_team ?? null, "cards", "כרטיסים"),
      empty: stats.teamStats.length === 0,
    };

    // Category 5: Most prolific group
    const prolific = {
      title: "הבית הכי פורה",
      subtitle: actuals?.most_prolific_group ? `בפועל: בית ${actuals.most_prolific_group}` : "הכי הרבה שערים בבית",
      icon: "🎉",
      leaders: stats.groupStats.slice(0, 5).map((g) => ({
        label: `בית ${g.letter}`,
        value: `${g.goals}⚽ · ${g.matches} מש׳`,
      })),
      picks: evalGroupPick(bettorsEval, (b) => b.prolificGroup, stats.groupStats, actuals?.most_prolific_group ?? null, "mostGoals"),
      empty: stats.groupStats.length === 0,
    };

    // Category 6: Driest group (fewest goals)
    const driestGroups = [...stats.groupStats].sort((a, b) => a.goals - b.goals);
    const driest = {
      title: "הבית הכי יבש",
      subtitle: actuals?.driest_group ? `בפועל: בית ${actuals.driest_group}` : "הכי פחות שערים בבית",
      icon: "🏜️",
      leaders: driestGroups.slice(0, 5).map((g) => ({
        label: `בית ${g.letter}`,
        value: `${g.goals}⚽ · ${g.matches} מש׳`,
      })),
      picks: evalGroupPick(bettorsEval, (b) => b.driestGroup, driestGroups, actuals?.driest_group ?? null, "fewestGoals"),
      empty: stats.groupStats.length === 0,
    };

    // Categories 7-9: Matchup duels
    const matchup1 = {
      title: `${MATCHUPS[0].flag1} ${MATCHUPS[0].p1Short} vs ${MATCHUPS[0].p2Short} ${MATCHUPS[0].flag2}`,
      subtitle: "שערים + בישולים במונדיאל",
      icon: "🤺",
      leaders: [] as Array<{ label: string; value: string }>,
      picks: evalMatchupPick(bettorsEval, 0, actuals?.matchup_result_1 ?? null),
      empty: true,
    };
    const matchup2 = {
      title: `${MATCHUPS[1].flag1} ${MATCHUPS[1].p1Short} vs ${MATCHUPS[1].p2Short} ${MATCHUPS[1].flag2}`,
      subtitle: "שערים + בישולים במונדיאל",
      icon: "🤺",
      leaders: [],
      picks: evalMatchupPick(bettorsEval, 1, actuals?.matchup_result_2 ?? null),
      empty: true,
    };
    const matchup3 = {
      title: `${MATCHUPS[2].flag1} ${MATCHUPS[2].p1Short} vs ${MATCHUPS[2].p2Short} ${MATCHUPS[2].flag2}`,
      subtitle: "שערים + בישולים במונדיאל",
      icon: "🤺",
      leaders: [],
      picks: evalMatchupPick(bettorsEval, 2, actuals?.matchup_result_3 ?? null),
      empty: true,
    };

    // Category 10: Penalties total over/under
    const penalties = {
      title: "סה״כ פנדלים · מעל/מתחת 18.5",
      subtitle: actuals?.penalties_over_under ? `הוכרע: ${actuals.penalties_over_under === "OVER" ? "מעל" : "מתחת"}` : undefined,
      icon: "🎯",
      leaders: actuals?.total_penalties != null ? [{ label: "בפועל עד כה", value: `${actuals.total_penalties} פנדלים` }] : [],
      picks: evalPenaltiesPick(bettorsEval, actuals?.total_penalties ?? null, actuals?.penalties_over_under ?? null, 18.5),
      empty: actuals?.total_penalties == null && !actuals?.penalties_over_under,
    };

    return [topScorer, topAssists, bestAttack, dirtiest, prolific, driest, matchup1, matchup2, matchup3, penalties];
  }, [stats, normalizedBettors]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-2" />
        <p className="text-sm text-gray-500">טוען נתוני טורניר...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 text-center">
        <p className="text-sm text-amber-800 font-bold mb-1">בעיה בטעינת נתוני טורניר</p>
        <p className="text-xs text-amber-700">{error}</p>
      </div>
    );
  }

  if (!cards) return null;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-l from-blue-50 via-white to-indigo-50/40 border border-blue-100/60 rounded-2xl px-4 py-3 text-sm">
        <p className="font-bold text-gray-800">מעקב הימורים מיוחדים</p>
        <p className="text-xs text-gray-500 mt-0.5">
          הנתונים מתעדכנים מ-Football-Data בכל 5 דקות. ערכים שמנהל הזין ידנית ב-
          <code className="bg-gray-100 rounded px-1 text-[10px]">תוצאות משחקים</code>
          {" "}נלקחים כאמת המחייבת.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c, i) => (
          <CategoryCard key={i} {...c} />
        ))}
      </div>
    </div>
  );
}
