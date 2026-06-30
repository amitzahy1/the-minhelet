"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { SCORING, type ScoringValues } from "@/types";
import { computeCatchableStages, type KoSlotKey, type SlotState } from "@/lib/scoring/knockout-resolver";

interface SpecialBets {
  topScorer: { player: string; team: string };
  topAssists: { player: string; team: string };
  bestAttack: string;
  dirtiestTeam: string;
  matchup: string;
}

// Each bettor's advancement picks, kept SEPARATE per stage so we can show how
// many survive at every future round (R16 → champion) instead of one flat
// count. "Alive" = the picked team is still in the tournament (not eliminated),
// i.e. the bet can still come true.
interface WhosAliveBettor {
  name: string;
  champion: string;
  r16: string[]; // 16 teams predicted to reach the round of 16
  qf: string[]; // 8 → quarterfinal
  sf: string[]; // 4 → semifinal
  final: string[]; // 2 → final
  /** KO match-points still live (caught on played + open on unplayed), precomputed. */
  koPoints?: number;
  /** Max KO points still on the table for this bettor (the pot). Defaults to koPoints. */
  koPot?: number;
  /** Special-bet points the bettor is currently on track for (tentative + final). */
  specialPoints?: number;
  /** Max special-bet points the bettor could win (their picks at full value). */
  specialPot?: number;
  specialBets?: SpecialBets;
}

interface WhosAliveProps {
  bettors: WhosAliveBettor[];
  /** Teams knocked out of the tournament (from the real bracket). */
  eliminated?: Set<string>;
  /** LIVE_FEEDERS-resolved bracket — lets us count collision-aware reachers
   *  (two picks destined to meet can't both reach the round they share). */
  tree?: Record<KoSlotKey, SlotState> | null;
  /** Per-stage advancement point values (DB-driven scoring config). */
  weights?: ScoringValues["advancement"];
}

// Mock data — only used when the component is rendered with no real bettors.
const MOCK_BETTORS: WhosAliveBettor[] = [
  {
    name: "אמית",
    champion: "ARG",
    r16: ["ARG", "GER", "FRA", "BRA", "ESP", "ENG", "NED", "POR", "CRO", "BEL", "URU", "MAR", "JPN", "USA", "MEX", "SUI"],
    qf: ["ARG", "GER", "FRA", "BRA", "ESP", "ENG", "NED", "POR"],
    sf: ["ARG", "GER", "FRA", "BRA"],
    final: ["ARG", "GER"],
  },
  {
    name: "דני",
    champion: "NZL",
    r16: ["ARG", "FRA", "BRA", "GER", "ESP", "POR", "ENG", "NED", "NZL", "CRO", "URU", "SEN", "JPN", "USA", "MEX", "SUI"],
    qf: ["ARG", "FRA", "BRA", "GER", "ESP", "POR", "ENG", "NED"],
    sf: ["ARG", "FRA", "BRA", "GER"],
    final: ["ARG", "FRA"],
  },
];

function TeamTag({
  code,
  isAlive,
  isChampion,
}: {
  code: string;
  isAlive: boolean;
  isChampion: boolean;
}) {
  if (isChampion) {
    return isAlive ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 border border-green-300 shadow-sm shadow-green-200">
        <span className="text-sm">{getFlag(code)}</span>
        <span className="text-xs font-black text-green-800">
          {getTeamNameHe(code)}
        </span>
        <span className="text-green-600 text-xs">✓</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 border border-red-300">
        <span className="text-sm opacity-50">{getFlag(code)}</span>
        <span className="text-xs font-black text-red-400 line-through">
          {getTeamNameHe(code)}
        </span>
        <span className="text-sm">💀</span>
      </span>
    );
  }

  return isAlive ? (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-50 border border-green-200 text-xs">
      <span>{getFlag(code)}</span>
      <span className="font-bold text-green-700">{code}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-xs opacity-40">
      <span>{getFlag(code)}</span>
      <span className="font-bold text-gray-400 line-through">{code}</span>
    </span>
  );
}

