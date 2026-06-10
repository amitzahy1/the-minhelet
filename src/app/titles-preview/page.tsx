"use client";

// ============================================================================
// /titles-preview — visual QA page for the league-titles feature.
//
// Everything here is MOCK data, but the rendering REPLICATES THE REAL טבלה
// PAGE 1:1: same page header + share button, same leaderboard card markup
// (headers, columns, sparkline, "מקס"), and the real LeagueTitles component
// mounted directly below the table — exactly where it sits in production.
// The awards run through the REAL computeLeagueTitles, so the
// no-award-on-tie and minimum-threshold rules shown here are the prod rules.
// ============================================================================

import { computeLeagueTitles } from "@/lib/league-titles";
import { LeagueTitles } from "@/components/shared/LeagueTitles";
import { shareLeaderboard, openWhatsApp } from "@/lib/share";
import type { BettorBracket } from "@/lib/supabase/shared-data";
import type { FinishedMatch } from "@/lib/results-hits";
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
  // Day 1 — pair indices 0 ([0,1]) and 1 ([2,3]) of each group
  mkMatch(9001, D1, "A", 0, 2, 1), mkMatch(9002, D1, "A", 1, 1, 0),
  mkMatch(9003, D1, "B", 0, 1, 0), mkMatch(9004, D1, "B", 1, 3, 1),
  mkMatch(9005, D1, "C", 0, 1, 0), mkMatch(9006, D1, "C", 1, 2, 1),
  // Day 2 — pair indices 2 ([0,2]) and 3 ([1,3])
  mkMatch(9007, D2, "A", 2, 1, 1), mkMatch(9008, D2, "A", 3, 2, 0),
  mkMatch(9009, D2, "B", 2, 1, 1), mkMatch(9010, D2, "B", 3, 1, 1),
  mkMatch(9011, D2, "C", 2, 2, 2), mkMatch(9012, D2, "C", 3, 2, 2),
  // Day 3 — pair indices 4 ([0,3]) and 5 ([1,2])
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
  // דני — הצלף (4 exact hits) + half of the kissers pair
  mkBracket("u1", "דני", {
    champion: "ARG",
    tree: TREE_MAIN,
    scores: {
      A: { 0: [2, 1], 1: [1, 0], 2: [1, 1] },
      B: { 0: [1, 0] },
    },
  }),
  // רון ב — kissers: identical orders/tree/champion to דני, no score picks
  mkBracket("u2", "רון ב", { champion: "ARG", tree: TREE_MAIN }),
  // יוני — זאב בודד (only NZL) + מלך הכמעט (5 off-by-one) + הסגן הנצחי
  mkBracket("u3", "יוני", {
    champion: "NZL",
    tree: TREE_VAR1,
    scores: {
      A: { 0: [1, 1], 1: [2, 0], 3: [1, 0] },
      B: { 1: [3, 2], 4: [2, 1] },
      C: { 2: [2, 2] },
    },
  }),
  // אמית — מלך התיקו (6 predicted draws, none 0-0)
  mkBracket("u4", "אמית", {
    champion: "FRA",
    tree: TREE_VAR2,
    scores: {
      A: { 1: [2, 2], 2: [2, 2] },
      B: { 1: [2, 2], 2: [3, 3] },
      C: { 0: [2, 2], 4: [2, 2] },
    },
  }),
  // רון ג — ההייטר (three 0-0 picks)
  mkBracket("u5", "רון ג", {
    champion: "FRA",
    tree: TREE_VAR1,
    scores: {
      A: { 3: [0, 0] },
      B: { 3: [0, 0] },
      C: { 5: [0, 0] },
    },
  }),
  // דור דסא — מלך העולות (top-2 correct in all three finished groups)
  mkBracket("u6", "דור דסא", {
    champion: "FRA",
    tree: TREE_VAR2,
    orders: { A: [0, 2, 1, 3], B: [2, 0, 1, 3], C: [0, 2, 1, 3] },
  }),
  // רועי — המנותק (scrambled orders + opposite tree)
  mkBracket("u7", "רועי", {
    champion: "ARG",
    tree: TREE_OPP,
    orders: Object.fromEntries(Object.keys(GROUPS).map((l) => [l, [0, 3, 2, 1]])),
  }),
  // עידן — נביא הבתים (unique group winners in K and L)
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
  mkBracket("t1", "מהמר 1", { champion: "ARG", tree: TREE_MAIN, scores: { A: { 0: [2, 1], 1: [1, 0] } } }),
  mkBracket("t2", "מהמר 2", { champion: "ARG", tree: TREE_MAIN, scores: { B: { 0: [1, 0], 1: [3, 1] } } }),
  mkBracket("t3", "מהמר 3", { champion: "FRA", tree: TREE_OPP }),
  mkBracket("t4", "מהמר 4", { champion: "FRA", tree: TREE_OPP }),
];

// ---------------------------------------------------------------------------
// Mock leaderboard rows — same fields the real table renders.
// Row 3 stress-tests a long name + the "אתה" chip alongside title chips.
// ---------------------------------------------------------------------------

