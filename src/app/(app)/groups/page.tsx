"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useBettingStore } from "@/stores/betting-store";
import { useToastStore } from "@/stores/toast-store";
import { GROUPS as GROUPS_RAW, getTeamByCode } from "@/lib/tournament/groups";
import { calculateStandings } from "@/lib/tournament/standings";
import { rankBestThirds, type ThirdsInputRow } from "@/lib/tournament/thirds-ranker";
import { FLAGS as __FLAGS } from "@/lib/flags";
import { loadRealFixtures, groupFixtureInfo, pairKey, type RealFixture } from "@/lib/fixtures-client";
import { toIsraelDate, toIsraelTimeShort } from "@/lib/timezone";
import { computeMatchDays, dayLockAtForKickoff, groupMatchStatus } from "@/lib/tournament/group-live-state";
import { saveLiveGroupScore, fetchSavedGroupScore } from "@/lib/supabase/sync";
import { classifyHit, type HitKind } from "@/lib/results-hits";
import { useScoring } from "@/hooks/useScoring";
import { SwipeableGroups } from "@/components/shared/SwipeableGroups";
import { SlotMachineScore } from "@/components/shared/SlotMachineScore";
import { SaveAndContinue } from "@/components/shared/SaveAndContinue";
import { formatLockDeadline, isLocked } from "@/lib/constants";
import type { GroupMatchPrediction, TiebreakReason } from "@/types";

// Groups data from tournament config
const GROUP_LETTERS = Object.keys(GROUPS_RAW);

function generateMatchups(codes: string[]) {
  const [a, b, c, d] = codes;
  // MUST mirror GROUP_MATCH_PAIRS in results-hits.ts ([0,1],[2,3],[0,2],[1,3],
  // [0,3],[1,2]) in both pair order AND home/away orientation — the scorer, the
  // bot generator and the admin editor all read scores[i] in that orientation.
  // (Matches 4+5 used to be {h:d,a:b},{h:d,a:a}: every human bracket stored
  // those two flipped, scored as misses while the page itself showed hits —
  // repaired by scripts/migrate-flip-pairs-3-4.ts on 2026-06-12.)
  return [{ h: a, a: b }, { h: c, a: d }, { h: a, a: c }, { h: b, a: d }, { h: a, a: d }, { h: b, a: c }];
}