// One per-stage survival pill: "רבע 6/8", coloured by how many survive.
function StageChip({ label, alive, total }: { label: string; alive: number; total: number }) {
  const ratio = total ? alive / total : 0;
  const cls =
    alive === total
      ? "bg-green-50 border-green-200 text-green-700"
      : ratio >= 0.5
      ? "bg-amber-50 border-amber-200 text-amber-700"
      : alive > 0
      ? "bg-orange-50 border-orange-200 text-orange-700"
      : "bg-red-50 border-red-200 text-red-500";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${cls}`}>
      <span className="font-bold">{label}</span>
      <span className="tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
        {alive}/{total}
      </span>
    </span>
  );
}

function getTeamStatus(
  team: string,
  alive: string[],
  dead: string[]
): "alive" | "dead" | "unknown" {
  if (alive.includes(team)) return "alive";
  if (dead.includes(team)) return "dead";
  return "unknown";
}

const STATUS_ICON: Record<"alive" | "dead" | "unknown", string> = {
  alive: "🟢",
  dead: "🔴",
  unknown: "🟡",
};

const STATUS_SUFFIX: Record<"alive" | "dead" | "unknown", string> = {
  alive: "הנבחרת בחיים",
  dead: "הנבחרת הודחה",
  unknown: "טרם הוכרע",
};

interface SpecialBetRow {
  label: string;
  value: string;
  status: "alive" | "dead" | "unknown";
  points: number;
}

function SpecialBetsSection({
  specialBets,
  alive,
  dead,
}: {
  specialBets: SpecialBets;
  alive: string[];
  dead: string[];
}) {
  const rows: SpecialBetRow[] = [
    {
      label: "מלך שערים",
      value: `${specialBets.topScorer.player} (${specialBets.topScorer.team})`,
      status: getTeamStatus(specialBets.topScorer.team, alive, dead),
      points: 9,
    },
    {
      label: "מלך אסיסטים",
      value: `${specialBets.topAssists.player} (${specialBets.topAssists.team})`,
      status: getTeamStatus(specialBets.topAssists.team, alive, dead),
      points: 7,
    },
    {
      label: "התקפה הכי טובה",
      value: specialBets.bestAttack,
      status: getTeamStatus(specialBets.bestAttack, alive, dead),
      points: 6,
    },
    {
      label: "הכי כסחנית",
      value: specialBets.dirtiestTeam,
      status: getTeamStatus(specialBets.dirtiestTeam, alive, dead),
      points: 5,
    },
    {
      label: "מאצ׳אפ",
      value: specialBets.matchup,
      status: "unknown" as const,
      points: 4,
    },
  ];

  return (
    <div className="px-4 py-2.5 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-500 mb-1.5">הימורים מיוחדים:</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5 text-xs">
            <span>{STATUS_ICON[row.status]}</span>
            <span className="font-bold text-gray-700">{row.label}:</span>
            <span className="text-gray-600">
              {row.value} — {STATUS_SUFFIX[row.status]}
            </span>
            <span className="text-gray-400 ms-auto whitespace-nowrap" style={{ fontFamily: "var(--font-inter)" }}>
              שווה {row.points} נק&apos;
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, x: 30 },
  show: { opacity: 1, x: 0 },
};

export default function WhosAlive({
  bettors = MOCK_BETTORS,
  eliminated = new Set<string>(),
  tree = null,
  weights = SCORING.advancement,
}: Partial<WhosAliveProps>) {
  // Per-bettor survival, broken out by stage + scored by the MAX advancement
  // points still reachable. "Reachable" is COLLISION-AWARE: per the real
  // bracket, two picks destined to meet before a round can't both reach it, so
  // we count distinct bracket regions, not raw surviving picks (see
  // computeReachableStages). That weighted "points alive" is the ranking key.
  const rows = useMemo(() => {
    const safeTree = (tree ?? {}) as Record<KoSlotKey, SlotState>;
    const mapped = bettors.map((b) => {
      // Catchable = stages a pick can STILL reach (collision-aware, excluding
      // stages already reached/banked). This is the "can still happen" view.
      const reach = computeCatchableStages(
        { r16: b.r16, qf: b.qf, sf: b.sf, final: b.final, champion: b.champion },
        safeTree,
        eliminated,
      );
      const r16 = { alive: reach.r16, total: b.r16.length };
      const qf = { alive: reach.qf, total: b.qf.length };
      const sf = { alive: reach.sf, total: b.sf.length };
      const fin = { alive: reach.final, total: b.final.length };
      const championPicked = !!b.champion;
      // Chip ✓/💀 shows whether the champion is still STANDING (not eliminated),
      // even once crowned — separate from whether its points are still catchable.
      const championAlive = championPicked && !eliminated.has(b.champion);
      // Advancement: alive = points still catchable (can still reach a new stage);
      // pot = the full value of his picks (max if every pick had come true).
      const advPoints =
        reach.r16 * weights.r16 +
        reach.qf * weights.qf +
        reach.sf * weights.sf +
        reach.final * weights.final +
        reach.champion * weights.winner;
      const advPot =
        b.r16.length * weights.r16 +
        b.qf.length * weights.qf +
        b.sf.length * weights.sf +
        b.final.length * weights.final +
        (championPicked ? weights.winner : 0);
      const koPoints = b.koPoints ?? 0;
      // Specials are shown on the side, NOT folded into the נק׳ חיות total — the
      // total is only advancement + knockout (toto/exact).
      const specialPoints = b.specialPoints ?? 0;
      const grandTotal = advPoints + koPoints;
      const grandPot = advPot + (b.koPot ?? koPoints);
      const pct = grandPot ? Math.round((grandTotal / grandPot) * 100) : 0;
      return { b, r16, qf, sf, fin, championAlive, championPicked, advPoints, koPoints, specialPoints, grandTotal, grandPot, pct };
    });
    return mapped.sort(
      (a, z) =>
        z.grandTotal - a.grandTotal ||
        Number(z.championAlive) - Number(a.championAlive) ||
        a.b.name.localeCompare(z.b.name, "he"),
    );
  }, [bettors, eliminated, tree, weights]);

  // League pot: the biggest "max possible" among bettors — shown in the header
  // so the per-row X/Y has context ("how many points are even in play").
  const leaguePot = useMemo(() => Math.max(0, ...rows.map((r) => r.grandPot)), [rows]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2
          className="text-3xl font-black text-gray-900"
          style={{ fontFamily: "var(--font-secular)" }}
        >
          מי עוד בחיים?
        </h2>
        <p className="text-base text-gray-600 mt-1">
          הנקודות שעוד אפשר לתפוס לכל מהמר (לא מה שכבר נתפס) — עולות (נבחרות שעוד יכולות להעפיל לשלב שלא הגיעו אליו; לפי הבראקט הרשמי, נבחרות שנפגשות נספרות פעם אחת) + נוקאאוט (טוטו ומדויקת — כל המשחקים שעוד לפנינו, פתוחים לכולם). מדורג מהכי חי. ההימורים המיוחדים שנתפסים כרגע מוצגים בנפרד בצד ואינם נכללים בסכום
        </p>
        {leaguePot > 0 && (
          <p className="text-sm text-gray-500 mt-1.5">
            סה״כ בקופה (מקסימום שעוד אפשר לגרוף):{" "}
            <b className="text-gray-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{leaguePot}</b>{" "}
            נק׳ · אצל כל מהמר מוצג כמה מתוכן עדיין חיות
          </p>
        )}
      </motion.div>

      {/* Bettors list */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        {rows.map(({ b, r16, qf, sf, fin, championAlive, championPicked, advPoints, koPoints, specialPoints, grandTotal, grandPot, pct }) => (
          <motion.div
            key={b.name}
            variants={item}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Header row: name · champion · points still alive */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <span className="text-base font-black text-gray-900 min-w-[60px]">
                {b.name}
              </span>

              {championPicked && (
                <TeamTag code={b.champion} isAlive={championAlive} isChampion />
              )}

              <div className="flex-1" />

              {/* Points-alive meter (max reachable advancement points still open) */}
              <div className="flex items-center gap-2 min-w-[150px]">
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                </div>
                <span
                  className="text-sm font-black text-gray-900 whitespace-nowrap tabular-nums"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {grandTotal}<span className="text-gray-400 font-bold">/{grandPot}</span>
                </span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">נק׳ חיות</span>
              </div>
            </div>

            {/* Per-stage survival chips */}
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-1.5">
              {r16.total > 0 && <StageChip label="שמינית" alive={r16.alive} total={r16.total} />}
              {qf.total > 0 && <StageChip label="רבע גמר" alive={qf.alive} total={qf.total} />}
              {sf.total > 0 && <StageChip label="חצי גמר" alive={sf.alive} total={sf.total} />}
              {fin.total > 0 && <StageChip label="גמר" alive={fin.alive} total={fin.total} />}
              {championPicked && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${
                    championAlive
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-500"
                  }`}
                >
                  <span className="font-bold">זוכה</span>
                  <span>{championAlive ? "✓" : "💀"}</span>
                </span>
              )}
            </div>

            {/* Breakdown of the נק׳ חיות total (עולות + נוקאאוט), with the
                currently-on-track specials shown SEPARATELY on the side. */}
            <div className="px-4 pb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
              <span>עולות <b className="text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{advPoints}</b></span>
              <span className="text-gray-300">·</span>
              <span>נוקאאוט <b className="text-gray-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{koPoints}</b></span>
              <span className="ms-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-100 text-violet-600 whitespace-nowrap">
                מיוחדים שנתפסים כרגע <b className="tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{specialPoints}</b>
              </span>
            </div>

            {/* Special bets (only when provided) */}
            {b.specialBets && (
              <SpecialBetsSection
                specialBets={b.specialBets}
                alive={[...new Set([...b.r16, ...b.qf, ...b.sf, ...b.final, b.champion])].filter(
                  (t) => t && !eliminated.has(t),
                )}
                dead={[...new Set([...b.r16, ...b.qf, ...b.sf, ...b.final, b.champion])].filter(
                  (t) => t && eliminated.has(t),
                )}
              />
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
