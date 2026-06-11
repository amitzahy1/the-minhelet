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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { MATCHUPS } from "@/lib/matchups";
import { GROUPS } from "@/lib/tournament/groups";
import { PENALTIES_LINE } from "@/lib/constants";
import { useScoring } from "@/hooks/useScoring";
import { DEMO_BETTORS, DEMO_STATS } from "./special-tracker-demo";
import type {
  TournamentStatsPayload,
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
  /** Champion pick (advancement_picks.winner) — shown as its own card. */
  champion?: string | null;
}

type PickStatus = "hit" | "leading" | "onTrack" | "listed" | "behind" | "notInRace" | "tied" | "empty";

interface BettorChip {
  userId: string;
  name: string;
  isYou?: boolean;
  status: PickStatus;
}

// One option line in a card: the contender (player / team / group / choice),
// its current standing, and the participants who bet on it shown right beside it.
interface OptionRow {
  key: string;
  label: ReactNode;
  sub?: ReactNode;    // tiny secondary line under the name (e.g. group teams)
  value2?: ReactNode; // optional leading metric (e.g. weighted dirtiness score)
  value?: ReactNode;  // main metric cell (number, or a card breakdown)
  rank?: number | null;
  decided?: boolean;  // this option is the confirmed actual result
  bettors: BettorChip[];
}

// -- Helpers ----------------------------------------------------------------

