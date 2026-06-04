"use client";

// ============================================================================
// Admin alert — group ties that need card data the dirtiest board doesn't have.
//
// The results API has no bookings, so the group/3rd-place fair-play tiebreaker
// can only use the admin-maintained dirtiest board. When a COMPLETED group ends
// in a dead-even tie at a consequential boundary (1st↔2nd or 2nd↔3rd) and the
// tied teams aren't on the board, the standings engine flags `needs_card_data`
// and the order silently falls to FIFA ranking. This surfaces those cases right
// above the board editor so the admin can enter the cards (0/0 if genuinely
// none) and lock in the real order.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { GROUPS, GROUP_LETTERS, getTeamByCode } from "@/lib/tournament/groups";
import { calculateStandings } from "@/lib/tournament/standings";
import { fairPlayFromBoard } from "@/lib/scoring/knockout-resolver";
import { normalizeGroupLetter } from "@/lib/results-hits";
import type { GroupMatchPrediction } from "@/types";

interface MatchApi {
  homeTla: string;
  awayTla: string;
  group?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

type DirtyRow = { team: string; yellow: number; red: number };

const nameHe = (code: string) => getTeamByCode(code)?.name_he ?? code;

export function CardTieAlert({ board }: { board: DirtyRow[] }) {
  const [matches, setMatches] = useState<MatchApi[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/matches")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const arr = Array.isArray(d) ? d : (d?.matches ?? []);
        setMatches(Array.isArray(arr) ? arr : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Reflects the board as the admin edits it (passed from SpecialResultsEntry),
  // so the warning clears the moment the missing teams are added.
  const fairPlay = useMemo(() => fairPlayFromBoard(board), [board]);

  const flagged = useMemo(() => {
    const out: { group: string; advancing: string; rival: string; boundary: string }[] = [];
    for (const letter of GROUP_LETTERS) {
      const teams = GROUPS[letter] || [];
      const preds: GroupMatchPrediction[] = [];
      for (const m of matches) {
        if (normalizeGroupLetter(m.group) !== letter) continue;
        if (m.status !== "FINISHED" || m.homeGoals == null || m.awayGoals == null) continue;
        preds.push({
          match_id: preds.length,
          home_team_code: m.homeTla,
          away_team_code: m.awayTla,
          home_goals: m.homeGoals,
          away_goals: m.awayGoals,
        });
      }
      const s = calculateStandings(
        teams.map((t) => ({ id: t.id, code: t.code })),
        preds,
        fairPlay ? { fairPlay } : undefined,
      );
      // Only meaningful once the group is complete (each team played 3).
      const complete = s.length === 4 && s.every((r) => r.played === 3);
      if (!complete) continue;
      if (s[1]?.needs_card_data) out.push({ group: letter, advancing: s[0].team_code, rival: s[1].team_code, boundary: "1↔2" });
      if (s[2]?.needs_card_data) out.push({ group: letter, advancing: s[1].team_code, rival: s[2].team_code, boundary: "2↔3" });
    }
    return out;
  }, [matches, fairPlay]);

  if (flagged.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 mb-3">
      <p className="text-sm font-bold text-red-900">⚠️ נדרשת הזנת כרטיסים לשובר שוויון</p>
      <p className="text-[13px] text-red-800 mt-1 leading-snug">
        הבתים הבאים הסתיימו בתיקו מוחלט (נקודות, מפגש ישיר, הפרש שערים ושערים) שמוכרע לפי כרטיסים, אך חסרים נתוני כרטיסים לקבוצות המעורבות. הוסף אותן ללוח הכסחנות למטה (0/0 אם אין כרטיסים) כדי לקבוע את הסדר — עד אז הסדר נקבע לפי דירוג פיפ״א.
      </p>
      <ul className="text-[13px] text-red-900 mt-1.5 space-y-0.5">
        {flagged.map((f, i) => (
          <li key={i}>
            בית {f.group} ({f.boundary}): <strong>{nameHe(f.advancing)}</strong> מול <strong>{nameHe(f.rival)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
