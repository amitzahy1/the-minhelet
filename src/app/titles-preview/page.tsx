"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ============================================================================
// /titles-preview — visual QA page: the PROPOSED home-page order, all 8
// sections together, on mock data.
//
// Rendering replicates the real טבלה page 1:1 — real components are imported
// where they take props (LeagueTitles, HeroRoast, LeaderboardRace, TeamLogo);
// sections whose components fetch live data internally (המשחקים הבאים, באנר
// הימורים חסרים) are pixel-copies of their real markup. The title awards run
// through the REAL computeLeagueTitles, so the no-award-on-tie and
// minimum-threshold rules shown here are the prod rules.
//
// PROPOSED ORDER (pending league-owner approval):
//   1 המשחקים הבאים · 2 באנר הימורים חסרים · 3 כותרת + שתף · 4 טבלת דירוג
//   5 🏅 תארים · 6 השוואת כל המהמרים · 7 מצטיין/חולשת היום · 8 מירוץ הנקודות
// ============================================================================

import { computeLeagueTitles } from "@/lib/league-titles";
import { LeagueTitles } from "@/components/shared/LeagueTitles";
import { HeroRoast } from "@/components/shared/HeroRoast";
import { LeaderboardRace } from "@/components/shared/LeaderboardRace";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { getTeamNameHe } from "@/lib/flags";
import { shareLeaderboard, openWhatsApp } from "@/lib/share";
import type { BettorBracket } from "@/lib/supabase/shared-data";
import { classifyHit, type FinishedMatch, type HitKind } from "@/lib/results-hits";
import { GROUPS } from "@/lib/tournament/groups";

// ---------------------------------------------------------------------------
// Mock bracket builder
// ---------------------------------------------------------------------------

const DEFAULT_ORDER = [0, 1, 2, 3];
const KO_SLOTS = ["r32_1", "r32_2", "r32_3", "r32_4", "r16_1", "r16_2", "qf_1", "qf_2"];

function mkBracket(
  userId: string,
  displayName: string,
  opts: {
    champion: string;
    orders?: Record<string, number[]>;
    /** letter → pairIdx → [home, away] predicted score */
    scores?: Record<string, Record<number, [number, number]>>;
    /** winner per KO slot (Tree-1) */
    tree?: string[];
  },
): BettorBracket {
  const groupPredictions: BettorBracket["groupPredictions"] = {};
  for (const letter of Object.keys(GROUPS)) {
    const scores = Array.from({ length: 6 }, (_, i) => {
      const s = opts.scores?.[letter]?.[i];
      return s ? { home: s[0], away: s[1] } : { home: null, away: null };
    });
    groupPredictions[letter] = { order: opts.orders?.[letter] ?? [...DEFAULT_ORDER], scores };
  }
  const knockoutTree: BettorBracket["knockoutTree"] = {};
  (opts.tree ?? []).forEach((winner, i) => {
    knockoutTree[KO_SLOTS[i]] = { score1: null, score2: null, winner };
  });
  return {
    userId,
    displayName,
    groupPredictions,
    knockoutTree,
    knockoutTreeLive: {},
    champion: opts.champion,
    lockedAt: "2026-06-10T13:30:00Z",
  };
}

// ---------------------------------------------------------------------------
// Mock finished matches: groups A, B, C fully played over 3 match days.
// Real top-2: A → MEX+CZE, B → SUI+CAN, C → BRA+SCO.
// ---------------------------------------------------------------------------

const D1 = "2026-06-11T19:00:00Z";
const D2 = "2026-06-12T19:00:00Z";
const D3 = "2026-06-13T19:00:00Z";

function mkMatch(id: number, date: string, letter: string, pairIdx: number, hg: number, ag: number): FinishedMatch {
  const PAIRS: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
  const [hi, ai] = PAIRS[pairIdx];
  return {
    id,
    date,
    homeTla: GROUPS[letter][hi].code,
    awayTla: GROUPS[letter][ai].code,
    group: letter,
    stage: "GROUP_STAGE",
    homeGoals: hg,
    awayGoals: ag,
  };
}

