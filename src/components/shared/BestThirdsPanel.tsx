"use client";

// =============================================================================
// BestThirdsPanel — Ranks the 12 groups' 3rd-placed teams (1..12), highlights
// the top 8 qualifiers (FIFA "best third-placed teams" rule). Admin override
// may replace the computed top-8 with a manually-selected set of 8 groups.
// =============================================================================

import { useMemo } from "react";
import { GROUPS, GROUP_LETTERS, getTeamByCode } from "@/lib/tournament/groups";
import { getFlag } from "@/lib/flags";
import { normalizeGroupLetter } from "@/lib/results-hits";
import { rankBestThirds, type ThirdsInputRow } from "@/lib/tournament/thirds-ranker";

interface MatchApi {
  id: number;
  homeTla: string;
  awayTla: string;
  group?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

interface Row {
  code: string;
  group: string;
  played: number;
  pts: number;
  gd: number;
  gf: number;
}

function computeGroupRows(groupLetter: string, matches: MatchApi[]): Row[] {
  const teams = GROUPS[groupLetter] || [];
  const rows: Record<string, Row> = {};
  for (const t of teams) {
    rows[t.code] = { code: t.code, group: groupLetter, played: 0, pts: 0, gd: 0, gf: 0 };
  }
  for (const m of matches) {
    if (normalizeGroupLetter(m.group) !== groupLetter) continue;
    if (m.status !== "FINISHED") continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const home = rows[m.homeTla];
    const away = rows[m.awayTla];
    if (!home || !away) continue;
    home.played += 1; away.played += 1;
    home.gf += m.homeGoals; home.gd += m.homeGoals - m.awayGoals;
    away.gf += m.awayGoals; away.gd += m.awayGoals - m.homeGoals;
    if (m.homeGoals > m.awayGoals) home.pts += 3;
    else if (m.homeGoals < m.awayGoals) away.pts += 3;
    else { home.pts += 1; away.pts += 1; }
  }
  return Object.values(rows).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.code.localeCompare(b.code),
  );
}

/**
 * Extract each group's 3rd-placed team into the ranker's input shape.
 * Groups with fewer than 3 teams standing are skipped.
 */
export function extractThirdsFromMatches(matches: MatchApi[]): ThirdsInputRow[] {
  const out: ThirdsInputRow[] = [];
  for (const letter of GROUP_LETTERS) {
    const rows = computeGroupRows(letter, matches);
    const third = rows[2];
    if (!third) continue;
    out.push({
      group: letter,
      team_code: third.code,
      played: third.played,
      points: third.pts,
      goal_difference: third.gd,
      goals_for: third.gf,
    });
  }
  return out;
}

interface Props {
  matches: MatchApi[];
  /**
   * Admin-picked group letters whose 3rd-placed teams qualify.
   * When set, overrides the automatic top-8 selection.
   */
  overrideGroups?: string[] | null;
}

export function BestThirdsPanel({ matches, overrideGroups }: Props) {
  const thirds = useMemo(() => extractThirdsFromMatches(matches), [matches]);
  const ranking = useMemo(() => rankBestThirds(thirds), [thirds]);

  const overrideSet = overrideGroups && overrideGroups.length === 8
    ? new Set(overrideGroups)
    : null;

  const ranked = ranking.ranked.map((r) => ({
    ...r,
    qualifies: overrideSet ? overrideSet.has(r.group) : r.qualifies,
  }));

  const qualifiedCount = ranked.filter((r) => r.qualifies).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-l from-white via-emerald-50/30 to-green-50/40 border-b border-emerald-100/50 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>
            דירוג מקומות שלישיים
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            12 המקומות השלישיים מדורגים חי — 8 הטובות עולות לשמינית הגמר
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overrideSet && (
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
              🔧 עקיפה ידנית
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            ranking.isFinal ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            {ranking.isFinal ? "סופי ✓" : "חי — עדיין משתנה"}
          </span>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="py-8 px-4 text-center text-sm text-gray-400">
          טרם נשחקו מספיק משחקים כדי לחשב מקומות שלישיים.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase border-b border-gray-100" style={{ fontFamily: "var(--font-inter)" }}>
              <th className="py-1.5 px-2 text-start">#</th>
              <th className="py-1.5 px-1 text-start">נבחרת</th>
              <th className="py-1.5 px-1 text-center">בית</th>
              <th className="py-1.5 px-1 text-center">מש׳</th>
              <th className="py-1.5 px-1 text-center">+/-</th>
              <th className="py-1.5 px-1 text-center">+</th>
              <th className="py-1.5 px-2 text-center font-bold">נק׳</th>
              <th className="py-1.5 px-2 text-center">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => {
              const team = getTeamByCode(r.team_code);
              const rowBg = r.qualifies ? "bg-emerald-50/40" : "bg-white";
              return (
                <tr key={r.team_code} className={`border-t border-gray-100 ${rowBg}`}>
                  <td className="py-1.5 px-2 font-bold text-gray-400">{r.rank}</td>
                  <td className="py-1.5 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{getFlag(r.team_code)}</span>
                      <span className="font-bold text-gray-800">{team?.name_he ?? r.team_code}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-1 text-center text-gray-600 font-bold">{r.group}</td>
                  <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.played}</td>
                  <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.goal_difference > 0 ? "+" : ""}{r.goal_difference}</td>
                  <td className="py-1.5 px-1 text-center text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.goals_for}</td>
                  <td className="py-1.5 px-2 text-center font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.points}</td>
                  <td className="py-1.5 px-2 text-center">
                    {r.qualifies ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">עולה</span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">נפסלת</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500 flex items-center justify-between">
        <span>{qualifiedCount}/8 שלישיים עולות</span>
        <span>דירוג: נק׳ → הפרש → שערים → כרטיסים → הגרלה</span>
      </div>
    </div>
  );
}
