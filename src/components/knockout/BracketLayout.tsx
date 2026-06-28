"use client";

// ============================================================================
// Shared knockout bracket UI — used by BOTH trees:
//   • "עץ סימולציה" (Tree 1, pre-tournament): winner-only, scoreless.
//   • "עץ נתוני אמת" (Tree 2, real-data): score + winner on the real matchups,
//     with per-slot status (waiting / open / locked / finished).
//
// BracketLayout is purely structural — it renders the R32→Final tree (desktop)
// and a round-tab view (mobile) by calling `getTeams(slotKey)` and
// `renderMatch(...)` for every slot. All data-source / store wiring lives in
// the page that supplies those two callbacks.
// ============================================================================

import { memo } from "react";
import { getFlag } from "@/lib/flags";

export type KOValue = { score1: number | null; score2: number | null; winner: string | null };
export type SlotStatus = "waiting" | "open" | "locked" | "finished";

export interface SlotTeams {
  team1: string | null;
  team2: string | null;
}

// ── Slot structure (fixed) ──────────────────────────────────────────────────
export const R32L = ["r32l_0", "r32l_1", "r32l_2", "r32l_3", "r32l_4", "r32l_5", "r32l_6", "r32l_7"];
export const R32R = ["r32r_0", "r32r_1", "r32r_2", "r32r_3", "r32r_4", "r32r_5", "r32r_6", "r32r_7"];
export const R16L = ["r16l_0", "r16l_1", "r16l_2", "r16l_3"];
export const R16R = ["r16r_0", "r16r_1", "r16r_2", "r16r_3"];
export const QFL = ["qfl_0", "qfl_1"];
export const QFR = ["qfr_0", "qfr_1"];

// ── Shared match cell ────────────────────────────────────────────────────────
export interface BracketMatchCellProps {
  team1Code: string | null;
  team2Code: string | null;
  value: KOValue | undefined;
  onChange?: (data: Partial<KOValue>) => void;
  size?: "sm" | "md";
  /** Tree 1: winner pick only, no score steppers. */
  scoreless?: boolean;
  /** When false, the cell is read-only (locked / finished / after deadline). */
  editable?: boolean;
  /** Tree 2 per-slot status, drives the badge. */
  status?: SlotStatus;
  /** Tree 2 finished: the REAL match result, shown next to the user's pick. */
  realResult?: KOValue | null;
}