const ROWS = [
  { id: "u1", name: "דני", matchPts: 16, advPts: 0, specPts: 0, total: 16, maxPossible: 64, today: "+4", history: [0, 4, 8, 12, 12, 16], isYou: false },
  { id: "u3", name: "יוני", matchPts: 8, advPts: 0, specPts: 0, total: 8, maxPossible: 61, today: "+1", history: [0, 1, 2, 2, 7, 8], isYou: false },
  { id: "u9", name: "אלכסנדר-מתתיהו שם-ארוך-במיוחד", matchPts: 4, advPts: 0, specPts: 0, total: 4, maxPossible: 58, today: "0", history: [0, 1, 2, 3, 4, 4], isYou: true },
  { id: "u4", name: "אמית", matchPts: 2, advPts: 0, specPts: 0, total: 2, maxPossible: 55, today: "+2", history: [0, 0, 1, 1, 2, 2], isYou: false },
  { id: "u7", name: "רועי", matchPts: 0, advPts: 0, specPts: 0, total: 0, maxPossible: 49, today: "0", history: [0, 0, 0, 0, 0, 0], isYou: false },
];
const LIFTER_ID = "u1"; // unique first place
const SHEEP_ID = "u7";  // unique last place

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

function PreviewNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-2">
      <span className="h-px flex-1 bg-blue-200" />
      <p className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">{children}</p>
      <span className="h-px flex-1 bg-blue-200" />
    </div>
  );
}

export default function TitlesPreviewPage() {
  const awards = computeLeagueTitles(BRACKETS, FINISHED);
  const awardsTied = computeLeagueTitles(BRACKETS_TIED, FINISHED.slice(0, 4));
  const shareText = shareLeaderboard(
    ROWS.map((r, i) => ({ rank: i + 1, name: r.name, total: r.total, today: r.today })),
    ROWS.find((r) => r.id === SHEEP_ID)?.name ?? null,
    ROWS.find((r) => r.id === LIFTER_ID)?.name ?? null,
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24" dir="rtl">
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h1 className="text-2xl font-black text-gray-900">תצוגה מקדימה — תארים ותגיות</h1>
        <p className="text-sm text-gray-600 mt-1">
          נתוני דמה, אבל הרינדור זהה 1:1 לעמוד הטבלה האמיתי — אותו מרקאפ, אותם רכיבים, אותם חישובים
          (כולל חוקי &quot;אין תואר בתיקו&quot; וספי המינימום). מה שרואים כאן זה מה שעולה לאוויר.
        </p>
      </div>

      <PreviewNote>מכאן ולמטה — העתק מדויק של עמוד הטבלה כפי שייראה אחרי כמה ימי משחקים</PreviewNote>

      {/* === Page header — exact copy of the real טבלה header + share button === */}
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

      {/* === Leaderboard card — exact copy of the real markup === */}
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
            }`}>{p.name?.[0] || "?"}</div>
            <div className="me-3 flex-1 min-w-0 relative">
              <span className="font-bold text-base text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">{p.name}</span>
              {p.isYou && <span className="text-xs text-blue-500 ms-1.5 bg-blue-100 rounded px-1.5 py-0.5 font-bold">אתה</span>}
              {p.id === LIFTER_ID && <span className="text-xs text-amber-700 ms-1.5 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 font-bold whitespace-nowrap">🏆 המניף?</span>}
              {p.id === SHEEP_ID && <span className="text-xs text-gray-600 ms-1.5 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-bold whitespace-nowrap">🐑 הכבש?</span>}
            </div>
            {/* Mobile: show only the active tab value */}
            <span className="w-12 text-center text-sm font-bold text-blue-600 sm:hidden" style={{ fontFamily: "var(--font-inter)" }}></span>
            {/* Desktop: show all 3 + sparkline */}
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

      {/* === 🏅 תארים — the real component, in its real position (below the table) === */}
      <LeagueTitles awards={awards} />

      <PreviewNote>עד כאן העמוד האמיתי · מכאן בדיקות נוספות</PreviewNote>

      {/* === Edge cases: ties + below minimum === */}
      <div className="mb-10">
        <h2 className="text-xl font-black text-gray-900 mb-1">מקרי קצה — תיקו וסף מינימום</h2>
        <p className="text-sm text-gray-500 mb-3">
          אותה לוגיקה על דאטה &quot;תקוע&quot;: אלופות 2-2, שני זוגות זהים, 2 מדויקות לכל אחד (מתחת לסף 3).
          אף תואר לא מוענק — כולם אפורים עם הסבר מה חסר.
        </p>
        <LeagueTitles awards={awardsTied} />
      </div>

      {/* === WhatsApp share text === */}
      <div className="mb-10">
        <h2 className="text-xl font-black text-gray-900 mb-1">הודעת השיתוף לוואטסאפ</h2>
        <p className="text-sm text-gray-500 mb-3">
          מה שכפתור השיתוף למעלה באמת שולח — המניף והכבש מסומנים גם בקבוצה. הכפתור למעלה חי, אפשר לנסות.
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
