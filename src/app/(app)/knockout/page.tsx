"use client";

// ============================================================================
// "עץ סימולציה" (Tree 1) — pre-tournament, WINNER-ONLY simulation.
//
// Purpose: let the bettor choose who THEY advance through each round and who
// wins, building a simulation. These winner picks feed the advancement /
// champion bets (advancement_picks). There is NO score betting here — match
// results are bet in "עץ נתוני אמת" (the real-data tree) once the group stage
// ends, and that is the only tree scored for knockout match-results.
// ============================================================================

import Link from "next/link";
import { useMemo } from "react";
import { useBettingStore } from "@/stores/betting-store";
import { GROUPS } from "@/lib/tournament/groups";
import { LATER_FEEDERS } from "@/lib/tournament/knockout-derivation";
import { isLocked } from "@/lib/constants";
import { PageTransition } from "@/components/shared/PageTransition";
import { SaveAndContinue } from "@/components/shared/SaveAndContinue";
import { BracketLayout, BracketMatchCell, type SlotTeams } from "@/components/knockout/BracketLayout";

// R32 matchups — map to FIFA's official WC2026 schedule M73-M88.
// W/RU pairings (8 of 16) are exact; 3rd-place slots (8 of 16) collapse each
// FIFA "best-of" bucket to a single representative group for the simulation.
const R32_MATCHUPS: Record<string, { h: string; a: string }> = {
  r32l_0: { h: "A2", a: "B2" }, r32l_1: { h: "E1", a: "D3" }, r32l_2: { h: "F1", a: "C2" }, r32l_3: { h: "C1", a: "F2" },
  r32l_4: { h: "A1", a: "C3" }, r32l_5: { h: "H1", a: "J2" }, r32l_6: { h: "B1", a: "E3" }, r32l_7: { h: "D2", a: "G2" },
  r32r_0: { h: "I1", a: "F3" }, r32r_1: { h: "G1", a: "H3" }, r32r_2: { h: "K2", a: "L2" }, r32r_3: { h: "J1", a: "H2" },
  r32r_4: { h: "D1", a: "B3" }, r32r_5: { h: "L1", a: "I3" }, r32r_6: { h: "E2", a: "I2" }, r32r_7: { h: "K1", a: "J3" },
};

type GroupForResolve = { order: number[]; scores: { home: number | null; away: number | null }[] };

// Resolve "A1"/"A2"/"A3" to a team code from the user's predicted standings.
// Returns null until the user enters at least one score in the group.
function resolveSlot(slot: string, groups: Record<string, GroupForResolve>): string | null {
  const groupLetter = slot[0];
  const position = parseInt(slot[1]) - 1;
  const group = groups[groupLetter];
  if (!group) return null;
  const hasAnyScore = group.scores?.some((s) => s.home !== null || s.away !== null);
  if (!hasAnyScore) return null;
  const teamIndex = group.order[position];
  const groupTeams = GROUPS[groupLetter];
  if (!groupTeams || teamIndex === undefined) return null;
  return groupTeams[teamIndex]?.code || null;
}

export default function KnockoutPage() {
  const groups = useBettingStore((s) => s.groups);
  const knockout = useBettingStore((s) => s.knockout);
  const setKnockoutMatch = useBettingStore((s) => s.setKnockoutMatch);
  const filledKnockout = Object.values(knockout).filter((m) => m.winner).length;
  const locked = isLocked();

  // Conflict detection: team predicted to finish 4th in its group but appearing
  // as a knockout winner.
  const conflictingTeams = useMemo(() => {
    const eliminated = new Set<string>();
    for (const [groupId, group] of Object.entries(groups)) {
      if (group.order && group.order.length === 4) {
        const teams = GROUPS[groupId];
        if (teams && teams[group.order[3]]) eliminated.add(teams[group.order[3]].code);
      }
    }
    const koWinners = new Set(Object.values(knockout).map((m) => m.winner).filter(Boolean) as string[]);
    return [...eliminated].filter((code) => koWinners.has(code));
  }, [groups, knockout]);

  const getWinner = (key: string) => knockout[key]?.winner || null;

  // Teams for any slot: R32 from predicted group standings; R16+ from the
  // winners the user picked in the feeding matches.
  const getTeams = (key: string): SlotTeams => {
    if (key in R32_MATCHUPS) {
      const { h, a } = R32_MATCHUPS[key];
      return { team1: resolveSlot(h, groups), team2: resolveSlot(a, groups) };
    }
    const feeders = LATER_FEEDERS[key];
    if (feeders) return { team1: getWinner(feeders[0]), team2: getWinner(feeders[1]) };
    return { team1: null, team2: null };
  };

  const renderMatch = (key: string, teams: SlotTeams, size: "sm" | "md") => (
    <BracketMatchCell
      key={key}
      team1Code={teams.team1}
      team2Code={teams.team2}
      value={knockout[key]}
      onChange={(d) => setKnockoutMatch(key, d)}
      size={size}
      scoreless
      editable={!locked}
    />
  );

  return (
    <PageTransition>
      <div className="max-w-full mx-auto px-4 py-6 pb-24">
        <div className="mb-3">
          <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>עץ סימולציה</h1>
          <p className="text-lg text-gray-600 mt-1">בחרו מי עולה בכל שלב ומי האלופה</p>
        </div>

        {/* What this tree is for */}
        <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50/70 px-4 py-3 text-[13px] text-purple-900 leading-relaxed">
          <strong>זו סימולציה בלבד.</strong> העץ הזה עוזר לכם לבחור את מי אתם מעלים לכל שלב ומי האלופה — וממנו נגזרים
          הימורי העולות (שמינית/רבע/חצי/גמר) והאלופה. <strong>אין כאן הימור על תוצאות משחקים.</strong> הימור על תוצאות
          הנוק-אאוט נעשה ב<Link href="/knockout-live" className="font-bold underline">עץ נתוני אמת</Link> שנפתח בתום שלב הבתים, ורק הוא נספר לניקוד תוצאות הנוק-אאוט.
        </div>

        <div className="mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
            <span className="text-sm font-bold text-gray-700">התקדמות:</span>
            <span className="text-sm font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{filledKnockout}/31</span>
            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(filledKnockout / 31) * 100}%` }}></div>
            </div>
          </div>
          <p className="text-sm text-gray-500">המנצחת עוברת אוטומטית לשלב הבא</p>
        </div>

        {conflictingTeams.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-lg mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">סתירה בהימורים</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {conflictingTeams.join(", ")} — הימרת שהנבחרת תצא בשלב הבתים אך היא מופיעה בעץ הסימולציה.
              </p>
            </div>
          </div>
        )}

        {filledKnockout === 31 && (
          <Link href="/special-bets" className="mb-4 bg-gradient-to-l from-green-500 to-emerald-600 text-white rounded-xl px-5 py-4 flex items-center justify-between gap-3 shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-[1.01] transition-all">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-base font-black">סיימת את עץ הסימולציה!</p>
                <p className="text-sm text-purple-50">המשך לשלב 3 — הימורים מיוחדים</p>
              </div>
            </div>
            <span className="text-2xl font-black">←</span>
          </Link>
        )}

        <BracketLayout getTeams={getTeams} renderMatch={renderMatch} champion={knockout.final?.winner ?? null} />

        <SaveAndContinue
          label={filledKnockout === 31 ? "💾 שמור והמשך להימורים מיוחדים" : "💾 שמור הימורים עד כה"}
          nextHref="/special-bets"
          nextLabel="המשך להימורים מיוחדים →"
          completion={Math.round((filledKnockout / 31) * 100)}
        />
      </div>
    </PageTransition>
  );
}
