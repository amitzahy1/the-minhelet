"use client";

// =============================================================================
// BestThirdsOverride — admin tab for selecting the 8 group letters whose
// 3rd-placed teams advance to R32. Reads the live auto-ranking from
// /api/matches, shows the admin which 8 are currently top, and lets them
// override that set manually if the official results diverge.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GROUP_LETTERS, getTeamByCode } from "@/lib/tournament/groups";
import { getFlag } from "@/lib/flags";
import { extractThirdsFromMatches } from "@/components/shared/BestThirdsPanel";
import { rankBestThirds } from "@/lib/tournament/thirds-ranker";

interface MatchApi {
  id: number;
  homeTla: string;
  awayTla: string;
  group?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

export function BestThirdsOverride() {
  const [matches, setMatches] = useState<MatchApi[]>([]);
  const [savedOverride, setSavedOverride] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [matchesRes, overrideRes] = await Promise.all([
          fetch("/api/matches").then((r) => r.json()),
          fetch("/api/admin/best-thirds").then((r) => r.json()),
        ]);
        if (!alive) return;
        setMatches((matchesRes.matches as MatchApi[]) || []);
        const override = overrideRes?.override;
        if (Array.isArray(override) && override.length === 8) {
          setSavedOverride(override);
          setSelected(new Set(override));
        }
      } catch (e) {
        if (alive) setMessage("שגיאה בטעינה: " + String(e));
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const autoRanking = useMemo(() => {
    const thirds = extractThirdsFromMatches(matches);
    return rankBestThirds(thirds);
  }, [matches]);

  const autoGroups = useMemo(
    () => new Set(autoRanking.qualifiedGroups),
    [autoRanking],
  );

  function toggleGroup(letter: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else if (next.size < 8) next.add(letter);
      return next;
    });
  }

  function useAutoRanking() {
    setSelected(new Set(autoRanking.qualifiedGroups));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function saveOverride(groups: string[] | null) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/best-thirds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage("שגיאה בשמירה: " + (data.error || res.statusText));
      } else {
        setSavedOverride(data.override ?? null);
        setMessage(data.override ? "עקיפה נשמרה ✓" : "העקיפה הוסרה — חזרה לחישוב אוטומטי ✓");
      }
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  }

  const selectedArr = [...selected].sort();
  const selectionValid = selected.size === 8;
  const matchesSaved =
    savedOverride &&
    savedOverride.length === selectedArr.length &&
    savedOverride.every((g, i) => g === selectedArr[i]);

  if (loading) {
    return <p className="text-gray-400 text-center py-8">טוען...</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>עקיפה ידנית — 8 עולות מהמקום השלישי</span>
            <Badge
              variant="outline"
              className={savedOverride ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700"}
            >
              {savedOverride ? "🔧 מצב עקיפה פעיל" : "✓ חישוב אוטומטי"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            בחרו בדיוק 8 בתים שהשלישייה שלהם עולה לשמינית הגמר. העמודה
            {" "}<b>אוטומטי</b>{" "} מראה מה המערכת חישבה מהתוצאות. השמירה תחליף את
            החישוב האוטומטי — ניתן לחזור אליו דרך כפתור <b>נקה עקיפה</b>.
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={useAutoRanking}>
              טען מהחישוב האוטומטי
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelection} disabled={selected.size === 0}>
              ניקוי בחירה
            </Button>
            <div className="ms-auto text-xs font-bold text-gray-600">
              נבחרו <span className={selectionValid ? "text-emerald-700" : "text-amber-700"}>{selected.size}/8</span>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {GROUP_LETTERS.map((letter) => {
              const third = autoRanking.ranked.find((r) => r.group === letter);
              const team = third ? getTeamByCode(third.team_code) : null;
              const isSelected = selected.has(letter);
              const isAuto = autoGroups.has(letter);

              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => toggleGroup(letter)}
                  className={`text-right px-3 py-2.5 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-purple-500 bg-purple-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-400">בית {letter}</span>
                    {isAuto && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                        אוטומטי
                      </span>
                    )}
                  </div>
                  {third ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{getFlag(third.team_code)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800 truncate">
                          {team?.name_he ?? third.team_code}
                        </div>
                        <div className="text-[10px] text-gray-500 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                          #{third.rank} · {third.points} נק׳ · {third.goal_difference > 0 ? "+" : ""}{third.goal_difference}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">ממתין לתוצאות</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 flex-wrap">
            <div className="text-xs text-gray-500">
              {selectedArr.length > 0 && (
                <>
                  בחירה נוכחית: <b className="text-gray-800 tabular-nums">{selectedArr.join(", ")}</b>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {savedOverride && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveOverride(null)}
                  disabled={saving}
                >
                  נקה עקיפה
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => saveOverride(selectedArr)}
                disabled={!selectionValid || saving || !!matchesSaved}
              >
                {saving ? "שומר..." : matchesSaved ? "✓ שמור" : "שמור עקיפה"}
              </Button>
            </div>
          </div>

          {message && (
            <p className={`text-sm ${message.includes("שגיאה") ? "text-red-600" : "text-emerald-600"}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">מצב נוכחי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-700 w-24 shrink-0">אוטומטי:</span>
            <span className="text-gray-600 tabular-nums">
              {autoRanking.qualifiedGroups.length === 8
                ? autoRanking.qualifiedGroups.join(", ")
                : `רק ${autoRanking.qualifiedGroups.length}/8 זמינים (לא הסתיים שלב הבתים)`}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-700 w-24 shrink-0">בעקיפה:</span>
            <span className="text-gray-600 tabular-nums">
              {savedOverride ? savedOverride.join(", ") : "אין — משתמש בחישוב אוטומטי"}
            </span>
          </div>
          {savedOverride && autoRanking.qualifiedGroups.length === 8 && (
            <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
              {arraysEqual(savedOverride, autoRanking.qualifiedGroups.slice().sort())
                ? "העקיפה זהה לחישוב האוטומטי."
                : "⚠️ העקיפה שונה מהחישוב האוטומטי — ודאו שזו הבחירה הרצויה."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