export const BracketMatchCell = memo(function BracketMatchCell({
  team1Code,
  team2Code,
  value,
  onChange,
  size = "md",
  scoreless = false,
  editable = true,
  status,
  realResult = null,
}: BracketMatchCellProps) {
  const py = size === "sm" ? "py-1.5" : "py-2";

  if (!team1Code || !team2Code) {
    return (
      <div className="bg-gray-50/80 rounded-lg border border-dashed border-gray-200">
        <div className={`px-2.5 ${py} text-sm text-gray-300 border-b border-dashed border-gray-200`}>ממתין...</div>
        <div className={`px-2.5 ${py} text-sm text-gray-300`}>ממתין...</div>
      </div>
    );
  }

  const setScore = (side: 1 | 2, delta: number) => {
    if (!editable || scoreless || !onChange) return;
    const s1 = side === 1 ? Math.max(0, (value?.score1 ?? 0) + delta) : (value?.score1 ?? 0);
    const s2 = side === 2 ? Math.max(0, (value?.score2 ?? 0) + delta) : (value?.score2 ?? 0);
    const winner = s1 > s2 ? team1Code : s2 > s1 ? team2Code : value?.winner || null;
    onChange({ score1: s1, score2: s2, winner });
  };

  const selectWinner = (code: string) => {
    // Only Tree-1 (simulation, winner-only) uses a row click to choose a winner.
    // On the scored real-data tree the winner is derived from the score, and a
    // 90' draw needs NO "who advances" pick — penalties don't affect this page.
    if (!editable || !onChange || !scoreless) return;
    onChange({ winner: code });
  };

  const stepper = (side: 1 | 2, score: number | null) => (
    <div className="flex items-center gap-0 rounded border border-gray-200 bg-white overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setScore(side, -1)} aria-label="הפחת תוצאה" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 text-xs font-bold">−</button>
      <span className="w-5 h-8 flex items-center justify-center font-bold text-xs tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{score ?? 0}</span>
      <button onClick={() => setScore(side, 1)} aria-label="הוסף תוצאה" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 text-xs font-bold">+</button>
    </div>
  );

  const isWinner1 = value?.winner === team1Code;
  const isWinner2 = value?.winner === team2Code;
  const isTie = !scoreless && value?.score1 != null && value?.score2 != null && value.score1 === value.score2;
  // A pick is "filled" when both scores are entered (scored real-data tree) or a
  // winner is chosen (Tree-1). A 90' draw is complete with NO who-advances pick.
  const isFilled = scoreless ? !!value?.winner : (value?.score1 != null && value?.score2 != null);
  const clickable = editable && !!onChange;

  // Hit indicator for finished Tree-2 matches — graded on the 90' result type
  // (toto) + exact score, mirroring the calculator. A 90' draw vs a draw pick is
  // a toto regardless of who advanced on penalties.
  let hit: "exact" | "toto" | "miss" | "empty" | null = null;
  if (realResult && realResult.winner) {
    const rt = (a: number | null, b: number | null) =>
      a == null || b == null ? null : a > b ? "1" : a < b ? "2" : "X";
    if (scoreless) {
      hit = value?.winner == null ? "empty" : value.winner === realResult.winner ? "toto" : "miss";
    } else if (value?.score1 == null || value?.score2 == null) {
      hit = "empty";
    } else if (value.score1 === realResult.score1 && value.score2 === realResult.score2) {
      hit = "exact";
    } else if (rt(value.score1, value.score2) === rt(realResult.score1, realResult.score2)) {
      hit = "toto";
    } else {
      hit = "miss";
    }
  }

  const rowCls = (isW: boolean) =>
    `flex items-center gap-1.5 px-2 ${py} w-full ${clickable ? "cursor-pointer" : ""} transition-colors ${isW ? "bg-green-50" : clickable ? "hover:bg-gray-50" : ""}`;

  return (
    <div className={`bg-white rounded-lg border overflow-hidden transition-all ${isFilled ? "border-green-300 shadow-sm" : "border-gray-200 shadow-sm"}`}>
      <div onClick={() => selectWinner(team1Code)} className={`${rowCls(isWinner1)} border-b border-gray-100`}>
        <span className="text-sm">{getFlag(team1Code)}</span>
        <span className={`text-sm font-bold flex-1 ${isWinner1 ? "text-green-700" : "text-gray-800"}`}>{team1Code}</span>
        {!scoreless && (editable ? stepper(1, value?.score1 ?? null) : <span className="text-sm font-black tabular-nums px-1">{value?.score1 ?? "-"}</span>)}
        {isWinner1 && <span className="text-green-500 text-xs font-bold ms-0.5">✓</span>}
      </div>
      <div onClick={() => selectWinner(team2Code)} className={rowCls(isWinner2)}>
        <span className="text-sm">{getFlag(team2Code)}</span>
        <span className={`text-sm font-bold flex-1 ${isWinner2 ? "text-green-700" : "text-gray-800"}`}>{team2Code}</span>
        {!scoreless && (editable ? stepper(2, value?.score2 ?? null) : <span className="text-sm font-black tabular-nums px-1">{value?.score2 ?? "-"}</span>)}
        {isWinner2 && <span className="text-green-500 text-xs font-bold ms-0.5">✓</span>}
      </div>
      {isTie && editable && (
        // 90' draw — complete as-is. No "who advances" pick: this page scores the
        // 90' result only (penalties / who advances aren't part of it).
        <div className="text-center py-1 bg-green-50 border-t border-green-200">
          <span className="text-[10px] text-green-700 font-bold">תיקו ✓ · ניקוד לפי 90 דק׳</span>
        </div>
      )}
      {status === "locked" && !realResult && (
        <div className="text-center py-1 bg-gray-50 border-t border-gray-200">
          <span className="text-[10px] text-gray-500 font-bold">🔒 ננעל — המשחק קרוב</span>
        </div>
      )}
      {realResult && realResult.winner && (
        <div className={`text-center py-1 border-t ${hit === "exact" ? "bg-green-50 border-green-200" : hit === "toto" ? "bg-blue-50 border-blue-200" : hit === "miss" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <span className="text-[10px] font-bold text-gray-600">
            תוצאה: {realResult.score1}-{realResult.score2} · עלתה {realResult.winner}
            {hit === "exact" ? " · מדויק ✓" : hit === "toto" ? " · כיוון ✓" : hit === "miss" ? " · פספוס ✗" : ""}
          </span>
        </div>
      )}
    </div>
  );
});

// ── Layout helpers ────────────────────────────────────────────────────────────
function Connector() {
  return <div className="w-3 shrink-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>;
}

function RoundCol({ label, children, width }: { label: string; children: React.ReactNode; width: string }) {
  return (
    <div className={`flex flex-col ${width} shrink-0`}>
      <div className="text-center mb-3">
        <p className="text-xs font-black text-gray-600 uppercase tracking-widest" style={{ fontFamily: "var(--font-inter)" }}>{label}</p>
      </div>
      <div className="flex flex-col gap-1 flex-1 justify-around">{children}</div>
    </div>
  );
}

export interface BracketLayoutProps {
  /** Resolve the two teams for any slot key (R32 from source, R16+ from winners/results). */
  getTeams: (slotKey: string) => SlotTeams;
  /** Render a single match cell for a slot. */
  renderMatch: (slotKey: string, teams: SlotTeams, size: "sm" | "md") => React.ReactNode;
  /** Champion (winner of `final`) for the trophy card. */
  champion: string | null;
  /**
   * Draw-order of the left/right R32 columns. Defaults to `R32L`/`R32R`. The
   * real-data tree passes a reordered list so the official (cross-side) R16
   * pairings render as a clean tree — purely presentational, no data impact.
   */
  r32LeftOrder?: string[];
  r32RightOrder?: string[];
}

/** Desktop full tree + mobile round tabs. Both trees share this. */
export function BracketLayout({ getTeams, renderMatch, champion, r32LeftOrder, r32RightOrder }: BracketLayoutProps) {
  const cell = (key: string, size: "sm" | "md") => renderMatch(key, getTeams(key), size);
  const r32Left = r32LeftOrder ?? R32L;
  const r32Right = r32RightOrder ?? R32R;

  return (
    <>
      {/* Mobile hint — the full tree is wide, so it scrolls sideways. */}
      <p className="sm:hidden text-center text-xs text-gray-400 mb-2">← גללו לצדדים לראות את כל העץ →</p>

      {/* Full R32→Final bracket — same professional tree on every screen size.
          On mobile it overflows and scrolls horizontally rather than collapsing
          into a round-by-round list. */}
      <div className="overflow-x-auto pb-4" dir="ltr">
        {/* min-w-max: the row grows to fit the whole tree, so on narrow screens
            it scrolls from the left edge instead of centering and clipping the
            left side off-screen (which `mx-auto`/`justify-center` did). */}
        <div className="flex items-stretch justify-center gap-0 min-w-max" style={{ minHeight: "700px" }}>
          <RoundCol label="R32" width="w-[120px]">{r32Left.map((k) => cell(k, "sm"))}</RoundCol>
          <Connector />
          <RoundCol label="R16" width="w-[130px]">{R16L.map((k) => cell(k, "md"))}</RoundCol>
          <Connector />
          <RoundCol label="QF" width="w-[130px]">{QFL.map((k) => cell(k, "md"))}</RoundCol>
          <Connector />
          <RoundCol label="SF" width="w-[130px]">{cell("sfl_0", "md")}</RoundCol>
          <Connector />
          <div className="flex flex-col items-center justify-center w-[150px] shrink-0 mx-1">
            <div className="mb-3 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-300 flex items-center justify-center mb-2 shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </div>
              <p className="text-sm font-black text-amber-800 uppercase tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>FINAL</p>
            </div>
            <div className="w-full">{cell("final", "md")}</div>
            <div className="mt-3 w-full rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 text-center shadow-sm">
              {champion ? (
                <>
                  <p className="text-sm text-amber-700 font-semibold">אלוף העולם 2026</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-2xl">{getFlag(champion)}</span>
                    <span className="text-xl font-black text-amber-900">{champion}</span>
                  </div>
                </>
              ) : (
                <><p className="text-sm text-amber-600 font-semibold">אלוף העולם 2026</p><p className="text-xl font-black text-amber-900 mt-0.5">?</p></>
              )}
            </div>
          </div>
          <Connector />
          <RoundCol label="SF" width="w-[130px]">{cell("sfr_0", "md")}</RoundCol>
          <Connector />
          <RoundCol label="QF" width="w-[130px]">{QFR.map((k) => cell(k, "md"))}</RoundCol>
          <Connector />
          <RoundCol label="R16" width="w-[130px]">{R16R.map((k) => cell(k, "md"))}</RoundCol>
          <Connector />
          <RoundCol label="R32" width="w-[120px]">{r32Right.map((k) => cell(k, "sm"))}</RoundCol>
        </div>
      </div>
    </>
  );
}