const FINISHED: FinishedMatch[] = [
  mkMatch(9001, D1, "A", 0, 2, 1), mkMatch(9002, D1, "A", 1, 1, 0),
  mkMatch(9003, D1, "B", 0, 1, 0), mkMatch(9004, D1, "B", 1, 3, 1),
  mkMatch(9005, D1, "C", 0, 1, 0), mkMatch(9006, D1, "C", 1, 2, 1),
  mkMatch(9007, D2, "A", 2, 1, 1), mkMatch(9008, D2, "A", 3, 2, 0),
  mkMatch(9009, D2, "B", 2, 1, 1), mkMatch(9010, D2, "B", 3, 1, 1),
  mkMatch(9011, D2, "C", 2, 2, 2), mkMatch(9012, D2, "C", 3, 2, 2),
  mkMatch(9013, D3, "A", 4, 3, 0), mkMatch(9014, D3, "A", 5, 0, 1),
  mkMatch(9015, D3, "B", 4, 2, 0), mkMatch(9016, D3, "B", 5, 0, 2),
  mkMatch(9017, D3, "C", 4, 4, 0), mkMatch(9018, D3, "C", 5, 0, 1),
];

// ---------------------------------------------------------------------------
// Main dataset — crafted so EVERY title resolves to a unique holder.
// ---------------------------------------------------------------------------

const TREE_MAIN = ["FRA", "ESP", "ARG", "BRA", "GER", "POR", "NED", "ENG"];
const TREE_VAR1 = ["FRA", "ESP", "ARG", "BRA", "GER", "POR", "CRO", "ITA"];
const TREE_VAR2 = ["FRA", "URU", "ARG", "BRA", "JPN", "POR", "NED", "ENG"];
const TREE_OPP = ["MEX", "KOR", "RSA", "HAI", "QAT", "BIH", "CUR", "JOR"];

const BRACKETS: BettorBracket[] = [
  mkBracket("u1", "דני", {
    champion: "ARG",
    tree: TREE_MAIN,
    scores: { A: { 0: [2, 1], 1: [1, 0], 2: [1, 1] }, B: { 0: [1, 0] } },
  }),
  mkBracket("u2", "רון ב", { champion: "ARG", tree: TREE_MAIN }),
  mkBracket("u3", "יוני", {
    champion: "NZL",
    tree: TREE_VAR1,
    scores: { A: { 0: [1, 1], 1: [2, 0], 3: [1, 0] }, B: { 1: [3, 2], 4: [2, 1] }, C: { 2: [2, 2] } },
  }),
  mkBracket("u4", "אמית", {
    champion: "FRA",
    tree: TREE_VAR2,
    scores: { A: { 1: [2, 2], 2: [2, 2] }, B: { 1: [2, 2], 2: [3, 3] }, C: { 0: [2, 2], 4: [2, 2] } },
  }),
  mkBracket("u5", "רון ג", {
    champion: "FRA",
    tree: TREE_VAR1,
    scores: { A: { 3: [0, 0] }, B: { 3: [0, 0] }, C: { 5: [0, 0] } },
  }),
  mkBracket("u6", "דור דסא", {
    champion: "FRA",
    tree: TREE_VAR2,
    orders: { A: [0, 2, 1, 3], B: [2, 0, 1, 3], C: [0, 2, 1, 3] },
  }),
  mkBracket("u7", "רועי", {
    champion: "ARG",
    tree: TREE_OPP,
    orders: Object.fromEntries(Object.keys(GROUPS).map((l) => [l, [0, 3, 2, 1]])),
  }),
  mkBracket("u8", "עידן", {
    champion: "ARG",
    tree: TREE_MAIN.slice(0, 6),
    orders: { K: [1, 0, 2, 3], L: [1, 0, 2, 3] },
  }),
];

// ---------------------------------------------------------------------------
// Edge-case dataset — every title tied or below minimum → nothing awarded.
// ---------------------------------------------------------------------------