// Each participant gets ONE fixed color across every card, so you can scan a
// single friend top-to-bottom. Pastel bg + dark text — same family as the
// compare page. Status (hit / miss / leading) is conveyed by the row instead:
// the settled row is green-tinted and misses are dimmed.
const PERSON_COLORS: { bg: string; text: string }[] = [
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-amber-100", text: "text-amber-900" },
  { bg: "bg-purple-100", text: "text-purple-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-cyan-100", text: "text-cyan-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-lime-100", text: "text-lime-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
  { bg: "bg-sky-100", text: "text-sky-800" },
];
const NEUTRAL_COLOR = { bg: "bg-gray-100", text: "text-gray-600" };

// "עודכן לפני X" relative label. Client-clock based; fine for a freshness hint.
function relTime(d: Date | null | undefined): string {
  if (!d) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דק׳`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `לפני ${hr} שע׳`;
  return `לפני ${Math.round(hr / 24)} ימים`;
}

// "אתה" always leads the chip list on a row, so you spot yourself instantly.
const pinYouFirst = (a: BettorChip, b: BettorChip) => (b.isYou ? 1 : 0) - (a.isYou ? 1 : 0);

function rankToStatus(rank: number | null, actualIsDecided: boolean, matchesPick: boolean): PickStatus {
  if (actualIsDecided) return matchesPick ? "hit" : "notInRace";
  // While the bet is still open, a pick that isn't on the current board yet
  // (no goals/cards recorded) is just "listed" — NOT dimmed. Dimming
  // (notInRace → opacity-50) is reserved for actual misses after the result
  // is decided; fading someone's pick mid-race read as "already lost".
  if (rank === null) return "listed";
  if (rank === 1) return "leading";
  if (rank <= 3) return "onTrack";
  if (rank <= 10) return "listed";
  return "behind";
}

// -- Card primitives --------------------------------------------------------

function CategoryCard({
  title,
  points,
  statusLine,
  decidedLabel,
  updatedAt,
  nameHeader,
  valueHeader2,
  valueHeader,
  rows,
  notBetCount,
  footNote,
  colorOf,
}: {
  title: string;
  points: string;              // e.g. "9 / 5 נק׳" or "5 נק׳"
  statusLine?: string;         // live state shown inline, e.g. "12 פנדלים"
  decidedLabel?: string;       // short result line when the bet is settled
  updatedAt?: Date | null;
  nameHeader: string;          // column header for the contender
  valueHeader2?: string;       // optional leading metric column (right of valueHeader)
  valueHeader?: string;        // column header for the metric (omit = no value column)
  rows: OptionRow[];
  notBetCount?: number;
  footNote?: string;           // tiny legend, e.g. card weighting
  colorOf: (userId: string) => { bg: string; text: string };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Title bar */}
      <div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex items-baseline gap-2">
          <h3 className="text-base sm:text-lg font-black text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>{title}</h3>
          <span className="shrink-0 text-[10px] font-bold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{points}</span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          {statusLine && <span className="text-[11px] font-bold text-gray-600 whitespace-nowrap">{statusLine}</span>}
          {decidedLabel && <span className="text-[11px] font-bold text-green-700 truncate max-w-[9rem]">{decidedLabel}</span>}
          {updatedAt && <span className="text-[10px] text-gray-400 whitespace-nowrap">עודכן {relTime(updatedAt)}</span>}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-5 text-center text-[11px] text-gray-400 border-t border-gray-100">אין נתונים עדיין</p>
      ) : (
        <table className="w-full text-sm border-t border-gray-100">
          <thead>
            <tr className="text-[10px] font-bold text-gray-400 bg-gray-50/60" style={{ fontFamily: "var(--font-inter)" }}>
              <th className="w-6 py-1.5 text-center font-bold">#</th>
              <th className="py-1.5 px-2 text-start font-bold whitespace-nowrap">{nameHeader}</th>
              {valueHeader2 && <th className="py-1.5 px-2 text-center font-bold whitespace-nowrap">{valueHeader2}</th>}
              {valueHeader && <th className="py-1.5 px-2 text-center font-bold whitespace-nowrap">{valueHeader}</th>}
              <th className="w-full py-1.5 px-2 text-end font-bold">מהמרים</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr key={row.key} className={row.decided ? "bg-green-50/60" : ""}>
                <td className="py-2 text-center text-[11px] font-black text-gray-300 tabular-nums align-middle" style={{ fontFamily: "var(--font-inter)" }}>
                  {row.rank ?? ""}
                </td>
                <td className="py-2 px-2 align-middle">
                  <div className={`font-bold leading-tight whitespace-nowrap ${row.decided ? "text-green-900" : "text-gray-800"}`}>{row.label}</div>
                  {row.sub && <div className="text-[10px] text-gray-400 leading-tight mt-0.5 whitespace-nowrap">{row.sub}</div>}
                </td>
                {valueHeader2 && (
                  <td className={`py-2 px-2 text-center align-middle tabular-nums text-base font-black whitespace-nowrap ${row.decided ? "text-green-700" : "text-gray-900"}`} style={{ fontFamily: "var(--font-inter)" }}>
                    {row.value2 ?? ""}
                  </td>
                )}
                {valueHeader && (
                  <td className={`py-2 px-2 text-center align-middle tabular-nums whitespace-nowrap ${valueHeader2 ? "text-xs font-medium" : "text-base font-bold"} ${row.decided ? "text-green-700" : valueHeader2 ? "text-gray-500" : "text-gray-900"}`} style={{ fontFamily: "var(--font-inter)" }}>
                    {row.value ?? ""}
                  </td>
                )}
                <td className="py-2 px-2 align-middle">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {row.bettors.map((bt) => {
                      const c = colorOf(bt.userId);
                      const miss = bt.status === "notInRace";
                      return (
                        <span
                          key={bt.userId}
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text} ${miss ? "opacity-50" : ""} ${bt.isYou ? "ring-2 ring-inset ring-blue-500" : ""}`}
                          style={{ fontFamily: "var(--font-secular)" }}
                        >
                          {bt.name}
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(footNote || (notBetCount ?? 0) > 0) && (
        <p className="px-4 py-1.5 text-[10px] text-gray-400 border-t border-gray-50 flex items-center justify-between gap-2">
          <span>{footNote}</span>
          {(notBetCount ?? 0) > 0 ? <span className="shrink-0">{notBetCount} טרם בחרו</span> : null}
        </p>
      )}
    </div>
  );
}

