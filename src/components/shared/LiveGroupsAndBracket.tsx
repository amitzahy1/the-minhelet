"use client";

// =============================================================================
// LiveGroupsAndBracket — /live main view
// - Group standings computed on-the-fly from finished match results
// - Knockout bracket with actual teams+scores derived the same way
// Reads /api/matches which already overlays admin-entered demo_match_results.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { GROUPS, GROUP_LETTERS, getTeamByCode } from "@/lib/tournament/groups";
import { getFlag } from "@/lib/flags";
import {
  buildR32Matchups,
  LATER_FEEDERS,
  resolveGroupSlot,
} from "@/lib/tournament/knockout-derivation";
import { getThirdsAssignment, DEFAULT_ASSIGNMENT } from "@/lib/tournament/annex-c";
import { normalizeGroupLetter } from "@/lib/results-hits";
import { BestThirdsPanel, extractThirdsFromMatches } from "./BestThirdsPanel";
import { rankBestThirds } from "@/lib/tournament/thirds-ranker";

interface MatchApi {
  id: number;
  date: string;
  homeTla: string;
  awayTla: string;
  group?: string;
  stage?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

interface GroupRow {
  code: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

function computeGroupStandings(groupLetter: string, matches: MatchApi[]): GroupRow[] {
  const teams = GROUPS[groupLetter] || [];
  const rows: Record<string, GroupRow> = {};
  for (const t of teams) {
    rows[t.code] = {
      code: t.code,
      name: t.name_he,
      played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0,
    };
  }
  for (const m of matches) {
    if (normalizeGroupLetter(m.group) !== groupLetter) continue;
    if (m.status !== "FINISHED") continue;
    if (m.homeGoals === null || m.homeGoals === undefined) continue;
    if (m.awayGoals === null || m.awayGoals === undefined) continue;
    const home = rows[m.homeTla];
    const away = rows[m.awayTla];
    if (!home || !away) continue;
    home.played += 1; away.played += 1;
    home.gf += m.homeGoals; home.ga += m.awayGoals;
    away.gf += m.awayGoals; away.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) { home.wins += 1; home.pts += 3; away.losses += 1; }
    else if (m.homeGoals < m.awayGoals) { away.wins += 1; away.pts += 3; home.losses += 1; }
    else { home.draws += 1; away.draws += 1; home.pts += 1; away.pts += 1; }
  }
  for (const r of Object.values(rows)) r.gd = r.gf - r.ga;
  return Object.values(rows).sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name, "he")
  );
}

function GroupCard({ letter, matches }: { letter: string; matches: MatchApi[] }) {
  const standings = useMemo(() => computeGroupStandings(letter, matches), [letter, matches]);
  const totalPlayed = standings.reduce((s, r) => s + r.played, 0) / 2; // each match counted twice

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between">
        <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>
          בית {letter}
        </h3>
        <span className="text-[11px] text-gray-500 font-medium">
          {totalPlayed} / 6 משחקים
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase border-b border-gray-100" style={{ fontFamily: "var(--font-inter)" }}>
            <th className="py-1.5 px-2 text-start">#</th>
            <th className="py-1.5 px-1 text-start">נבחרת</th>
            <th className="py-1.5 px-1 text-center" title="משחקים">M</th>
            <th className="py-1.5 px-1 text-center" title="ניצחונות">N</th>
            <th className="py-1.5 px-1 text-center" title="תיקו">T</th>
            <th className="py-1.5 px-1 text-center" title="הפסדים">H</th>
            <th className="py-1.5 px-1 text-center" title="שערי זכות">+</th>
            <th className="py-1.5 px-1 text-center" title="שערי חובה">-</th>
            <th className="py-1.5 px-2 text-center font-bold">נק׳</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((r, i) => {
            const qualified = i < 2;
            return (
              <tr
                key={r.code}
                className={`border-t border-gray-100 ${qualified ? "bg-emerald-50/40" : ""}`}
              >
                <td className="py-1.5 px-2 text-gray-400 font-bold">{i + 1}</td>
                <td className="py-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{getFlag(r.code)}</span>
                    <span className="font-bold text-gray-800">{r.name}</span>
                  </div>
                </td>
                <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.played}</td>
                <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.wins}</td>
                <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.draws}</td>
                <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.losses}</td>
                <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.gf}</td>
                <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.ga}</td>
                <td className="py-1.5 px-2 text-center font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Bracket -----------------