const BRACKETS_TIED: BettorBracket[] = [
  mkBracket("t1", "מהמר 1", { champion: "FRA", tree: TREE_MAIN, scores: { A: { 0: [2, 1], 1: [1, 0] } } }),
  mkBracket("t2", "מהמר 2", { champion: "FRA", tree: TREE_MAIN, scores: { B: { 0: [1, 0], 1: [3, 1] } } }),
  mkBracket("t3", "מהמר 3", { champion: "ESP", tree: TREE_OPP }),
  mkBracket("t4", "מהמר 4", { champion: "ESP", tree: TREE_OPP }),
];

// ---------------------------------------------------------------------------
// Mock leaderboard rows — same fields the real table renders.
// Row 3 stress-tests a long name + the "אתה" chip alongside title chips.
// ---------------------------------------------------------------------------

const ROWS = [
  { id: "u1", name: "דני", matchPts: 16, advPts: 0, specPts: 0, total: 16, maxPossible: 64, today: "+4", history: [0, 4, 8, 12, 12, 16], isYou: false, toto: "64%", exact: 4, streak: 3, bestDay: "+12" },
  { id: "u3", name: "יוני", matchPts: 8, advPts: 0, specPts: 0, total: 8, maxPossible: 61, today: "+1", history: [0, 1, 2, 2, 7, 8], isYou: false, toto: "58%", exact: 1, streak: 2, bestDay: "+5" },
  { id: "u9", name: "אלכסנדר-מתתיהו שם-ארוך-במיוחד", matchPts: 4, advPts: 0, specPts: 0, total: 4, maxPossible: 58, today: "0", history: [0, 1, 2, 3, 4, 4], isYou: true, toto: "52%", exact: 0, streak: 0, bestDay: "+3" },
  { id: "u4", name: "אמית", matchPts: 2, advPts: 0, specPts: 0, total: 2, maxPossible: 55, today: "+2", history: [0, 0, 1, 1, 2, 2], isYou: false, toto: "44%", exact: 0, streak: 1, bestDay: "+2" },
  { id: "u7", name: "רועי", matchPts: 0, advPts: 0, specPts: 0, total: 0, maxPossible: 49, today: "0", history: [0, 0, 0, 0, 0, 0], isYou: false, toto: "31%", exact: 0, streak: 0, bestDay: "0" },
];
const LIFTER_ID = "u1"; // unique first place
const SHEEP_ID = "u7";  // unique last place

// Mock cards for the המשחקים הבאים replica — one per expanded-panel state:
// upcoming+revealed (post-21:31), upcoming+locked (pre-reveal), live, finished.
const DEMO_TODAY = [
  { id: 1, time: "22:00", status: "upcoming" as const, home: "MEX", away: "RSA", group: "A", score: null as null | [number, number], panel: "revealed" as const },
  { id: 2, time: "22:00", status: "upcoming" as const, home: "FRA", away: "IRQ", group: "I", score: null as null | [number, number], panel: "locked" as const },
  { id: 3, time: "", status: "live" as const, home: "KOR", away: "CZE", group: "A", score: [1, 0] as [number, number], panel: "live" as const },
  { id: 4, time: "", status: "finished" as const, home: "CAN", away: "QAT", group: "B", score: [1, 0] as [number, number], panel: "finished" as const },
];

// Everyone's score picks per demo match (what the expanded panel lists)
const DEMO_PICKS: Record<number, { name: string; home: number; away: number }[]> = {
  1: [
    { name: "דני", home: 2, away: 1 }, { name: "רון ב", home: 1, away: 0 },
    { name: "יוני", home: 1, away: 1 }, { name: "אמית", home: 2, away: 2 },
    { name: "רון ג", home: 0, away: 0 }, { name: "דור דסא", home: 2, away: 0 },
    { name: "רועי", home: 1, away: 0 }, { name: "עידן", home: 2, away: 1 },
  ],
  3: [
    { name: "דני", home: 1, away: 0 }, { name: "רון ב", home: 2, away: 0 },
    { name: "יוני", home: 1, away: 1 }, { name: "אמית", home: 0, away: 0 },
    { name: "רון ג", home: 0, away: 2 }, { name: "דור דסא", home: 2, away: 1 },
    { name: "רועי", home: 3, away: 1 }, { name: "עידן", home: 0, away: 1 },
  ],
  4: [
    { name: "דני", home: 1, away: 0 }, { name: "רון ב", home: 1, away: 0 },
    { name: "יוני", home: 2, away: 0 }, { name: "אמית", home: 2, away: 1 },
    { name: "רון ג", home: 1, away: 1 }, { name: "דור דסא", home: 3, away: 0 },
    { name: "רועי", home: 0, away: 1 }, { name: "עידן", home: 0, away: 0 },
  ],
};