// Group bettors under each contender. Ranked categories (scorer, team, group)
// pass the full standings; choice categories (matchups, penalties) pass fixed
// options. Picks outside the top rows are appended so no participant is hidden.
function buildRankedRows(opts: {
  bettors: BettorLike[];
  getPick: (b: BettorLike) => string | null;
  ranked: { key: string; label: ReactNode; sub?: ReactNode; value2?: ReactNode; value?: ReactNode }[];
  topN: number;
  actualKey: string | null;
  fuzzy?: boolean;
}): { rows: OptionRow[]; notBet: number } {
  const { bettors, getPick, ranked, topN, actualKey, fuzzy } = opts;
  const eq = (a: string, b: string) =>
    fuzzy ? a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase()) : a === b;
  const rankOf = (key: string) => {
    const i = ranked.findIndex((r) => eq(r.key, key));
    return i >= 0 ? i + 1 : null;
  };
  const picks = bettors
    .map((b) => ({ b, pick: getPick(b) }))
    .filter((x): x is { b: BettorLike; pick: string } => !!x.pick);
  const notBet = bettors.length - picks.length;
  const chip = (b: BettorLike, pick: string): BettorChip => ({
    userId: b.userId,
    name: b.name,
    isYou: b.isYou,
    status: rankToStatus(rankOf(pick), actualKey != null, actualKey != null && eq(pick, actualKey)),
  });

  const rows: OptionRow[] = [];
  const shown: string[] = [];
  for (const r of ranked.slice(0, topN)) {
    shown.push(r.key);
    rows.push({
      key: r.key,
      label: r.label,
      sub: r.sub,
      value2: r.value2,
      value: r.value,
      rank: rankOf(r.key),
      decided: actualKey != null && eq(r.key, actualKey),
      bettors: picks.filter((p) => eq(p.pick, r.key)).map((p) => chip(p.b, p.pick)).sort(pinYouFirst),
    });
  }
  // Picked options that aren't in the top rows — append so nobody is hidden.
  const extra: string[] = [];
  for (const p of picks) {
    if (shown.some((k) => eq(k, p.pick)) || extra.some((k) => eq(k, p.pick))) continue;
    extra.push(p.pick);
    const entry = ranked.find((r) => eq(r.key, p.pick));
    rows.push({
      key: `x:${p.pick}`,
      label: entry ? entry.label : p.pick,
      sub: entry?.sub,
      value2: entry?.value2,
      value: entry?.value,
      rank: rankOf(p.pick),
      decided: actualKey != null && eq(p.pick, actualKey),
      bettors: picks.filter((q) => eq(q.pick, p.pick)).map((q) => chip(q.b, q.pick)).sort(pinYouFirst),
    });
  }
  // League owner's ordering: most-picked option first; the actual-standings
  // order is preserved as the tiebreaker (stable sort).
  rows.sort((a, b) => b.bettors.length - a.bettors.length);
  return { rows, notBet };
}

function buildChoiceRows(opts: {
  bettors: BettorLike[];
  getPick: (b: BettorLike) => string | null;
  options: { key: string; label: ReactNode; value2?: ReactNode; value?: ReactNode }[];
  actualKey: string | null;
}): { rows: OptionRow[]; notBet: number } {
  const { bettors, getPick, options, actualKey } = opts;
  const picks = bettors
    .map((b) => ({ b, pick: getPick(b) }))
    .filter((x): x is { b: BettorLike; pick: string } => !!x.pick);
  const rows = options.map<OptionRow>((o) => ({
    key: o.key,
    label: o.label,
    value2: o.value2,
    value: o.value,
    decided: actualKey != null && o.key === actualKey,
    bettors: picks
      .filter((p) => p.pick === o.key)
      .map((p) => ({
        userId: p.b.userId,
        name: p.b.name,
        isYou: p.b.isYou,
        status: actualKey != null ? (p.pick === actualKey ? "hit" : "notInRace") : ("listed" as PickStatus),
      }))
      .sort(pinYouFirst),
  }));
  // Most-picked option first (stable: fixed option order breaks ties).
  rows.sort((a, b) => b.bettors.length - a.bettors.length);
  return { rows, notBet: bettors.length - picks.length };
}