function ScoreStepper({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-0 rounded border overflow-hidden ${disabled ? "border-gray-200 bg-gray-50/80" : "border-gray-200"}`}>
      <button disabled={disabled} onClick={() => onChange(Math.max(0, (value ?? 0) - 1))} aria-label="הפחת"
        className="w-9 h-10 flex items-center justify-center bg-gray-50 text-gray-400 text-sm font-bold hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50">−</button>
      <span className="w-7 h-8 flex items-center justify-center font-bold text-base tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
        {value !== null ? <SlotMachineScore value={value ?? 0} /> : <span className="text-gray-300 text-sm">-</span>}
      </span>
      <button disabled={disabled} onClick={() => onChange((value ?? -1) + 1)} aria-label="הוסף"
        className="w-9 h-10 flex items-center justify-center bg-gray-50 text-gray-400 text-sm font-bold hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50">+</button>
    </div>
  );
}

// The deciding criterion now comes straight from the standings engine
// (row.tiebreak_reason) — no re-guessing from the visible columns, which used to
// mislabel FIFA-ranking / fair-play gaps as "מפגש ישיר".
function tiebreakerLabel(reason: TiebreakReason | null | undefined): string | null {
  switch (reason) {
    case "h2h": return "מפגש ישיר";
    case "overall_gd": return "הפרש שערים";
    case "overall_gf": return "שערי בית";
    case "fair_play": return "הוגנות (כרטיסים)";
    case "fifa_rank": return "דירוג פיפ״א";
    case "lots": return "הגרלה";
    default: return null;
  }
}

function GroupView({ groupId }: { groupId: string }) {
  const teams = GROUPS_RAW[groupId];
  const scoring = useScoring();
  const groupState = useBettingStore((s) => s.groups[groupId]);
  const setGroupScore = useBettingStore((s) => s.setGroupScore);
  const setGroupOrder = useBettingStore((s) => s.setGroupOrder);

  // After the June-10 global lock we enter "live mode": the qualification table
  // (group.order) and advancement bets are FROZEN; only match scores stay
  // editable, locking per match-day (30 min before the day's first kickoff).
  const liveMode = isLocked();

  // `teams` is a stable reference (GROUPS_RAW[groupId] from a module constant),
  // so memoizing off it keeps `codes`/`matchups` stable without the React
  // Compiler flagging a manually-memoized derived array.
  const codes = useMemo(() => teams.map(t => t.code), [teams]);
  const matchups = useMemo(() => generateMatchups(codes), [codes]);

  // Real fixtures. We keep the FULL cross-group list (needed to cluster
  // match-days for the per-day lock) and derive this group's per-pair info
  // (date / status / result) from it. In live mode we refetch periodically so
  // locks flip and finished results land without a manual refresh. The
  // synthetic matchup order does NOT match the real FIFA matchday order, so we
  // sort the DISPLAY by real kickoff dates (store indices `i` are untouched, so
  // saved predictions stay correct).
  const [allFixtures, setAllFixtures] = useState<RealFixture[]>([]);
  useEffect(() => {
    let active = true;
    // Initial load uses the shared 2-min cache (cheap across group switches);
    // the live-mode interval force-refreshes so locks flip and results land.
    const load = (force: boolean) => loadRealFixtures(force).then(matches => { if (active) setAllFixtures(matches); });
    load(false);
    const id = liveMode ? setInterval(() => load(true), 90_000) : null;
    return () => { active = false; if (id) clearInterval(id); };
  }, [liveMode]);

  const fixtureInfo = useMemo(() => groupFixtureInfo(allFixtures, groupId), [allFixtures, groupId]);
  const matchDays = useMemo(() => computeMatchDays(allFixtures), [allFixtures]);

  // Tick "now" so per-match-day locks flip without a refetch (live mode only).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [liveMode]);

  const orderedIdx = useMemo(() => {
    const idx = matchups.map((_, i) => i);
    // Only reorder once we have a real date for EVERY pairing — a partial map
    // would scramble the list. Until then, keep the natural order.
    const hasAllDates = matchups.every(m => fixtureInfo[pairKey(m.h, m.a)]);
    if (!hasAllDates) return idx;
    return idx.sort((a, b) =>
      new Date(fixtureInfo[pairKey(matchups[a].h, matchups[a].a)].date).getTime() -
      new Date(fixtureInfo[pairKey(matchups[b].h, matchups[b].a)].date).getTime()
    );
  }, [matchups, fixtureInfo]);

  // Calculate standings from current scores (pre-tournament predicted table).
  const standings = useMemo(() => {
    const predictions: GroupMatchPrediction[] = matchups.map((m, i) => ({
      match_id: i,
      home_team_code: m.h,
      away_team_code: m.a,
      home_goals: groupState.scores[i].home ?? 0,
      away_goals: groupState.scores[i].away ?? 0,
    }));
    const hasAny = groupState.scores.some(s => s.home !== null);
    if (!hasAny) return null;
    return calculateStandings(
      teams.map(t => ({ id: t.id, code: t.code })),
      predictions
    );
  }, [groupState.scores, matchups, teams]);

  // Consequential card-decided ties in the predicted table. `needs_card_data`
  // sits on the LOWER team of a gap that fell through to FIFA ranking because
  // cards (which users can't predict) would be the next discriminator. We only
  // surface the boundaries that matter: 1st↔2nd (bracket seeding) and 2nd↔3rd
  // (advance vs out). 3rd↔4th is ignored — both are out anyway.
  const cardTieWarnings = useMemo(() => {
    if (!standings) return [] as { advancing: string; rival: string; boundary: "1-2" | "2-3" }[];
    const out: { advancing: string; rival: string; boundary: "1-2" | "2-3" }[] = [];
    if (standings[1]?.needs_card_data) out.push({ advancing: standings[0].team_code, rival: standings[1].team_code, boundary: "1-2" });
    if (standings[2]?.needs_card_data) out.push({ advancing: standings[1].team_code, rival: standings[2].team_code, boundary: "2-3" });
    return out;
  }, [standings]);

  // PRE-TOURNAMENT ONLY: write the computed standings back into `group.order`
  // so the bracket page reads the predicted qualifiers. In LIVE mode the order
  // is the FROZEN qualification bet (locked June 10) — never recompute it from
  // the now-editable scores, or editing a result would silently move who the
  // user predicted to advance.
  useEffect(() => {
    if (liveMode) return;
    if (!standings) return;
    const teamIdxByCode: Record<string, number> = {};
    teams.forEach((t, i) => { teamIdxByCode[t.code] = i; });
    const newOrder = standings
      .map(row => teamIdxByCode[row.team_code])
      .filter(i => i !== undefined);
    if (newOrder.length !== 4) return;
    const sameAsCurrent = newOrder.every((v, i) => v === groupState.order[i]);
    if (!sameAsCurrent) setGroupOrder(groupId, newOrder);
  }, [standings, groupId, groupState.order, setGroupOrder, teams, liveMode]);

  const filledCount = groupState.scores.filter(s => s.home !== null && s.away !== null).length;
  const isComplete = filledCount === 6;

  // Live mode: persist each edited score per match-day (debounced). The server
  // (save_live_group_score) enforces the lock; surface a toast on rejection.
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Per-match save feedback (mobile had no visible confirmation): "saving" while
  // the debounced write is in flight, "saved" briefly on success.
  const [saveState, setSaveState] = useState<Record<number, "saving" | "saved">>({});
  const savedClearTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const scheduleGroupSave = (pairIdx: number) => {
    if (saveTimers.current[pairIdx]) clearTimeout(saveTimers.current[pairIdx]);
    setSaveState((s) => ({ ...s, [pairIdx]: "saving" }));
    saveTimers.current[pairIdx] = setTimeout(async () => {
      const mm = matchups[pairIdx];
      const info = fixtureInfo[pairKey(mm.h, mm.a)];
      const lockAt = dayLockAtForKickoff(info?.date, matchDays);
      const sc = useBettingStore.getState().groups[groupId]?.scores?.[pairIdx];
      if (!sc) return;
      const res = await saveLiveGroupScore(groupId, pairIdx, { home: sc.home, away: sc.away }, lockAt);
      if (res.success) {
        // Flash "נשמר ✓" then clear it after a moment.
        setSaveState((s) => ({ ...s, [pairIdx]: "saved" }));
        if (savedClearTimers.current[pairIdx]) clearTimeout(savedClearTimers.current[pairIdx]);
        savedClearTimers.current[pairIdx] = setTimeout(() => {
          setSaveState((s) => { const n = { ...s }; delete n[pairIdx]; return n; });
        }, 2000);
      } else if (typeof window !== "undefined") {
        setSaveState((s) => { const n = { ...s }; delete n[pairIdx]; return n; });
        // The optimistic local value didn't persist (locked / network / error).
        // Revert the on-screen score to what's ACTUALLY saved on the server so
        // the bettor never believes a change saved when it didn't — the
        // divergence that left a user's browser showing a score the DB (and
        // therefore the scoring engine) never had.
        const saved = await fetchSavedGroupScore(groupId, pairIdx);
        if (saved && saved.home !== null && saved.away !== null) {
          const store = useBettingStore.getState();
          store.setGroupScore(groupId, pairIdx, "home", saved.home);
          store.setGroupScore(groupId, pairIdx, "away", saved.away);
        }
        useToastStore.getState().push((res.error || "שמירת התוצאה נכשלה") + " · הוחזר לערך השמור בשרת", "error", 5000);
      }
    }, 800);
  };

  const handleScore = (matchIdx: number, side: "home" | "away", value: number) => {
    setGroupScore(groupId, matchIdx, side, value);
    if (liveMode) scheduleGroupSave(matchIdx);
  };

  // Deep link target: ?group=<this letter>&match=<pairIdx> → scroll to the
  // row and flash it so the bettor lands straight on the match they tapped.
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("group")?.toUpperCase() !== groupId) return;
      const idx = Number(params.get("match"));
      if (!Number.isInteger(idx) || idx < 0 || idx > 5) return;
      setHighlightIdx(idx);
      const t = setTimeout(() => {
        document.getElementById(`bet-row-${groupId}-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
      const clear = setTimeout(() => setHighlightIdx(null), 3500);
      return () => { clearTimeout(t); clearTimeout(clear); };
    } catch { /* ignore */ }
  }, [groupId]);

  const getTeam = (code: string) => teams.find(t => t.code === code)!;
  const getFlag = (code: string) => __FLAGS[code] || "🏳️";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Progress — pre-tournament only (in live mode scores aren't a completion task) */}
      {!liveMode && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${(filledCount / 6) * 100}%` }}></div>
          </div>
          <span className="text-xs text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{filledCount}/6</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* RIGHT — Table (mobile: appears below the bets) */}
        <div className="order-2 lg:order-1">
          {liveMode ? (
            /* LIVE: the qualification table is the FROZEN June-10 order, read-only.
               We deliberately do NOT show per-team stats here — those would reflect
               the now-editable scores and contradict "the table is locked". */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-800">
                <p className="text-base font-bold text-white">הטבלה החזויה שלך — נעולה 🔒</p>
                <p className="text-sm text-gray-300">הימור העלייה ננעל לפני הטורניר · עכשיו ניתן לעדכן רק תוצאות</p>
              </div>
              <ul>
                {groupState.order.map((teamIdx, pos) => {
                  const t = teams[teamIdx];
                  if (!t) return null;
                  return (
                    <li key={t.code} className={`flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 ${pos < 2 ? "bg-green-50/40" : pos === 2 ? "bg-amber-50/30" : ""}`}>
                      <span className="w-5 text-center font-black text-gray-300 text-base" style={{ fontFamily: "var(--font-inter)" }}>{pos + 1}</span>
                      <span className="text-lg">{getFlag(t.code)}</span>
                      <span className="font-bold text-gray-900 flex-1">{t.name_he}</span>
                      {pos < 2 && <span className="text-[10px] font-bold text-green-700 bg-green-100 rounded px-1.5 py-0.5">עולה</span>}
                      {pos === 2 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">מקום 3</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
                <p className="text-[12px] text-gray-500 leading-snug">
                  מי עולה מהבית ננעל לפני הטורניר ולא משתנה. עדכון תוצאה משפיע רק על ניקוד התוצאה (טוטו/מדויקת) — לא על ההימור מי עולה.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-800 flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-white">הטבלה החזויה שלך</p>
                  <p className="text-sm text-gray-300">מחושבת מההימורים שלך (לא מתוצאות אמת)</p>
                </div>
                {isComplete && <span className="text-sm text-green-300 font-medium bg-green-900/40 px-3 py-1 rounded-full border border-green-600/30">סופי</span>}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 bg-gray-50 text-xs font-semibold">
                    <th className="py-2.5 ps-4 text-start w-8">#</th>
                    <th className="py-2.5 text-start">קבוצה</th>
                    <th className="py-2.5 text-center w-8">מש</th>
                    <th className="py-2.5 text-center w-8">נצ</th>
                    <th className="py-2.5 text-center w-8">תק</th>
                    <th className="py-2.5 text-center w-8">הפ</th>
                    <th className="py-2.5 text-center w-12">שערים</th>
                    <th className="py-2.5 text-center w-12">הפרש</th>
                    <th className="py-2.5 pe-4 text-center w-12 font-bold">נקודות</th>
                  </tr>
                </thead>
                <tbody>
                  {(standings || teams.map(t => ({
                    team_code: t.code, position: 0, played: 0, won: 0, drawn: 0, lost: 0,
                    goals_for: 0, goals_against: 0, goal_difference: 0, points: 0, team_id: t.id, fair_play_score: 0,
                    tiebreak_reason: null as TiebreakReason | null, needs_card_data: false,
                  }))).map((row, i) => {
                    const tbLabel = standings ? tiebreakerLabel(row.tiebreak_reason) : null;
                    return (
                    <tr key={row.team_code} className={`border-t border-gray-100 ${standings && i < 2 ? "bg-green-50/40" : standings && i === 2 ? "bg-amber-50/30" : ""}`}>
                      <td className="py-3 ps-4 font-bold text-gray-300 text-base">
                        <span>{i + 1}</span>
                        {tbLabel && (
                          <span className="block text-[9px] font-bold text-amber-600 bg-amber-100 rounded px-1 mt-0.5 leading-tight">{tbLabel}</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{getFlag(row.team_code)}</span>
                          <span className="font-bold text-gray-900">{getTeam(row.team_code).name_he}</span>
                        </span>
                      </td>
                      <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.played}</td>
                      <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.won}</td>
                      <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.drawn}</td>
                      <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.lost}</td>
                      <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.goals_for}:{row.goals_against}</td>
                      <td className="text-center text-gray-600 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>{row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}</td>
                      <td className="pe-4 text-center font-black text-gray-900 text-base" style={{ fontFamily: "var(--font-inter)" }}>{row.points}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Card-tie warning (pre-tournament only): the order hinges on cards,
              which can't be predicted, so it fell to FIFA ranking. Non-blocking. */}
          {!liveMode && cardTieWarnings.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-bold text-amber-900">⚠️ שובר שוויון על כרטיסים</p>
              {cardTieWarnings.map((w) => (
                <p key={w.boundary} className="text-[13px] text-amber-800 mt-1 leading-snug">
                  <strong>{getTeam(w.advancing).name_he}</strong> ו<strong>{getTeam(w.rival).name_he}</strong> שוות לגמרי בהימור שלך (נקודות, מפגש ישיר, הפרש שערים ושערים).{" "}
                  {w.boundary === "2-3"
                    ? <>מי שעולה ייקבע לפי כרטיסים — ואי אפשר להמר על כרטיסים. כרגע <strong>{getTeam(w.advancing).name_he}</strong> עולה לפי דירוג פיפ״א.</>
                    : <>מקום 1 מול 2 ייקבע לפי כרטיסים. כרגע <strong>{getTeam(w.advancing).name_he}</strong> ראשונה לפי דירוג פיפ״א.</>}
                </p>
              ))}
              <p className="text-[12px] text-amber-700 mt-1.5">רוצה לקבוע בעצמך? שנה תוצאה כך שלא יהיה תיקו מוחלט.</p>
            </div>
          )}

          {/* How advancers from the group are counted (under the table, pre-tournament). */}
          {!liveMode && (
            <details className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-bold text-blue-900 flex items-center gap-2 list-none">
                <span>ℹ️ איך נספרות עולות מהבית?</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </summary>
              <div className="mt-2 space-y-1.5 text-blue-900 text-[13px] leading-relaxed">
                <p>
                  מונדיאל 2026 — 48 נבחרות, 12 בתים של 4. לשלב 32 הגדולות עולות 32 נבחרות:
                  1-2 מכל בית (24 נבחרות) + 8 המקומות השלישיים הטובים ביותר (מתוך 12).
                </p>
                <p className="font-bold">
                  ✓ כל נבחרת שהיגיעה לשלב 32 הגדולות נחשבת &quot;עולה&quot; — גם אם עלתה ממקום שלישי.
                </p>
                <p className="text-blue-800/90">
                  אם הימרת שקבוצה X תעלה מהבית והיא באמת הגיעה ל-32 הגדולות (בכל מסלול), תקבל/י ניקוד:
                  שתי הנבחרות שהימרת עליהן עלו → <b>עולה מדויקת</b>, אחת מהן עלתה → <b>חלקי</b>.
                </p>
              </div>
            </details>
          )}

          {/* How ties are broken (FIFA 2026 order) — shown under the table. */}
          {standings && (
            <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-2.5">
              <summary className="text-[13px] font-semibold text-gray-600 cursor-pointer">איך נקבע שובר השוויון בין קבוצות עם אותן נקודות?</summary>
              <ol className="text-[12px] text-gray-600 mt-2 space-y-0.5 list-decimal pe-5">
                <li>נקודות</li>
                <li>מפגש ישיר — נקודות → הפרש שערים → שערים, רק במשחקים בין הקבוצות השוות</li>
                <li>הפרש שערים כללי</li>
                <li>שערים כללי</li>
                <li>הוגנות — פחות כרטיסים (צהוב=1, אדום=3)</li>
                <li>דירוג פיפ״א</li>
              </ol>
              <p className="text-[11px] text-gray-400 mt-1.5">לפי תקנון פיפ״א 2026 — המפגש הישיר קודם להפרש השערים. כרטיסים אינם ניתנים לחיזוי, ולכן תיקו שמגיע לשלב הכרטיסים מוכרע בהימור שלך לפי דירוג פיפ״א.</p>
            </details>
          )}

        </div>

        {/* LEFT — Match bets (mobile: appears above the predicted table) */}
        <div className="order-1 lg:order-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:sticky lg:top-24">
            <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-800">הימורי תוצאות</p>
                <p className="text-sm text-gray-500">{liveMode ? "עדכנו תוצאות · כל יום משחקים ננעל 30 ד׳ לפני המשחק הראשון שלו" : "הזינו תוצאה מדויקת לכל משחק"}</p>
              </div>
              <div className="text-sm text-gray-500 text-end leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
                <span className="block">טוטו: <strong className="text-blue-600">{scoring.toto.GROUP} נק׳</strong></span>
                <span className="block">מדויקת: <strong className="text-green-600">+{scoring.exact.GROUP} נק׳</strong></span>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {orderedIdx.map((i, pos) => {
                const m = matchups[i];
                const info = fixtureInfo[pairKey(m.h, m.a)];
                const isFilled = groupState.scores[i].home !== null && groupState.scores[i].away !== null;
                // Orient the RIGHT side (RTL) to the real home team — the "1" in
                // 1X2. The round-robin generator's h/a is arbitrary, so fall back
                // to m.h as home only when we have no real fixture. Store keys
                // ("home"/"away") stay tied to m.h/m.a, so saved scores and
                // standings are unaffected — only the visual side flips.
                const homeIsMh = !info || info.home === m.h;
                const rightTeam = getTeam(homeIsMh ? m.h : m.a);
                const rightKey: "home" | "away" = homeIsMh ? "home" : "away";
                const leftTeam = getTeam(homeIsMh ? m.a : m.h);
                const leftKey: "home" | "away" = homeIsMh ? "away" : "home";
                // Once sorted by real date, the 6 matches fall into 3 matchdays
                // of 2. Show a "מחזור N · date" header before each pair so it's
                // unmistakable which bet is first and which is the last (often a
                // dead rubber). Headers only render when real dates are loaded.
                const showHeader = !!info && pos % 2 === 0;
                const matchday = Math.floor(pos / 2) + 1;

                // Live mode: per-match-day lock + finished result vs the pick.
                // Until the schedule has loaded we show a neutral "loading" state
                // (not "open") so editing never appears available before we know
                // the lock — the server enforces the real lock regardless.
                const scheduleReady = matchDays.length > 0;
                const dayLockAt = liveMode && scheduleReady ? dayLockAtForKickoff(info?.date, matchDays) : null;
                const status: "open" | "locked" | "finished" | "loading" = !liveMode
                  ? "open"
                  : !scheduleReady
                    ? "loading"
                    : groupMatchStatus(info?.status, dayLockAt, now);
                const editable = !liveMode || status === "open";
                let hit: HitKind | null = null;
                let realRight: number | null = null;
                let realLeft: number | null = null;
                if (liveMode && status === "finished" && info && info.homeGoals != null && info.awayGoals != null) {
                  // rightTeam is always the real home team → right = homeGoals.
                  realRight = info.homeGoals;
                  realLeft = info.awayGoals;
                  const predForPair = { home: groupState.scores[i].home, away: groupState.scores[i].away };
                  const actualForPair = info.home === m.h
                    ? { home: info.homeGoals, away: info.awayGoals }
                    : { home: info.awayGoals, away: info.homeGoals };
                  hit = classifyHit(predForPair, actualForPair);
                }
                const rowClass = !liveMode
                  ? (isFilled ? "bg-green-50/30 border-green-200" : "bg-gray-50/50 border-gray-100")
                  : status === "finished"
                    ? (hit === "exact" ? "bg-green-50 border-green-300" : hit === "toto" ? "bg-blue-50/50 border-blue-200" : hit === "miss" ? "bg-red-50/40 border-red-200" : "bg-gray-50/50 border-gray-100")
                    : (status === "locked" || status === "loading")
                      ? "bg-gray-100/70 border-gray-200"
                      : (isFilled ? "bg-green-50/30 border-green-200" : "bg-gray-50/50 border-gray-100");
                return (
                  <Fragment key={i}>
                    {showHeader && (
                      <div className="flex items-center gap-2 pt-2 first:pt-0">
                        <span className="text-[11px] font-black text-gray-500 shrink-0">מחזור {matchday}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">· {info ? toIsraelDate(info.date) : ""}</span>
                        <span className="flex-1 h-px bg-gray-100" />
                      </div>
                    )}
                    <div
                      id={`bet-row-${groupId}-${i}`}
                      className={`rounded-lg border transition-all ${rowClass}${highlightIdx === i ? " ring-2 ring-blue-400 ring-offset-1" : ""}`}
                    >
                      <div className="flex items-center px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-lg shrink-0">{getFlag(rightTeam.code)}</span>
                          <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{rightTeam.name_he}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mx-1 sm:mx-2">
                          <ScoreStepper value={groupState.scores[i][rightKey]} onChange={(v) => handleScore(i, rightKey, v)} disabled={!editable} />
                          <span className="text-gray-300 text-sm">:</span>
                          <ScoreStepper value={groupState.scores[i][leftKey]} onChange={(v) => handleScore(i, leftKey, v)} disabled={!editable} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                          <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{leftTeam.name_he}</span>
                          <span className="text-lg shrink-0">{getFlag(leftTeam.code)}</span>
                        </div>
                      </div>
                      {liveMode && (
                        <div className="px-3 pb-1.5 -mt-0.5 flex items-center justify-center gap-1.5 text-[11px]">
                          {/* Save feedback (overrides the status text while active) */}
                          {status === "open" && saveState[i] === "saving" && (
                            <span className="text-gray-400 font-semibold inline-flex items-center gap-1">
                              <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                              שומר…
                            </span>
                          )}
                          {status === "open" && saveState[i] === "saved" && (
                            <span className="text-green-600 font-bold inline-flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                              ✓ נשמר
                            </span>
                          )}
                          {status === "loading" && (
                            <span className="text-gray-400 font-semibold">טוען זמני נעילה…</span>
                          )}
                          {status === "open" && !saveState[i] && (
                            <span className="text-blue-600 font-semibold">
                              🔓 ניתן לעדכן{dayLockAt ? ` · ננעל ב-${toIsraelTimeShort(dayLockAt)}` : ""}
                            </span>
                          )}
                          {status === "locked" && (
                            <span className="text-gray-500 font-semibold">🔒 ננעל — יום המשחקים התחיל</span>
                          )}
                          {status === "finished" && (
                            <span className="font-semibold text-gray-700">
                              תוצאה: <span style={{ fontFamily: "var(--font-inter)" }}>{realRight}–{realLeft}</span>
                              {" · "}
                              {hit === "exact" ? <span className="text-green-700">✓ מדויקת (+3)</span>
                                : hit === "toto" ? <span className="text-blue-700">טוטו (2)</span>
                                : hit === "miss" ? <span className="text-red-600">לא קלעת</span>
                                : <span className="text-gray-400">לא ניחשת</span>}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Best third-placed teams, computed from the USER'S predicted group tables.
// 8 of 12 thirds advance (FIFA ranking: pts → GD → GF → fair-play → world rank).
// Doubles as a check that the R32 third-place teams in the simulation tree match.
function BestThirdsPredicted() {
  const groups = useBettingStore((s) => s.groups);
  const { ranked, completeCount } = useMemo(() => {
    const rows: ThirdsInputRow[] = [];
    let complete = 0;
    for (const letter of GROUP_LETTERS) {
      const teams = GROUPS_RAW[letter];
      const g = groups[letter];
      const codes = teams.map((t) => t.code);
      const filled = g?.scores?.filter((s) => s.home !== null && s.away !== null).length ?? 0;
      if (filled < 6) continue;
      complete++;
      const preds: GroupMatchPrediction[] = generateMatchups(codes).map((m, i) => ({
        match_id: i,
        home_team_code: m.h,
        away_team_code: m.a,
        home_goals: g.scores[i].home ?? 0,
        away_goals: g.scores[i].away ?? 0,
      }));
      const standings = calculateStandings(teams.map((t) => ({ id: t.id, code: t.code })), preds);
      const third = standings[2];
      if (!third) continue;
      rows.push({
        group: letter,
        team_code: third.team_code,
        played: 3,
        points: third.points,
        goal_difference: third.goal_difference,
        goals_for: third.goals_for,
        fifa_ranking: getTeamByCode(third.team_code)?.fifa_ranking,
      });
    }
    return { ranked: rankBestThirds(rows).ranked, completeCount: complete };
  }, [groups]);

  const teamName = (code: string) => getTeamByCode(code)?.name_he || code;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-l from-amber-50 to-white border-b border-amber-100">
        <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>🥉 המקומות השלישיים הטובים</h2>
        <p className="text-sm text-gray-500 mt-0.5">8 מתוך 12 עולות לשלב 32 — מחושב מהטבלאות שניחשת</p>
      </div>

      {completeCount < 12 && (
        <div className="mx-4 mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">
          השלמת {completeCount}/12 בתים. הדירוג ייסגר סופית רק אחרי שכל 12 הבתים מלאים — מה שמוצג כאן מבוסס על הבתים שכבר מילאת.
        </div>
      )}

      {ranked.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">מלאו תוצאות בבתים כדי לראות את דירוג המקומות השלישיים.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 bg-gray-50 text-xs font-semibold">
              <th className="py-2.5 ps-4 text-start w-8">#</th>
              <th className="py-2.5 text-start">נבחרת</th>
              <th className="py-2.5 text-center w-10">בית</th>
              <th className="py-2.5 text-center w-12">נק׳</th>
              <th className="py-2.5 text-center w-12">הפרש</th>
              <th className="py-2.5 text-center w-12">שערים</th>
              <th className="py-2.5 pe-4 text-center w-16" title="דירוג עולמי — שובר שוויון">דירוג פיפ״א</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => {
              const qualifies = i < 8;
              // The FIFA ranking is what separated this team from the one above it
              // when they're level on pts / GD / GF (fair-play isn't tracked for
              // predictions) — flag that so the order is transparent.
              const prev = i > 0 ? ranked[i - 1] : null;
              const decidedByRanking = !!prev
                && prev.points === r.points
                && prev.goal_difference === r.goal_difference
                && prev.goals_for === r.goals_for;
              return (
                <tr key={r.group} className={`border-t border-gray-100 ${qualifies ? "bg-green-50/50" : "opacity-60"}`}>
                  <td className="py-3 ps-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${qualifies ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`} style={{ fontFamily: "var(--font-inter)" }}>{i + 1}</span>
                  </td>
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{__FLAGS[r.team_code] || "🏳️"}</span>
                      <span className="font-bold text-gray-900">{teamName(r.team_code)}</span>
                      {qualifies && <span className="text-[10px] font-bold text-green-700 bg-green-100 rounded px-1.5 py-0.5">עולה</span>}
                      {decidedByRanking && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5" title="הופרד מהקבוצה שמעל לפי דירוג פיפ״א">שובר: דירוג</span>}
                    </span>
                  </td>
                  <td className="text-center font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{r.group}</td>
                  <td className="text-center font-black text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{r.points}</td>
                  <td className="text-center text-gray-600 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>{r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}</td>
                  <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{r.goals_for}</td>
                  <td className="text-center pe-4" style={{ fontFamily: "var(--font-inter)" }}>
                    <span className={`text-[12px] font-semibold ${decidedByRanking ? "text-amber-700 bg-amber-100 rounded px-1.5 py-0.5" : "text-gray-400"}`}>
                      {r.fifa_ranking ?? "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 space-y-1">
        <p className="text-[12px] text-gray-500 leading-snug">
          סדר השובר (לפי פיפ״א): <strong>נקודות → הפרש שערים → שערי זכות → דירוג עולמי</strong>. דירוג פיפ״א (מספר נמוך = טוב יותר) שובר שוויון כשהכול שווה — מסומן בכתום.
        </p>
        <p className="text-[12px] text-gray-500 leading-snug">
          8 הירוקות הן השלישיות שעולות לשלב 32 — ואלו בדיוק הנבחרות שמופיעות במשבצות המקום-השלישי ב<Link href="/knockout" className="font-bold underline">עץ הסימולציה</Link>. אם משהו לא תואם — בדקו את התוצאות בבתים.
        </p>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const currentGroupIndex = useBettingStore((s) => s.currentGroupIndex);
  const setCurrentGroupIndex = useBettingStore((s) => s.setCurrentGroupIndex);
  const [showThirds, setShowThirds] = useState(false);

  // First-ever visit to /groups → land on group A. Returning visitors keep their place.
  useEffect(() => {
    try {
      if (!localStorage.getItem("wc_groups_visited")) {
        setCurrentGroupIndex(0);
        localStorage.setItem("wc_groups_visited", "1");
      }
    } catch { /* ignore */ }
  }, [setCurrentGroupIndex]);

  // Deep link from the schedule / today-matches cards: /groups?group=B&match=4
  // selects the group (GroupView handles the scroll-to-row). Read from
  // window.location instead of useSearchParams to avoid the Suspense-boundary
  // requirement on a client page.
  useEffect(() => {
    try {
      const g = new URLSearchParams(window.location.search).get("group")?.toUpperCase();
      if (g && GROUP_LETTERS.includes(g)) setCurrentGroupIndex(GROUP_LETTERS.indexOf(g));
    } catch { /* ignore */ }
  }, [setCurrentGroupIndex]);

  const completedGroups = useBettingStore((s) =>
    GROUP_LETTERS.filter((l) =>
      s.groups[l].scores.filter((sc) => sc.home !== null && sc.away !== null).length === 6
    ).length
  );
  const totalFilled = useBettingStore((s) =>
    GROUP_LETTERS.reduce(
      (sum, l) => sum + s.groups[l].scores.filter((sc) => sc.home !== null && sc.away !== null).length,
      0
    )
  );
  const groupId = GROUP_LETTERS[currentGroupIndex];

  // After the June-10 lock: tournament "live mode" — only match scores stay
  // editable (per match-day), and all the pre-tournament chrome (qualification
  // helpers, completion CTAs, the full-bracket Save button) is hidden.
  const liveMode = isLocked();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>שלב הבתים</h1>
        <p className="text-base text-gray-600 mt-1">
          {liveMode
            ? "הטורניר בעיצומו — עדכנו תוצאות משחקים. הימור העלייה (מי מהבית) ננעל ולא משתנה."
            : "סדרו את הקבוצות, הזינו תוצאות — הטבלה מתעדכנת אוטומטית לפי חוקי FIFA"}
        </p>
      </div>

      {/* Peer pressure — who hasn't finished? (pre-tournament only) */}
      {!liveMode && completedGroups < 12 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <p className="text-sm font-bold text-amber-800">
            {completedGroups === 0
              ? "אף אחד עוד לא התחיל — תהיו הראשונים!"
              : `השלמת ${completedGroups}/12 בתים. ${12 - completedGroups} בתים נותרו — אל תישארו מאחור!`}
          </p>
        </div>
      )}

      {/* All-groups-complete CTA → next step (pre-tournament only) */}
      {!liveMode && completedGroups === 12 && (
        <Link
          href="/knockout"
          className="mb-4 bg-gradient-to-l from-green-500 to-emerald-600 text-white rounded-xl px-5 py-4 flex items-center justify-between gap-3 shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-base font-black">סיימת את שלב הבתים!</p>
              <p className="text-sm text-green-50">המשך לשלב 2 — עץ הטורניר</p>
            </div>
          </div>
          <span className="text-2xl font-black">←</span>
        </Link>
      )}

      {/* Groups navigator */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-black text-gray-700 tracking-wide" style={{ fontFamily: "var(--font-secular)" }}>בתים</h2>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-2.5 py-1 shadow-sm shrink-0">
            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${completedGroups === 12 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${(totalFilled / 72) * 100}%` }}></div>
            </div>
            <span className="text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{completedGroups}/12</span>
          </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap">
          {GROUP_LETTERS.map((letter, i) => {
            const filled = useBettingStore.getState().getGroupFilledCount(letter);
            const done = filled === 6;
            return (
              <button key={letter} onClick={() => { setShowThirds(false); setCurrentGroupIndex(i); }}
                className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg text-base sm:text-lg font-black transition-all ${
                  !showThirds && i === currentGroupIndex ? "bg-gray-900 text-white shadow-md scale-110" :
                  done ? "bg-green-100 text-green-700 border border-green-200" :
                  filled > 0 ? "bg-blue-50 text-blue-600 border border-blue-200" :
                  "bg-gray-100 text-gray-400"
                }`} style={{ fontFamily: "var(--font-inter)" }}>
                {letter}
              </button>
            );
          })}
          {/* Best-thirds view — pre-tournament only (recomputes from scores) */}
          {!liveMode && (
            <button onClick={() => setShowThirds(true)}
              title="המקומות השלישיים הטובים"
              className={`shrink-0 h-10 sm:h-11 px-3 rounded-lg text-base sm:text-lg font-black transition-all ${
                showThirds ? "bg-gray-900 text-white shadow-md scale-105" : "bg-amber-50 text-amber-700 border border-amber-200"
              }`} style={{ fontFamily: "var(--font-inter)" }}>
              🥉
            </button>
          )}
        </div>
      </div>

      {/* Lock notice */}
      {liveMode ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-gradient-to-l from-amber-50 to-white border border-amber-200 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <p className="text-sm font-medium text-gray-700">הטורניר בעיצומו · ניתן לעדכן תוצאות עד <strong>30 דק׳ לפני המשחק הראשון</strong> של כל יום משחקים · הימור העלייה נעול</p>
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-gradient-to-l from-blue-50 to-white border border-blue-200 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <p className="text-sm font-medium text-gray-700">ננעל ב-{formatLockDeadline()} (שעון ישראל) · ניתן לשנות עד אז</p>
        </div>
      )}

      {showThirds && !liveMode ? (
        <BestThirdsPredicted />
      ) : (
        <>
          {/* Carousel header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1))} disabled={currentGroupIndex === 0}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${currentGroupIndex === 0 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"}`}>
              בית {currentGroupIndex > 0 ? GROUP_LETTERS[currentGroupIndex - 1] : ""} →
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">בית {groupId}</h2>
              <p className="text-sm text-gray-400">{currentGroupIndex + 1} מתוך 12</p>
            </div>
            <button onClick={() => setCurrentGroupIndex(Math.min(11, currentGroupIndex + 1))} disabled={currentGroupIndex === 11}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${currentGroupIndex === 11 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"}`}>
              ← בית {currentGroupIndex < 11 ? GROUP_LETTERS[currentGroupIndex + 1] : ""}
            </button>
          </div>

          {/* Group view */}
          <SwipeableGroups
            onSwipeLeft={() => setCurrentGroupIndex(Math.min(11, currentGroupIndex + 1))}
            onSwipeRight={() => setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1))}
          >
            <GroupView groupId={groupId} />
          </SwipeableGroups>

          {/* Next button — after the last group, point to the best-thirds view.
              In live mode there's no best-thirds view, so just stop at the last group. */}
          {currentGroupIndex < 11 ? (
            <div className="mt-6 text-center">
              <button onClick={() => setCurrentGroupIndex(currentGroupIndex + 1)}
                className="px-8 py-3 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm">
                ← המשך לבית {GROUP_LETTERS[currentGroupIndex + 1]}
              </button>
            </div>
          ) : liveMode ? null : (
            <div className="mt-6 text-center">
              <button onClick={() => setShowThirds(true)}
                className="px-8 py-3 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors shadow-sm">
                🥉 צפו במקומות השלישיים הטובים
              </button>
            </div>
          )}
        </>
      )}

      {/* Explicit save button — pre-tournament only. In live mode each score
          saves itself per match-day (saveLiveGroupScore); the full-bracket save
          is rejected after the lock, so showing it here would only mislead. */}
      {!liveMode && (
        <SaveAndContinue
          label={completedGroups === 12 ? "💾 שמור והמשך לעץ הטורניר" : "💾 שמור הימורים עד כה"}
          nextHref="/knockout"
          nextLabel="המשך לעץ הטורניר →"
          completion={Math.round((totalFilled / 72) * 100)}
        />
      )}
    </div>
  );
}