// Related special bets shown under the picks (as on the real card)
const DEMO_SPECIALS: Record<number, { name: string; type: string; detail: string }[]> = {
  1: [
    { name: "דני", type: "כסחנית", detail: "🇿🇦" },
    { name: "עידן", type: "התקפה", detail: "🇲🇽" },
  ],
  4: [{ name: "רון ב", type: "התקפה", detail: "🇨🇦" }],
};

const HIT_RANK: Record<HitKind, number> = { exact: 0, toto: 1, miss: 2, empty: 3 };

/** Exact copy of the real expanded-panel pick chip. */
function PickChip({ name, home, away, hit }: { name: string; home: number; away: number; hit: HitKind | null }) {
  const bg =
    hit === "exact" ? "bg-green-50 border-green-300"
    : hit === "toto" ? "bg-amber-50 border-amber-300"
    : hit === "miss" ? "bg-red-50 border-red-200"
    : "bg-white border-gray-200";
  const icon = hit === "exact" ? "🎯" : hit === "toto" ? "✓" : hit === "miss" ? "✗" : "";
  return (
    <div className={`flex items-center justify-between rounded-lg px-2 py-1 border ${bg}`}>
      <span className="text-[11px] font-bold text-gray-800 truncate">{name}</span>
      <span className="flex items-center gap-1 shrink-0">
        <span className="text-[11px] font-black tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
          {home}-{away}
        </span>
        {icon && <span className="text-xs">{icon}</span>}
      </span>
    </div>
  );
}

