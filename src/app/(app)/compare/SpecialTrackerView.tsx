"use client";

// ===========================================================================
// Special-Bets Tracker
// Category-per-card live dashboard inside the compare page's "מיוחדים" tab.
// Pulls /api/tournament-stats (FD scorers + demo_match_results aggregates +
// tournament_actuals) and the already-loaded brackets/specialBets from
// useSharedData, then shows per-bettor on-track/hit indicators.
// ===========================================================================

import { useEffect, useState } from "react";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { getTeamByCode } from "@/lib/tournament/groups";
import { MATCHUPS } from "@/lib/matchups";
import type {
  BettorSpecialBets,
  BettorAdvancement,
} from "@/lib/supabase/shared-data";
import type {
  TournamentStatsPayload,
  ScorerRow,
  TeamGoalStats,
  GroupGoalStats,
} from "@/lib/tournament-stats";

// ---- Types coming from useSharedData ----
interface Bettor {
  userId: string;
  name: string;
  isYou: boolean;
}

interface Props {
  specialBets: BettorSpecialBets[];
  advancements: BettorAdvancement[];
  currentUserId: string | null;
}

type Status = "hit" | "leading" | "ontrack" | "listed" | "unlikely" | "empty" | "pending";

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    hit:       { label: "✓ תפס", cls: "bg-green-100 text-green-800 border-green-300" },
    leading:   { label: "🏆 מוביל", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    ontrack:   { label: "📈 בדרך", cls: "bg-blue-100 text-blue-800 border-blue-300" },
    listed:    { label: "📊 ברשימה", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    unlikely:  { label: "📉 רחוק", cls: "bg-gray-100 text-gray-500 border-gray-200" },
    empty:     { label: "— לא הימר", cls: "bg-gray-50 text-gray-400 border-gray-200" },
    pending:   { label: "⏳ ממתין", cls: "bg-gray-50 text-gray-500 border-gray-200" },
  };
  const m = map[status];
  return (
    <span className={`inline-block text-[10px] font-bold rounded-full border px-2 py-0.5 ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ---- Card wrapper ----
function CategoryCard({
  title,
  icon,
  subtitle,
  children,
  hitCount,
}: {
  title: string;
  icon: string;
  subtitle?: string;
  children: React.ReactNode;
  hitCount?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>
              {title}
            </h3>
            {subtitle && <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {typeof hitCount === "number" && hitCount > 0 && (
          <span className="shrink-0 text-[10px] font-bold bg-green-100 text-green-800 rounded-full px-2 py-0.5 border border-green-300">
            {hitCount} תפסו
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4 space-y-3">{children}</div>
    </div>
  );
}

// ---- Leader list (top 3-5 actual leaders of a category) ----
function LeaderList({
  items,
  emptyText = "עדיין אין נתונים",
}: {
  items: Array<{ label: string; sub?: string; value: string | number; flag?: string }>;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 py-1">{emptyText}</p>;
  }
  return (
    <div className="space-y-1">
      {items.map((it, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${
            i === 0 ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[10px] font-black w-5 text-center ${i === 0 ? "text-amber-700" : "text-gray-500"}`} style={{ fontFamily: "var(--font-inter)" }}>
              {i + 1}
            </span>
            {it.flag && <span className="text-base shrink-0">{it.flag}</span>}
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">{it.label}</p>
              {it.sub && <p className="text-[10px] text-gray-400 truncate">{it.sub}</p>}
            </div>
          </div>
          <span className="text-sm font-black text-gray-900 tabular-nums shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Per-bettor pick pill ----
interface BetRow {
  userId: string;
  name: string;
  pick: string;
  pickLabel: string;
  status: Status;
  isYou: boolean;
}

function BettorPickGrid({ rows }: { rows: BetRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 py-1">אין הימורים</p>;
  }
  // Sort: hit/leading → ontrack → listed → unlikely → empty
  const rank: Record<Status, number> = {
    hit: 0, leading: 1, ontrack: 2, listed: 3, pending: 4, unlikely: 5, empty: 6,
  };
  const sorted = [...rows].sort(
    (a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name, "he")
  );
  return (
    <div>
      <p className="text-[11px] text-gray-500 font-bold mb-1.5">הימורי המשתתפים:</p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((r) => (
          <div
            key={r.userId}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 border text-[11px] ${
              r.isYou ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200" : "bg-white border-gray-200"
            }`}
          >
            <span className="font-bold text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>
              {r.name}
            </span>
            {r.isYou && <span className="text-[9px] bg-blue-100 text-blue-600 rounded px-1">אתה</span>}
            <span className="text-gray-500 truncate max-w-[8rem]">{r.pickLabel || "—"}</span>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status resolvers per category
// ---------------------------------------------------------------------------

function playerStatus(
  pick: string | null,
  actual: string | null,
  top: ScorerRow[]
): Status {
  if (!pick || !pick.trim()) return "empty";
  if (actual && pick.trim().toLowerCase() === actual.trim().toLowerCase()) return "hit";
  if (top.length === 0) return "pending";
  const picked = pick.trim().toLowerCase();
  const idx = top.findIndex((s) => s.name.toLowerCase().includes(picked) || picked.includes(s.name.toLowerCase()));
  if (idx === 0) return "leading";
  if (idx >= 0 && idx < 3) return "ontrack";
  if (idx >= 0 && idx < 10) return "listed";
  return "unlikely";
}

function teamStatus(
  pick: string | null,
  actual: string | null,
  leaderboard: Array<{ code: string }>
): Status {
  if (!pick) return "empty";
  if (actual && pick === actual) return "hit";
  if (leaderboard.length === 0) return "pending";
  const idx = leaderboard.findIndex((t) => t.code === pick);
  if (idx === 0) return "leading";
  if (idx >= 0 && idx < 3) return "ontrack";
  if (idx >= 0 && idx < 6) return "listed";
  return "unlikely";
}

function groupStatus(
  pick: string | null,
  actual: string | null,
  leaderboard: GroupGoalStats[]
): Status {
  if (!pick) return "empty";
  if (actual && pick === actual) return "hit";
  if (leaderboard.length === 0) return "pending";
  const idx = leaderboard.findIndex((g) => g.letter === pick);
  if (idx === 0) return "leading";
  if (idx >= 0 && idx < 3) return "ontrack";
  if (idx >= 0 && idx < 6) return "listed";
  return "unlikely";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SpecialTrackerView({ specialBets, advancements, currentUserId }: Props) {
  const [stats, setStats] = useState<TournamentStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/tournament-stats");
        const data = (await res.json()) as TournamentStatsPayload;
        if (alive) setStats(data);
      } catch {
        /* keep null */
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-2" />
        <p className="text-sm text-gray-500">טוען סטטיסטיקות טורניר...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">נתונים חיים לא זמינים כרגע. נסו שוב בעוד רגע.</p>
      </div>
    );
  }

  // Build bettor list
  const bettorMap = new Map<string, Bettor>();
  for (const sb of specialBets) {
    bettorMap.set(sb.userId, {
      userId: sb.userId,
      name: sb.displayName || "ללא שם",
      isYou: sb.userId === currentUserId,
    });
  }
  for (const a of advancements) {
    if (!bettorMap.has(a.userId)) {
      bettorMap.set(a.userId, {
        userId: a.userId,
        name: a.displayName || "ללא שם",
        isYou: a.userId === currentUserId,
      });
    }
  }
  const bettors = Array.from(bettorMap.values());

  // ---- CATEGORY: Top scorer ----
  const topScorerRows: BetRow[] = bettors.map((b) => {
    const sb = specialBets.find((s) => s.userId === b.userId);
    const pick = sb?.topScorerPlayer ?? "";
    return {
      userId: b.userId,
      name: b.name,
      pick,
      pickLabel: pick || "—",
      status: playerStatus(pick, stats.actuals?.top_scorer_player ?? null, stats.scorers),
      isYou: b.isYou,
    };
  });
  const topScorerHits = topScorerRows.filter((r) => r.status === "hit" || r.status === "leading").length;
  const topScorerLeaders = stats.scorers.slice(0, 5).map((s) => ({
    label: s.name,
    sub: `${getFlag(s.team)} ${getTeamNameHe(s.team) || s.team}`,
    value: `${s.goals} שערים`,
  }));

  // ---- CATEGORY: Top assists ----
  const topAssistsRows: BetRow[] = bettors.map((b) => {
    const sb = specialBets.find((s) => s.userId === b.userId);
    const pick = sb?.topAssistsPlayer ?? "";
    return {
      userId: b.userId,
      name: b.name,
      pick,
      pickLabel: pick || "—",
      status: playerStatus(pick, stats.actuals?.top_assists_player ?? null, stats.assistsLeaders),
      isYou: b.isYou,
    };
  });
  const topAssistsHits = topAssistsRows.filter((r) => r.status === "hit" || r.status === "leading").length;
  const topAssistsLeaders = stats.assistsLeaders.slice(0, 5).map((s) => ({
    label: s.name,
    sub: `${getFlag(s.team)} ${getTeamNameHe(s.team) || s.team}`,
    value: `${s.assists} בישולים`,
  }));

  // ---- CATEGORY: Best attack (team most goals scored) ----
  const teamsByGoals: TeamGoalStats[] = stats.teamStats;
  const bestAttackRows: BetRow[] = bettors.map((b) => {
    const sb = specialBets.find((s) => s.userId === b.userId);
    const pick = sb?.bestAttackTeam ?? "";
    const team = pick ? getTeamByCode(pick) : null;
    return {
      userId: b.userId,
      name: b.name,
      pick,
      pickLabel: team ? `${getFlag(pick)} ${team.name_he}` : (pick || "—"),
      status: teamStatus(pick || null, stats.actuals?.best_attack_team ?? null, teamsByGoals),
      isYou: b.isYou,
    };
  });
  const bestAttackHits = bestAttackRows.filter((r) => r.status === "hit" || r.status === "leading").length;
  const bestAttackLeaders = teamsByGoals.slice(0, 5).map((t) => {
    const team = getTeamByCode(t.code);
    return {
      label: team ? team.name_he : t.code,
      value: `${t.goalsFor} שערים`,
      flag: getFlag(t.code),
    };
  });

  // ---- CATEGORY: Dirtiest team — admin-only source for now ----
  const dirtiestRows: BetRow[] = bettors.map((b) => {
    const sb = specialBets.find((s) => s.userId === b.userId);
    const pick = sb?.dirtiestTeam ?? "";
    const team = pick ? getTeamByCode(pick) : null;
    const actual = stats.actuals?.dirtiest_team ?? null;
    let status: Status = "empty";
    if (pick) {
      if (actual) status = pick === actual ? "hit" : "unlikely";
      else status = "pending";
    }
    return {
      userId: b.userId,
      name: b.name,
      pick,
      pickLabel: team ? `${getFlag(pick)} ${team.name_he}` : (pick || "—"),
      status,
      isYou: b.isYou,
    };
  });
  const dirtiestHits = dirtiestRows.filter((r) => r.status === "hit").length;
  const dirtiestActual = stats.actuals?.dirtiest_team;
  const dirtiestLeaders = dirtiestActual
    ? [{
        label: getTeamByCode(dirtiestActual)?.name_he || dirtiestActual,
        value: stats.actuals?.dirtiest_team_cards ? `${stats.actuals.dirtiest_team_cards} כרטיסים` : "סומן ע״י מנהל",
        flag: getFlag(dirtiestActual),
      }]
    : [];

  // ---- CATEGORY: Most prolific group ----
  const prolificRows: BetRow[] = bettors.map((b) => {
    const sb = specialBets.find((s) => s.userId === b.userId);
    const pick = sb?.prolificGroup ?? "";
    return {
      userId: b.userId,
      name: b.name,
      pick,
      pickLabel: pick ? `בית ${pick}` : "—",
      status: groupStatus(pick || null, stats.actuals?.most_prolific_group ?? null, stats.groupStats),
      isYou: b.isYou,
    };
  });
  const prolificHits = prolificRows.filter((r) => r.status === "hit" || r.status === "leading").length;
  const prolificLeaders = stats.groupStats.slice(0, 4).map((g) => ({
    label: `בית ${g.letter}`,
    value: `${g.goals} שערים (${g.matches} משחקים)`,
  }));

  // ---- CATEGORY: Driest group ----
  const driestRows: BetRow[] = bettors.map((b) => {
    const sb = specialBets.find((s) => s.userId === b.userId);
    const pick = sb?.driestGroup ?? "";
    return {
      userId: b.userId,
      name: b.name,
      pick,
      pickLabel: pick ? `בית ${pick}` : "—",
      // For driest: invert the leaderboard logic — fewest goals is best.
      status: (() => {
        if (!pick) return "empty" as Status;
        if (stats.actuals?.driest_group && pick === stats.actuals.driest_group) return "hit";
        if (stats.groupStats.length === 0) return "pending";
        const reversed = [...stats.groupStats].reverse();
        const idx = reversed.findIndex((g) => g.letter === pick);
        if (idx === 0) return "leading";
        if (idx >= 0 && idx < 3) return "ontrack";
        if (idx >= 0 && idx < 6) return "listed";
        return "unlikely";
      })(),
      isYou: b.isYou,
    };
  });
  const driestHits = driestRows.filter((r) => r.status === "hit" || r.status === "leading").length;
  const driestLeaders = [...stats.groupStats].reverse().slice(0, 4).map((g) => ({
    label: `בית ${g.letter}`,
    value: `${g.goals} שערים (${g.matches} משחקים)`,
  }));

  // ---- CATEGORY: Penalties over/under ----
  const penaltiesRows: BetRow[] = bettors.map((b) => {
    const sb = specialBets.find((s) => s.userId === b.userId);
    const pick = sb?.penaltiesOverUnder ?? "";
    const actual = stats.actuals?.penalties_over_under ?? null;
    let status: Status = "empty";
    if (pick) {
      if (actual) status = pick === actual ? "hit" : "unlikely";
      else status = "pending";
    }
    return {
      userId: b.userId,
      name: b.name,
      pick,
      pickLabel: pick === "OVER" ? "⬆ מעל 18.5" : pick === "UNDER" ? "⬇ מתחת 18.5" : "—",
      status,
      isYou: b.isYou,
    };
  });
  const penaltiesHits = penaltiesRows.filter((r) => r.status === "hit").length;
  const penaltiesSubtitle = stats.actuals?.total_penalties != null
    ? `סה״כ פנדלים עד כה: ${stats.actuals.total_penalties}`
    : undefined;

  // ---- CATEGORY: Matchups (3 duels) ----
  const matchupActuals: Array<"1" | "X" | "2" | null> = [
    stats.actuals?.matchup_result_1 ?? null,
    stats.actuals?.matchup_result_2 ?? null,
    stats.actuals?.matchup_result_3 ?? null,
  ];

  return (
    <div className="space-y-4">
      {/* Top stats strip */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50/60 via-white to-indigo-50/40 p-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-gray-700">מצב טורניר:</span>
        <span className="text-gray-600">⚽ {stats.finishedCount} משחקים הסתיימו</span>
        <span className="text-gray-600">🥇 {stats.scorers.length} כובשים ברשימה</span>
        {stats.actuals?.champion && (
          <span className="text-green-700 font-bold">
            👑 אלוף: {getFlag(stats.actuals.champion)} {getTeamByCode(stats.actuals.champion)?.name_he}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* TOP SCORER */}
        <CategoryCard
          icon="⚽"
          title="מלך השערים"
          subtitle="הכובש הגדול של הטורניר"
          hitCount={topScorerHits}
        >
          <LeaderList items={topScorerLeaders} emptyText="עדיין לא נכבשו שערים" />
          <BettorPickGrid rows={topScorerRows} />
        </CategoryCard>

        {/* TOP ASSISTS */}
        <CategoryCard
          icon="🎯"
          title="מלך הבישולים"
          subtitle="הכי הרבה אסיסטים"
          hitCount={topAssistsHits}
        >
          <LeaderList items={topAssistsLeaders} emptyText="עדיין לא נספרו בישולים" />
          <BettorPickGrid rows={topAssistsRows} />
        </CategoryCard>

        {/* BEST ATTACK */}
        <CategoryCard
          icon="🔥"
          title="נבחרת הכי התקפית"
          subtitle="הכי הרבה שערים שהבקיעה"
          hitCount={bestAttackHits}
        >
          <LeaderList items={bestAttackLeaders} emptyText="אין תוצאות עדיין" />
          <BettorPickGrid rows={bestAttackRows} />
        </CategoryCard>

        {/* DIRTIEST TEAM */}
        <CategoryCard
          icon="🟥"
          title="הנבחרת הכסחנית"
          subtitle="הכי הרבה כרטיסים (נקבע ע״י מנהל)"
          hitCount={dirtiestHits}
        >
          <LeaderList items={dirtiestLeaders} emptyText="המנהל עדיין לא סימן" />
          <BettorPickGrid rows={dirtiestRows} />
        </CategoryCard>

        {/* PROLIFIC GROUP */}
        <CategoryCard
          icon="🌶️"
          title="בית פורה"
          subtitle="הכי הרבה שערים בשלב הבתים"
          hitCount={prolificHits}
        >
          <LeaderList items={prolificLeaders} emptyText="עדיין אין מספיק משחקים" />
          <BettorPickGrid rows={prolificRows} />
        </CategoryCard>

        {/* DRIEST GROUP */}
        <CategoryCard
          icon="🏜️"
          title="בית יבש"
          subtitle="הכי מעט שערים בשלב הבתים"
          hitCount={driestHits}
        >
          <LeaderList items={driestLeaders} emptyText="עדיין אין מספיק משחקים" />
          <BettorPickGrid rows={driestRows} />
        </CategoryCard>

        {/* MATCHUPS (3 cards) */}
        {MATCHUPS.map((mu, i) => {
          const actual = matchupActuals[i];
          const duelRows: BetRow[] = bettors.map((b) => {
            const sb = specialBets.find((s) => s.userId === b.userId);
            const raw = sb?.matchupPick ?? "";
            const picks = raw.split(",");
            const pick = (picks[i] || "").toUpperCase();
            const pickLabel =
              pick === "1" ? mu.p1
              : pick === "2" ? mu.p2
              : pick === "X" ? "🤝 שווה"
              : "—";
            let status: Status = "empty";
            if (pick) {
              if (actual) status = pick === actual ? "hit" : "unlikely";
              else status = "pending";
            }
            return { userId: b.userId, name: b.name, pick, pickLabel, status, isYou: b.isYou };
          });
          const hits = duelRows.filter((r) => r.status === "hit").length;
          const actualLabel = actual === "1" ? mu.p1 : actual === "2" ? mu.p2 : actual === "X" ? "🤝 תיקו" : null;
          return (
            <CategoryCard
              key={mu.id}
              icon="🤼"
              title={`מאצ׳אפ: ${mu.p1} vs ${mu.p2}`}
              subtitle={actualLabel ? `תוצאה בפועל: ${actualLabel}` : "עדיין לא נסגר"}
              hitCount={hits}
            >
              <BettorPickGrid rows={duelRows} />
            </CategoryCard>
          );
        })}

        {/* PENALTIES */}
        <CategoryCard
          icon="⚖️"
          title="סה״כ פנדלים (מעל / מתחת 18.5)"
          subtitle={penaltiesSubtitle}
          hitCount={penaltiesHits}
        >
          {stats.actuals?.penalties_over_under && (
            <LeaderList
              items={[{
                label: stats.actuals.penalties_over_under === "OVER" ? "⬆ מעל 18.5" : "⬇ מתחת 18.5",
                value: stats.actuals.total_penalties ? `${stats.actuals.total_penalties} פנדלים` : "סומן ע״י מנהל",
              }]}
            />
          )}
          <BettorPickGrid rows={penaltiesRows} />
        </CategoryCard>
      </div>
    </div>
  );
}