// -- Main component ---------------------------------------------------------

import type { BettorSpecialBets, BettorAdvancement } from "@/lib/supabase/shared-data";

export function SpecialTrackerView({
  bettors,
  specialBets,
  advancements,
  currentUserId,
  started = true,
}: {
  bettors?: BettorLike[];
  specialBets?: BettorSpecialBets[];
  /** Advancement picks — supplies each bettor's champion pick for the זוכה card. */
  advancements?: BettorAdvancement[];
  currentUserId?: string | null;
  started?: boolean; // false = tournament hasn't kicked off → hide picks
}) {
  // Dev-only design preview: ?demo=1 swaps in fake bettors + tournament stats
  // so the full card design renders before any real data exists. Ignored in
  // production so real users never see fake data.
  const scoring = useScoring();
  const isDemo = useMemo(
    () =>
      typeof window !== "undefined" &&
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).has("demo"),
    [],
  );

  // Build the BettorLike list from either an explicit `bettors` prop (legacy
  // callers) or the raw shared-data specialBets array (preferred).
  const normalizedBettors: BettorLike[] = useMemo(() => {
    if (isDemo) return DEMO_BETTORS;
    if (bettors && bettors.length > 0) return bettors;
    if (!specialBets) return [];
    const championOf = new Map((advancements ?? []).map((a) => [a.userId, a.winner || null]));
    return specialBets.map<BettorLike>((sb) => {
      const parts = (sb.matchupPick ?? "").split(",");
      return {
        userId: sb.userId,
        name: sb.displayName || "ללא שם",
        isYou: sb.userId === currentUserId,
        champion: championOf.get(sb.userId) ?? null,
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
  }, [isDemo, bettors, specialBets, advancements, currentUserId]);

  // Fixed color per participant (stable by userId), reused on every card.
  const colorOf = useMemo(() => {
    const ordered = [...normalizedBettors].sort((a, b) => a.userId.localeCompare(b.userId));
    const map = new Map<string, { bg: string; text: string }>();
    ordered.forEach((b, i) => map.set(b.userId, PERSON_COLORS[i % PERSON_COLORS.length]));
    return (userId: string) => map.get(userId) ?? NEUTRAL_COLOR;
  }, [normalizedBettors]);

  const [stats, setStats] = useState<TournamentStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (isDemo) {
      setStats(DEMO_STATS);
      setFetchedAt(new Date());
      setLoading(false);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/tournament-stats", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if ("error" in data) {
          setError(String(data.error));
        } else {
          setStats(data as TournamentStatsPayload);
          setFetchedAt(new Date());
          setError(null);
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
      if (alive) setLoading(false);
    };
    load();
    // Refresh every 10 min while the tab is visible. Special bets are slow-moving
    // tournament aggregates, so 10 min is plenty (and matches the upstream cache).
    // Skipped when hidden so idle background tabs don't poll.
    const id = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") load();
    }, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [isDemo]);

  const cards = useMemo(() => {
    if (!stats) return null;
    const actuals: TournamentActuals | null = stats.actuals;
    const bs = normalizedBettors;
    // Player races refresh live (data fetch time); admin-decided results carry
    // their own edit time. Demo offsets them so the "עודכן" hint is visible.
    const liveAt = isDemo ? new Date(Date.now() - 3 * 60000) : fetchedAt;
    const actRaw = actuals as (TournamentActuals & { updated_at?: string }) | null;
    const actAt = isDemo
      ? new Date(Date.now() - 125 * 60000)
      : actRaw?.updated_at ? new Date(actRaw.updated_at) : fetchedAt;

    const flagName = (code: string) => <span>{getFlag(code)} {getTeamNameHe(code) || code}</span>;
    const playerLabel = (name: string, team: string) => <span>{getFlag(team)} {name}</span>;
    // Tiny "MEX · KOR · CZE · RSA" roster line under each group row.
    const groupTeams = (letter: string) => (GROUPS[letter] || []).map((t) => t.code).join(" · ");
    // Card-weighting for "dirtiest": yellow = 1, red = 3 (canonical — matches
    // the rules page). A second yellow in the same match is counted as ONE red,
    // not two yellows; a genuine yellow + direct red counts as both. See the
    // rules page (הנבחרת הכסחנית) for the full card-counting convention.
    const RED_W = 3, YEL_W = 1;
    const cardVal = (y: number, r: number) => (
      <span className="leading-tight">
        <span>{y}</span><span className="text-[9px] text-gray-400"> צ׳</span>
        {" · "}
        <span>{r}</span><span className="text-[9px] text-gray-400"> א׳</span>
      </span>
    );
    // Live goals/assists for a matchup player (fuzzy name match against scorers).
    const playerStat = (name: string) => {
      const s = stats.scorers.find((x) => x.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(x.name.toLowerCase()));
      return { g: s?.goals ?? 0, a: s?.assists ?? 0 };
    };
    // Inline "Xש · Yב" breakdown for the matchup value column — ש (שערים) + ב
    // (בישולים) to match the "ש+ב" column header.
    const gaCell = (g: number, a: number) => (
      <span className="leading-tight whitespace-nowrap">
        <span>{g}</span><span className="text-[9px] text-gray-400"> ש׳</span>
        {" · "}
        <span>{a}</span><span className="text-[9px] text-gray-400"> ב׳</span>
      </span>
    );

    const scorerRanked = [...stats.scorers].sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .map((s) => ({ key: s.name, label: playerLabel(s.name, s.team), value: `${s.goals}` }));
    const assistRanked = [...stats.assistsLeaders].sort((a, b) => b.assists - a.assists || b.goals - a.goals)
      .map((s) => ({ key: s.name, label: playerLabel(s.name, s.team), value: `${s.assists}` }));
    const attackRanked = [...stats.teamStats].sort((a, b) => b.goalsFor - a.goalsFor)
      .map((t) => ({ key: t.code, label: flagName(t.code), value: `${t.goalsFor}` }));
    // Dirtiest: ranked by a weighted score (red counts triple). value2 = the
    // weighted score (headline), value = the yellow/red breakdown. There's no
    // automatic card feed, so the admin maintains `dirtiest_board`; fall back to
    // teamStats (zeros) only if the board is empty.
    const dirtyBoard = actuals?.dirtiest_board ?? [];
    const dirtySource = dirtyBoard.length
      ? dirtyBoard.map((r) => ({ code: r.team, yellowCards: r.yellow, redCards: r.red }))
      : stats.teamStats.map((t) => ({ code: t.code, yellowCards: t.yellowCards, redCards: t.redCards }));
    const dirtyRanked = [...dirtySource].sort((a, b) => (b.yellowCards * YEL_W + b.redCards * RED_W) - (a.yellowCards * YEL_W + a.redCards * RED_W))
      .map((t) => ({ key: t.code, label: flagName(t.code), value2: `${t.yellowCards * YEL_W + t.redCards * RED_W}`, value: cardVal(t.yellowCards, t.redCards) }));
    const prolificRanked = [...stats.groupStats].sort((a, b) => b.goals - a.goals)
      .map((g) => ({ key: g.letter, label: `בית ${g.letter}`, sub: groupTeams(g.letter), value: `${g.goals}` }));
    const driestRanked = [...stats.groupStats].sort((a, b) => a.goals - b.goals)
      .map((g) => ({ key: g.letter, label: `בית ${g.letter}`, sub: groupTeams(g.letter), value: `${g.goals}` }));

    const sp = scoring.specials;
    type RankList = { key: string; label: ReactNode; sub?: ReactNode; value2?: ReactNode; value?: ReactNode }[];
    const ranked = (o: {
      title: string; points: string; nameHeader: string; valueHeader?: string; valueHeader2?: string;
      updatedAt: Date | null; getPick: (b: BettorLike) => string | null; list: RankList;
      actualKey: string | null; fuzzy?: boolean; decidedLabel?: string; footNote?: string;
    }) => {
      const { rows, notBet } = buildRankedRows({ bettors: bs, getPick: o.getPick, ranked: o.list, topN: 5, actualKey: o.actualKey, fuzzy: o.fuzzy });
      return {
        title: o.title, points: o.points, nameHeader: o.nameHeader, valueHeader: o.valueHeader, valueHeader2: o.valueHeader2,
        updatedAt: o.updatedAt, rows, notBetCount: notBet, footNote: o.footNote,
        decided: o.actualKey != null, decidedLabel: o.actualKey ? o.decidedLabel : undefined,
      };
    };

    const matchupCard = (i: 0 | 1 | 2, actualKey: "1" | "X" | "2" | null) => {
      const mu = MATCHUPS[i];
      const s1 = playerStat(mu.name1), s2 = playerStat(mu.name2);
      const t1 = s1.g + s1.a, t2 = s2.g + s2.a;
      const p1Opt = { key: "1", label: `${mu.flag1} ${mu.p1Short}`, value2: `${t1}`, value: gaCell(s1.g, s1.a) };
      const p2Opt = { key: "2", label: `${mu.flag2} ${mu.p2Short}`, value2: `${t2}`, value: gaCell(s2.g, s2.a) };
      // Players ordered by total (most first); שוויון always last.
      const players = t2 > t1 ? [p2Opt, p1Opt] : [p1Opt, p2Opt];
      const { rows, notBet } = buildChoiceRows({
        bettors: bs,
        getPick: (b) => [b.matchup1, b.matchup2, b.matchup3][i],
        options: [...players, { key: "X", label: "שוויון" }],
        actualKey,
      });
      return {
        title: `${mu.p1Short} מול ${mu.p2Short}`,
        points: `${sp.matchup} נק׳`,
        nameHeader: "תוצאה",
        valueHeader2: "סהכ",
        valueHeader: "ש+ב",
        updatedAt: actAt,
        rows,
        notBetCount: notBet,
        footNote: "ש+ב = שערים + בישולים",
        decided: actualKey != null,
        decidedLabel: actualKey ? "הוכרע" : undefined,
      };
    };

    const pen = buildChoiceRows({
      bettors: bs,
      getPick: (b) => b.penalties,
      options: [
        { key: "OVER", label: `מעל ${PENALTIES_LINE}` },
        { key: "UNDER", label: `מתחת ${PENALTIES_LINE}` },
      ],
      actualKey: actuals?.penalties_over_under ?? null,
    });

    // Champion picks (advancement bet, but the marquee pick — shown first).
    // Options are exactly the teams someone picked (plus the actual champion
    // once decided), most-picked first via buildChoiceRows.
    const champTeams = Array.from(new Set(
      [...bs.map((b) => b.champion), actuals?.champion].filter((c): c is string => !!c),
    ));
    const champ = buildChoiceRows({
      bettors: bs,
      getPick: (b) => b.champion ?? null,
      options: champTeams.map((code) => ({ key: code, label: flagName(code) })),
      actualKey: actuals?.champion ?? null,
    });

    return [
      {
        title: "אלופת העולם",
        points: `${scoring.advancement.winner} נק׳`,
        nameHeader: "נבחרת",
        valueHeader: undefined,
        updatedAt: actAt,
        rows: champ.rows,
        notBetCount: champ.notBet,
        decided: actuals?.champion != null,
        decidedLabel: actuals?.champion ? "הוכרעה" : undefined,
      },
      ranked({ title: "מלך שערים", points: `${sp.top_scorer_exact} / ${sp.top_scorer_relative} נק׳`, nameHeader: "שחקן", valueHeader: "שערים", updatedAt: liveAt, getPick: (b) => b.topScorerPlayer, list: scorerRanked, actualKey: actuals?.top_scorer_player ?? null, fuzzy: true, decidedLabel: actuals?.top_scorer_player ? `הוכרע: ${actuals.top_scorer_player}` : undefined }),
      ranked({ title: "מלך בישולים", points: `${sp.top_assists_exact} / ${sp.top_assists_relative} נק׳`, nameHeader: "שחקן", valueHeader: "בישולים", updatedAt: liveAt, getPick: (b) => b.topAssistsPlayer, list: assistRanked, actualKey: actuals?.top_assists_player ?? null, fuzzy: true, decidedLabel: actuals?.top_assists_player ? `הוכרע: ${actuals.top_assists_player}` : undefined }),
      ranked({ title: "התקפה פורייה", points: `${sp.best_attack} נק׳`, nameHeader: "נבחרת", valueHeader: "שערים", updatedAt: actAt, getPick: (b) => b.bestAttack, list: attackRanked, actualKey: actuals?.best_attack_team ?? null, decidedLabel: "הוכרע" }),
      ranked({ title: "הנבחרת הכסחנית", points: `${sp.dirtiest_team} נק׳`, nameHeader: "נבחרת", valueHeader2: "ניקוד", valueHeader: "כרטיסים", updatedAt: actAt, getPick: (b) => b.dirtiestTeam, list: dirtyRanked, actualKey: actuals?.dirtiest_team ?? null, decidedLabel: "הוכרע", footNote: "ניקוד: צהוב = 1 · אדום = 3 · צהוב שני באותו משחק = אדום אחד" }),
      ranked({ title: "הבית הפורה", points: `${sp.prolific_group} נק׳`, nameHeader: "בית", valueHeader: "שערים", updatedAt: actAt, getPick: (b) => b.prolificGroup, list: prolificRanked, actualKey: actuals?.most_prolific_group ?? null, decidedLabel: "הוכרע" }),
      ranked({ title: "הבית היבש", points: `${sp.driest_group} נק׳`, nameHeader: "בית", valueHeader: "שערים", updatedAt: actAt, getPick: (b) => b.driestGroup, list: driestRanked, actualKey: actuals?.driest_group ?? null, decidedLabel: "הוכרע" }),
      matchupCard(0, actuals?.matchup_result_1 ?? null),
      matchupCard(1, actuals?.matchup_result_2 ?? null),
      matchupCard(2, actuals?.matchup_result_3 ?? null),
      {
        title: `סה״כ פנדלים · ${PENALTIES_LINE}`,
        points: `${sp.penalties_over_under} נק׳`,
        nameHeader: "הימור",
        valueHeader: undefined,
        statusLine: actuals?.total_penalties != null ? `${actuals.total_penalties} פנדלים` : undefined,
        updatedAt: actAt,
        rows: pen.rows,
        notBetCount: pen.notBet,
        decided: actuals?.penalties_over_under != null,
        decidedLabel: actuals?.penalties_over_under ? (actuals.penalties_over_under === "OVER" ? `מעל ${PENALTIES_LINE}` : `מתחת ${PENALTIES_LINE}`) : undefined,
      },
    ];
  }, [stats, normalizedBettors, isDemo, fetchedAt, scoring]);

  // Before the first match kicks off there's nothing to track — don't surface
  // anyone's picks (the demo preview bypasses this).
  if (!isDemo && !started) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
        <h3 className="text-lg font-black text-gray-800 mb-1">הטורניר עוד לא התחיל</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">מעקב ההימורים המיוחדים יופיע כאן ברגע שהמשחקים יתחילו.</p>
      </div>
    );
  }

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

  // Settled bets float to the top once the tournament is live.
  const decidedCount = cards.filter((c) => c.decided).length;
  const ordered = [...cards].sort((a, b) => Number(b.decided) - Number(a.decided));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-gray-500">
          {decidedCount}/{cards.length} הוכרעו
        </span>
        {isDemo && (
          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1">
            תצוגת דמו · נתונים לדוגמה
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ordered.map((c, i) => (
          <CategoryCard key={i} {...c} colorOf={colorOf} />
        ))}
      </div>
    </div>
  );
}