// Identical copy of the standings-page Sparkline (it's file-local there).
function Sparkline({ data, highlight }: { data: number[]; highlight?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 80, h = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" style={{ direction: "ltr" }}>
      <polyline points={points} fill="none" stroke={highlight ? "#3B82F6" : "#94A3B8"} strokeWidth={highlight ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r={2.5} fill={highlight ? "#3B82F6" : "#94A3B8"} />
    </svg>
  );
}

/** Small numbered marker above each section — preview-only, for the approval pass. */
function SectionMark({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-8 mb-2">
      <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-black flex items-center justify-center shrink-0">{n}</span>
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

export default function TitlesPreviewPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const awards = computeLeagueTitles(BRACKETS, FINISHED);
  const awardsTied = computeLeagueTitles(BRACKETS_TIED, FINISHED.slice(0, 4));
  const shareText = shareLeaderboard(
    ROWS.map((r, i) => ({ rank: i + 1, name: r.name, total: r.total, today: r.today })),
    ROWS.find((r) => r.id === SHEEP_ID)?.name ?? null,
    ROWS.find((r) => r.id === LIFTER_ID)?.name ?? null,
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24" dir="rtl">
      <div className="mb-2 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h1 className="text-2xl font-black text-gray-900">תצוגה מקדימה — הסדר המוצע לעמוד הראשי</h1>
        <p className="text-sm text-gray-600 mt-1">
          כל 8 הסקשנים ביחד, בסדר המוצע, על נתוני דמה. הרינדור זהה לאתר (אותם רכיבים ואותו מרקאפ);
          המספרים השחורים הקטנים הם סימוני-תצוגה בלבד ולא יופיעו באתר.
        </p>
      </div>

      {/* ===== 1 · המשחקים הבאים (replica — the real component fetches live data) ===== */}
      <SectionMark n={1} label="המשחקים הבאים — לחצו על משחק לפתיחת ההימורים (4 מצבים: לפני חשיפה, אחרי חשיפה, לייב, הסתיים)" />
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-base font-bold text-gray-800">המשחקים היום</h2>
          <span className="text-sm text-gray-400">4 משחקים</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
          {DEMO_TODAY.map((m) => {
            const isExpanded = expandedId === m.id;
            const actual = m.score ? { home: m.score[0], away: m.score[1] } : null;
            const picks = [...(DEMO_PICKS[m.id] ?? [])].sort((a, b) =>
              (actual
                ? HIT_RANK[classifyHit({ home: a.home, away: a.away }, actual)] -
                  HIT_RANK[classifyHit({ home: b.home, away: b.away }, actual)]
                : 0) || a.name.localeCompare(b.name, "he"),
            );
            const specials = DEMO_SPECIALS[m.id] ?? [];
            // Consensus strip — top 2 genuinely-common picks, same as the real widget
            const consensusLine = (() => {
              if (m.panel !== "revealed" || picks.length < 2) return "";
              const tally: Record<string, number> = {};
              for (const p of picks) {
                const k = `${p.home}-${p.away}`;
                tally[k] = (tally[k] || 0) + 1;
              }
              return Object.entries(tally)
                .filter(([, n]) => n > 1)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([k, n]) => `${k} ×${n}`)
                .join(" · ");
            })();
            const counts = actual
              ? picks.reduce(
                  (acc, p) => {
                    const h = classifyHit({ home: p.home, away: p.away }, actual);
                    if (h === "exact") acc.exact++;
                    else if (h === "toto") acc.toto++;
                    else acc.miss++;
                    return acc;
                  },
                  { exact: 0, toto: 0, miss: 0 },
                )
              : null;
            return (
              <div key={m.id} className="col-span-1">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className={`bg-white rounded-xl border shadow-sm p-3 text-center transition-all cursor-pointer ${
                    m.status === "live" ? "border-red-300 bg-red-50/30" :
                    m.status === "finished" ? "border-green-200" :
                    isExpanded ? "border-blue-300 shadow-md" :
                    "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  <div className="mb-2">
                    {m.status === "live" && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE
                      </span>
                    )}
                    {m.status === "finished" && <span className="text-[10px] font-bold text-green-600 bg-green-100 rounded-full px-2 py-0.5">הסתיים</span>}
                    {m.status === "upcoming" && (
                      <span className="text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{m.time}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                      <TeamLogo code={m.home} size="md" />
                      <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">{getTeamNameHe(m.home) || m.home}</span>
                    </div>
                    <div className="shrink-0 px-1">
                      {m.score ? (
                        <span className="text-lg font-black tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.score[0]}-{m.score[1]}</span>
                      ) : (
                        <span className="text-sm font-bold text-gray-300">vs</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                      <TeamLogo code={m.away} size="md" />
                      <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">{getTeamNameHe(m.away) || m.away}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <p className="text-[10px] text-gray-400">בית {m.group}</p>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Expanded panel — identical structure to the real widget */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gray-50 rounded-b-xl border border-t-0 border-gray-200 px-3 py-2.5 mt-[-4px]">
                        <div className="space-y-1.5">
                          {/* Pre-reveal: explicit reveal time */}
                          {m.panel === "locked" && (
                            <p className="text-[11px] text-blue-700 font-medium text-center py-1">
                              🔒 ניחושי התוצאה ייחשפו ב-11.6 בשעה 21:31 (דקה אחרי נעילת ההימורים)
                            </p>
                          )}

                          {/* Post-reveal, before kickoff: everyone's picks + consensus */}
                          {m.panel === "revealed" && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">ניחושי התוצאה</p>
                              {consensusLine && (
                                <p className="text-[10px] text-gray-500 mb-1">
                                  הניחוש הנפוץ:{" "}
                                  <span className="font-bold tabular-nums text-gray-700" style={{ fontFamily: "var(--font-inter)" }}>{consensusLine}</span>
                                </p>
                              )}
                              <div className="grid grid-cols-2 gap-1">
                                {picks.map((p) => (
                                  <PickChip key={p.name} name={p.name} home={p.home} away={p.away} hit={null} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Live: graded against the current score */}
                          {m.panel === "live" && actual && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">
                                ניחושי התוצאה
                                <span className="mx-1.5">·</span>
                                <span className="text-blue-700">לפי התוצאה כרגע (<span className="tabular-nums">{actual.home}-{actual.away}</span>)</span>
                              </p>
                              <div className="grid grid-cols-2 gap-1">
                                {picks.map((p) => (
                                  <PickChip key={p.name} name={p.name} home={p.home} away={p.away} hit={classifyHit({ home: p.home, away: p.away }, actual)} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Finished: result header + graded grid */}
                          {m.panel === "finished" && actual && counts && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">
                                תוצאה: <span className="tabular-nums text-gray-700">{actual.home}-{actual.away}</span>
                                <span className="mx-1.5">·</span>
                                <span className="text-green-700">🎯 {counts.exact} תפסו תוצאה</span>
                                <span className="mx-1">·</span>
                                <span className="text-amber-700">✓ {counts.toto} תפסו טוטו</span>
                                {counts.miss > 0 && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className="text-red-600">✗ {counts.miss} פספסו</span>
                                  </>
                                )}
                              </p>
                              <div className="grid grid-cols-2 gap-1">
                                {picks.map((p) => (
                                  <PickChip key={p.name} name={p.name} home={p.home} away={p.away} hit={classifyHit({ home: p.home, away: p.away }, actual)} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Related special bets */}
                          {specials.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">הימורים מיוחדים</p>
                              {specials.map((b, i) => (
                                <div key={i} className="flex items-center gap-1 text-[11px] text-gray-600">
                                  <span className="font-bold">{b.name}</span>
                                  <span className="text-gray-400">·</span>
                                  <span>{b.type}</span>
                                  <span className="text-gray-400">{b.detail}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 2 · באנר הימורים חסרים — the compact POST-LOCK variant ===== */}
      <SectionMark n={2} label="באנר הימורים חסרים — מהנעילה הוא עוקב רק אחרי מה שעוד פתוח (ניחושי יום המשחקים הקרוב)" />
      <div className="mb-5">
        <div className="bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-300 rounded-xl px-4 py-2.5 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-amber-900 min-w-0">
            ⚠️ חסרים לך 2 ניחושי תוצאה ליום המשחקים הקרוב
            <span className="font-medium text-amber-700"> · נעילה ב-21:30</span>
          </p>
          <span className="text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1 whitespace-nowrap shrink-0">השלם ←</span>
        </div>
      </div>

      {/* ===== 3 · כותרת + שתף ===== */}
      <SectionMark n={3} label="כותרת העמוד + כפתור שיתוף (חי — אפשר לנסות)" />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>טבלה</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openWhatsApp(shareText)}
            className="px-3 py-2 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.464A11.96 11.96 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.487 0-4.774-.846-6.592-2.266l-.46-.345-2.741.868.91-2.666-.38-.503A9.96 9.96 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
            שתף
          </button>
        </div>
      </div>

      {/* ===== 4 · טבלת דירוג ===== */}
      <SectionMark n={4} label="טבלת דירוג — עם תגיות מניף / הכבש?" />
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-visible hover:shadow-lg transition-all mb-6">
        <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
          <h2 className="text-base font-bold text-gray-800">טבלת דירוג</h2>
          <p className="text-xs text-gray-400 mt-0.5">לחצו על כותרת עמודה כדי למיין לפיה</p>
        </div>

        {/* Table header — mobile */}
        <div className="flex sm:hidden items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-9 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <span className="w-12 text-center font-semibold text-gray-500">כללי</span>
          <span className="w-12 text-center">היום</span>
          <span className="w-16 text-center font-semibold text-blue-600"><span className="inline-flex items-center gap-0.5">סה״כ<span className="text-[9px]">▼</span></span></span>
          <span className="w-8 text-center">שינוי</span>
        </div>
        {/* Table header — desktop */}
        <div className="hidden sm:flex items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-10 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <span className="w-14 text-center font-semibold text-gray-500">משחקים</span>
          <span className="w-14 text-center font-semibold text-gray-500">עולות</span>
          <span className="w-14 text-center font-semibold text-gray-500">מיוחדים</span>
          <span className="w-20 text-center">מגמה</span>
          <span className="w-12 text-center">היום</span>
          <span className="w-16 text-center font-semibold text-blue-600"><span className="inline-flex items-center gap-0.5">סה״כ<span className="text-[9px]">▼</span></span></span>
          <span className="w-8 text-center">שינוי</span>
        </div>

        {ROWS.map((p, i) => (
          <div key={p.id}
            className={`relative flex items-center px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
              p.isYou ? "bg-blue-50/50" : "hover:bg-gray-50/50"
            }`}
          >
            <span className="w-8 text-center font-bold text-base text-gray-400">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold me-2 ${
              i === 0 ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300" :
              i === 1 ? "bg-gray-200 text-gray-600" :
              i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
            }`}>{Array.from(p.name?.trim() || "?")[0]}</div>
            <div className="me-3 flex-1 min-w-0 relative">
              <span className="font-bold text-base text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">{p.name}</span>
              {p.isYou && <span className="text-xs text-blue-500 ms-1.5 bg-blue-100 rounded px-1.5 py-0.5 font-bold">אתה</span>}
              {p.id === LIFTER_ID && <span className="text-xs text-amber-700 ms-1.5 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 font-bold whitespace-nowrap">🏆 מניף</span>}
              {p.id === SHEEP_ID && <span className="text-xs text-gray-600 ms-1.5 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-bold whitespace-nowrap">🐑 הכבש?</span>}
            </div>
            <span className="w-12 text-center text-sm font-bold text-blue-600 sm:hidden" style={{ fontFamily: "var(--font-inter)" }}></span>
            <span className="w-14 text-center text-sm font-medium hidden sm:block text-gray-600" style={{ fontFamily: "var(--font-inter)" }}>{p.matchPts}</span>
            <span className="w-14 text-center text-sm font-medium hidden sm:block text-gray-600" style={{ fontFamily: "var(--font-inter)" }}>{p.advPts}</span>
            <span className="w-14 text-center text-sm font-medium hidden sm:block text-gray-600" style={{ fontFamily: "var(--font-inter)" }}>{p.specPts}</span>
            <div className="w-20 hidden sm:flex justify-center">
              <Sparkline data={p.history} highlight={!!p.isYou} />
            </div>
            <span className="w-12 text-center text-sm text-green-600 font-bold" style={{ fontFamily: "var(--font-inter)" }}>{p.today}</span>
            <span className="w-16 text-center font-black text-lg text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
              {p.total}
              {p.maxPossible > p.total && (
                <span className="block text-[10px] font-normal text-gray-400 leading-none">מקס {p.maxPossible}</span>
              )}
            </span>
            <span className="w-8 text-center text-sm font-bold text-gray-400">—</span>
          </div>
        ))}
      </div>

      {/* ===== 5 · מצטיין / חולשת היום (real component) ===== */}
      <SectionMark n={5} label="מצטיין וחולשת היום — מתחת לטבלה" />
      <HeroRoast
        hero={{ name: "דני", points: 12, highlight: "3 תוצאות מדויקות!" }}
        roast={{ name: "רועי", points: 0, highlight: "רק 0 — יום קשה" }}
        matchday=""
      />

      {/* ===== 6 · 🏅 תארים ===== */}
      <SectionMark n={6} label="תארים — מחושב בלוגיקת הפרודקשן" />
      <LeagueTitles awards={awards} />

      {/* ===== 7 · השוואת כל המהמרים (moved up per the proposal) ===== */}
      <SectionMark n={7} label="השוואת כל המהמרים" />
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all mb-6">
        <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
          <h2 className="text-lg font-bold text-gray-800">השוואת כל המהמרים</h2>
          <p className="text-sm text-gray-500">מי הכי חזק בכל קטגוריה?</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 font-semibold border-b border-gray-200" style={{ fontFamily: "var(--font-inter)" }}>
                <th className="py-3 px-4 text-start">שחקן</th>
                <th className="py-3 px-3 text-center font-bold">סה״כ</th>
                <th className="py-3 px-3 text-center">% טוטו</th>
                <th className="py-3 px-3 text-center">מדויקות</th>
                <th className="py-3 px-3 text-center">רצף</th>
                <th className="py-3 px-3 text-center">יום טוב</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((p) => (
                <tr key={p.id} className={`border-t border-gray-100 ${p.isYou ? "bg-blue-50/40" : "hover:bg-gray-50/30"}`}>
                  <td className="py-3 px-4 font-bold text-gray-900">{p.name} {p.isYou && <span className="text-xs text-blue-500 bg-blue-100 rounded px-1">אתה</span>}</td>
                  <td className="py-3 px-3 text-center font-black text-base" style={{ fontFamily: "var(--font-inter)" }}>{p.total}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`font-bold ${parseInt(p.toto) >= 60 ? "text-green-600" : parseInt(p.toto) >= 55 ? "text-amber-600" : "text-red-500"}`}>{p.toto}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-medium" style={{ fontFamily: "var(--font-inter)" }}>{p.exact}</td>
                  <td className="py-3 px-3 text-center text-amber-600 font-bold">{p.streak} 🔥</td>
                  <td className="py-3 px-3 text-center text-green-600 font-bold" style={{ fontFamily: "var(--font-inter)" }}>{p.bestDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== 8 · מירוץ הנקודות (real component) ===== */}
      <SectionMark n={8} label="מירוץ הנקודות" />
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">מירוץ הנקודות</h2>
        <LeaderboardRace
          data={[
            { name: "דני", color: "#3B82F6", history: [0, 3, 6, 9, 12, 16] },
            { name: "יוני", color: "#10B981", history: [0, 2, 3, 4, 7, 8] },
            { name: "אלכסנדר-מתתיהו", color: "#F59E0B", history: [0, 1, 2, 3, 4, 4] },
            { name: "אמית", color: "#8B5CF6", history: [0, 0, 1, 1, 2, 2] },
            { name: "רועי", color: "#EF4444", history: [0, 0, 0, 0, 0, 0] },
          ]}
          matchdays={["יום 1", "יום 2", "יום 3", "יום 4", "יום 5", "יום 6"]}
        />
      </div>

      {/* ===== Extra QA sections ===== */}
      <div className="mt-12 mb-2 flex items-center gap-2">
        <span className="h-px flex-1 bg-blue-200" />
        <p className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">עד כאן העמוד · מכאן בדיקות נוספות</p>
        <span className="h-px flex-1 bg-blue-200" />
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-black text-gray-900 mb-1">מקרי קצה — תיקו וסף מינימום</h2>
        <p className="text-sm text-gray-500 mb-3">
          אותה לוגיקה על דאטה &quot;תקוע&quot;: אלופות 2-2, שני זוגות זהים, 2 מדויקות לכל אחד (מתחת לסף 3).
          אף תואר לא מוענק — כולם אפורים עם הסבר מה חסר.
        </p>
        <LeagueTitles awards={awardsTied} />
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-black text-gray-900 mb-1">הודעת השיתוף לוואטסאפ</h2>
        <p className="text-sm text-gray-500 mb-3">
          ללא אימוג׳י מחוץ ל-BMP — אלה שנשברו ל-� בוואטסאפ דסקטופ. כל המהמרים נכללים (אין חיתוך ל-10).
        </p>
        <pre dir="rtl" className="bg-gray-900 text-gray-100 rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "var(--font-inter), monospace" }}>
          {shareText}
        </pre>
      </div>

      <div className="text-center text-xs text-gray-400 mt-12">
        הדף הזה לא מקושר מהאפליקציה — לבדיקה ידנית בלבד · /titles-preview
      </div>
    </div>
  );
}