const BRACKET_ROUNDS: Array<{ label: string; keys: string[]; short: string }> = [
  { label: "שמינית הגמר", short: "R32",
    keys: ["r32l_0","r32l_1","r32l_2","r32l_3","r32l_4","r32l_5","r32l_6","r32l_7",
           "r32r_0","r32r_1","r32r_2","r32r_3","r32r_4","r32r_5","r32r_6","r32r_7"] },
  { label: "רבע גמר מוקדם (R16)", short: "R16",
    keys: ["r16l_0","r16l_1","r16l_2","r16l_3","r16r_0","r16r_1","r16r_2","r16r_3"] },
  { label: "רבע גמר", short: "QF", keys: ["qfl_0","qfl_1","qfr_0","qfr_1"] },
  { label: "חצי גמר", short: "SF", keys: ["sfl_0","sfr_0"] },
  { label: "גמר", short: "F", keys: ["final"] },
];

interface KOKnown {
  team1: string | null;
  team2: string | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

function computeGroupOrdersFromStandings(matches: MatchApi[]): Record<string, number[]> {
  const groupOrders: Record<string, number[]> = {};
  for (const letter of GROUP_LETTERS) {
    const standings = computeGroupStandings(letter, matches);
    const teamIdxByCode: Record<string, number> = {};
    GROUPS[letter].forEach((t, i) => (teamIdxByCode[t.code] = i));
    groupOrders[letter] = standings.map((r) => teamIdxByCode[r.code]);
  }
  return groupOrders;
}

function asGroupState(orders: Record<string, number[]>): Record<string, { order: number[] }> {
  const out: Record<string, { order: number[] }> = {};
  for (const [k, v] of Object.entries(orders)) out[k] = { order: v };
  return out;
}

/** For a given KO slot, return derived team codes + actual score from results. */
function deriveKoMatch(
  key: string,
  groups: Record<string, number[]>,
  knockoutWinners: Record<string, string | null>,
  matches: MatchApi[],
  matchups: Record<string, { h: string; a: string }>,
): KOKnown {
  let team1: string | null = null;
  let team2: string | null = null;
  if (key in matchups) {
    const { h, a } = matchups[key];
    const groupState = asGroupState(groups);
    team1 = resolveGroupSlot(h, groupState);
    team2 = resolveGroupSlot(a, groupState);
  } else if (key in LATER_FEEDERS) {
    const [f1, f2] = LATER_FEEDERS[key];
    team1 = knockoutWinners[f1] ?? null;
    team2 = knockoutWinners[f2] ?? null;
  }

  // Look up actual score in demo_match_results. We don't have a key mapping
  // FD match_id → our knockout key, so fall back to team-pair heuristic.
  let score1: number | null = null;
  let score2: number | null = null;
  let winner: string | null = null;
  if (team1 && team2) {
    const fm = matches.find(
      (m) =>
        m.status === "FINISHED" &&
        ((m.homeTla === team1 && m.awayTla === team2) ||
          (m.homeTla === team2 && m.awayTla === team1))
    );
    if (fm && fm.homeGoals !== null && fm.homeGoals !== undefined && fm.awayGoals !== null && fm.awayGoals !== undefined) {
      if (fm.homeTla === team1) {
        score1 = fm.homeGoals;
        score2 = fm.awayGoals;
      } else {
        score1 = fm.awayGoals;
        score2 = fm.homeGoals;
      }
      if (score1 > score2) winner = team1;
      else if (score2 > score1) winner = team2;
    }
  }
  return { team1, team2, score1, score2, winner };
}

function BracketSlotCard({ match, compact }: { match: KOKnown; compact?: boolean }) {
  const t1 = (match.team1 ? getTeamByCode(match.team1) : null) ?? null;
  const t2 = (match.team2 ? getTeamByCode(match.team2) : null) ?? null;
  const done = match.score1 !== null && match.score2 !== null;
  const padding = compact ? "py-1.5 px-2" : "py-2 px-2.5";
  return (
    <div className={`rounded-lg border ${done ? "bg-green-50/40 border-green-200" : "bg-white border-gray-200"}`}>
      <TeamRow team={t1} code={match.team1} score={match.score1} isWinner={match.winner === match.team1} padding={padding} />
      <div className="border-t border-gray-100" />
      <TeamRow team={t2} code={match.team2} score={match.score2} isWinner={match.winner === match.team2} padding={padding} />
    </div>
  );
}

function TeamRow({
  team, code, score, isWinner, padding,
}: {
  team: { name_he: string } | null | undefined;
  code: string | null;
  score: number | null;
  isWinner: boolean;
  padding: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${padding}`}>
      <span className="text-base shrink-0">{code ? getFlag(code) : "⏳"}</span>
      <span className={`flex-1 text-xs font-bold truncate ${
        isWinner ? "text-green-800" : team ? "text-gray-800" : "text-gray-400"
      }`}>
        {team ? team.name_he : "ממתין..."}
      </span>
      <span className={`text-sm font-black tabular-nums w-6 text-center ${
        score === null ? "text-gray-300" : isWinner ? "text-green-700" : "text-gray-500"
      }`} style={{ fontFamily: "var(--font-inter)" }}>
        {score ?? "—"}
      </span>
    </div>
  );
}

// ---------------- Main ------------------

export function LiveGroupsAndBracket() {
  const [matches, setMatches] = useState<MatchApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"groups" | "bracket">("groups");
  const [thirdsOverride, setThirdsOverride] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [matchesRes, thirdsRes] = await Promise.all([
          fetch("/api/matches").then((r) => r.json()).catch(() => ({ matches: [] })),
          fetch("/api/best-thirds").then((r) => r.json()).catch(() => ({ override: null })),
        ]);
        if (!alive) return;
        setMatches((matchesRes.matches as MatchApi[]) || []);
        const override = thirdsRes?.override;
        setThirdsOverride(Array.isArray(override) && override.length === 8 ? override : null);
      } catch {
        /* keep empty */
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const groupOrders = useMemo(() => computeGroupOrdersFromStandings(matches), [matches]);

  // Resolve the Annex C 3rd-place assignment from the live ranking + admin
  // override. Falls back to the hardcoded default when no scenario is known.
  const r32Matchups = useMemo(() => {
    const thirds = extractThirdsFromMatches(matches);
    const ranking = rankBestThirds(thirds);
    const qualifiers =
      thirdsOverride && thirdsOverride.length === 8
        ? thirdsOverride
        : ranking.qualifiedGroups.length === 8
        ? ranking.qualifiedGroups
        : null;
    if (!qualifiers) return buildR32Matchups(DEFAULT_ASSIGNMENT);
    const { assignment } = getThirdsAssignment(qualifiers);
    return buildR32Matchups(assignment ?? DEFAULT_ASSIGNMENT);
  }, [matches, thirdsOverride]);

  // Compute KO progression: R32 first, then later rounds depend on previous winners.
  const knockoutWinners: Record<string, string | null> = useMemo(() => {
    const winners: Record<string, string | null> = {};
    const resolve = (key: string) => {
      const m = deriveKoMatch(key, groupOrders, winners, matches, r32Matchups);
      winners[key] = m.winner;
    };
    // Resolve R32 first
    Object.keys(r32Matchups).forEach(resolve);
    // Then later rounds in order
    ["r16l_0","r16l_1","r16l_2","r16l_3","r16r_0","r16r_1","r16r_2","r16r_3",
     "qfl_0","qfl_1","qfr_0","qfr_1",
     "sfl_0","sfr_0","final"].forEach(resolve);
    return winners;
  }, [groupOrders, matches, r32Matchups]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">טוען נתוני טורניר...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab("groups")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            tab === "groups" ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-200 border border-gray-200"
          }`}
        >
          🏟️ טבלאות בתים
        </button>
        <button
          onClick={() => setTab("bracket")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            tab === "bracket" ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-200 border border-gray-200"
          }`}
        >
          🌳 עץ הגביע
        </button>
      </div>

      {tab === "groups" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GROUP_LETTERS.map((l) => (
              <GroupCard key={l} letter={l} matches={matches} />
            ))}
          </div>
          <BestThirdsPanel matches={matches} overrideGroups={thirdsOverride} />
        </div>
      )}

      {tab === "bracket" && (
        <div className="space-y-6">
          {BRACKET_ROUNDS.map((round) => (
            <div key={round.short}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>
                  {round.label}
                </h3>
                <span className="text-[11px] text-gray-400">{round.short}</span>
              </div>
              <div
                className={`grid gap-2.5 ${
                  round.keys.length >= 16 ? "sm:grid-cols-2 lg:grid-cols-4" :
                  round.keys.length >= 8 ? "sm:grid-cols-2 lg:grid-cols-4" :
                  round.keys.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" :
                  round.keys.length >= 2 ? "sm:grid-cols-2" :
                  "max-w-md mx-auto"
                }`}
              >
                {round.keys.map((k) => {
                  const m = deriveKoMatch(k, groupOrders, knockoutWinners, matches, r32Matchups);
                  return <BracketSlotCard key={k} match={m} compact={round.keys.length >= 8} />;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
