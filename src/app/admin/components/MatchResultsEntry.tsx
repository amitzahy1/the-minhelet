"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFlag } from "@/lib/flags";
import { getTeamByCode } from "@/lib/tournament/groups";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FdStage =
  | "GROUP_STAGE"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL"
  | string;

interface FdMatch {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTla: string;
  awayTla: string;
  group?: string | null;
  stage: FdStage;
  status: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

interface DemoResult {
  match_id: string;
  stage: string;
  group_id: string | null;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  status: string;
  scheduled_at: string | null;
  entered_by: string | null;
  updated_at: string;
}

interface Row {
  matchId: string;
  stage: string;
  groupId: string | null;
  home: string;
  away: string;
  scheduledAt: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  dirty: boolean;
  hasSaved: boolean;
}

// ---------------------------------------------------------------------------

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "GROUP",
  LAST_16: "R32",
  ROUND_OF_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  THIRD_PLACE: "THIRD",
  FINAL: "FINAL",
};

const STAGE_LABEL: Record<string, string> = {
  GROUP: "בתים",
  R32: "שמינית",
  R16: "רבע",
  QF: "רבע גמר",
  SF: "חצי",
  THIRD: "מקום 3",
  FINAL: "גמר",
};

const STAGE_ORDER = ["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"];

function normalizeStage(s: string): string {
  return STAGE_MAP[s] ?? s;
}

/** Football-Data may return group as "GROUP_A" / "Group A" / "A". We store a single letter. */
function normalizeGroupLetter(g: string | null | undefined): string | null {
  if (!g) return null;
  const m = g.toString().match(/([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function teamNameHe(code: string | null | undefined): string {
  if (!code) return "TBD";
  if (code === "TBD" || code.toUpperCase() === "TBD") return "טרם נקבע";
  const team = getTeamByCode(code);
  return team?.name_he ?? code;
}

function teamFlag(code: string | null | undefined): string {
  if (!code || code === "TBD") return "⏳";
  return getFlag(code);
}

// ---------------------------------------------------------------------------

export function MatchResultsEntry() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<string>("GROUP");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [fdRes, savedRes] = await Promise.all([
        fetch("/api/matches").then((r) => r.json()),
        fetch("/api/admin/results").then((r) => r.json()),
      ]);

      const fdMatches: FdMatch[] = fdRes.matches || [];
      const savedResults: DemoResult[] = savedRes.results || [];
      const savedByKey: Record<string, DemoResult> = {};
      for (const r of savedResults) savedByKey[r.match_id] = r;

      const mergedKeys = new Set<string>();
      const merged: Row[] = [];

      for (const m of fdMatches) {
        const key = String(m.id);
        mergedKeys.add(key);
        const saved = savedByKey[key];
        merged.push({
          matchId: key,
          stage: normalizeStage(m.stage),
          groupId: normalizeGroupLetter(m.group),
          home: m.homeTla || m.homeTeam || "TBD",
          away: m.awayTla || m.awayTeam || "TBD",
          scheduledAt: m.date,
          homeGoals: saved?.home_goals ?? m.homeGoals ?? null,
          awayGoals: saved?.away_goals ?? m.awayGoals ?? null,
          status: saved?.status ?? m.status ?? "SCHEDULED",
          dirty: false,
          hasSaved: !!saved,
        });
      }

      for (const r of savedResults) {
        if (mergedKeys.has(r.match_id)) continue;
        merged.push({
          matchId: r.match_id,
          stage: r.stage,
          groupId: normalizeGroupLetter(r.group_id),
          home: r.home_team,
          away: r.away_team,
          scheduledAt: r.scheduled_at,
          homeGoals: r.home_goals,
          awayGoals: r.away_goals,
          status: r.status,
          dirty: false,
          hasSaved: true,
        });
      }

      setRows(merged);
    } catch (e) {
      setMessage("שגיאה בטעינה: " + String(e));
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return rows
      .filter((r) => (filterStage === "ALL" ? true : r.stage === filterStage))
      .sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return ta - tb;
      });
  }, [rows, filterStage]);

  const dirtyCount = rows.filter((r) => r.dirty).length;
  const savedCount = rows.filter((r) => r.hasSaved).length;

  function updateRow(matchId: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.matchId === matchId ? { ...r, ...patch, dirty: true } : r))
    );
  }

  async function saveDirty() {
    const dirty = rows.filter((r) => r.dirty && r.homeGoals !== null && r.awayGoals !== null);
    if (dirty.length === 0) {
      setMessage("אין שינויים לשמירה");
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: dirty.map((r) => ({
            match_id: r.matchId,
            stage: r.stage,
            group_id: normalizeGroupLetter(r.groupId),
            home_team: r.home,
            away_team: r.away,
            home_goals: r.homeGoals,
            away_goals: r.awayGoals,
            status: "FINISHED",
            scheduled_at: r.scheduledAt,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage("שגיאה בשמירה: " + (data.error || res.statusText));
      } else {
        setMessage(`נשמרו ${data.upserted} תוצאות ✓`);
        const dirtyKeys = new Set(dirty.map((r) => r.matchId));
        setRows((prev) =>
          prev.map((r) =>
            dirtyKeys.has(r.matchId) ? { ...r, dirty: false, hasSaved: true, status: "FINISHED" } : r
          )
        );
      }
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  }

  function discardChanges() {
    if (!confirm("לבטל את כל השינויים שלא נשמרו? הערכים יטענו מחדש מהשרת.")) return;
    loadAll();
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      if (data.success) {
        setMessage(`סונכרנו ${data.matchesCount} משחקים מ-Football-Data.org`);
        await loadAll();
      } else {
        setMessage("שגיאה: " + (data.error || "Sync failed"));
      }
    } catch {
      setMessage("שגיאת רשת — בדקו חיבור");
    }
    setSyncing(false);
    setTimeout(() => setMessage(null), 4000);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Sync Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-base font-bold text-gray-800">סנכרון אוטומטי</p>
              <p className="text-sm text-gray-500">משיכת תוצאות חיות מ-Football-Data.org</p>
            </div>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? "מסנכרן..." : "סנכרון עכשיו"}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>סה״כ משחקים: <b>{rows.length}</b></span>
            <span>נשמרו: <b className="text-green-700">{savedCount}</b></span>
            {dirtyCount > 0 && (
              <span>ממתינים לשמירה: <b className="text-amber-700">{dirtyCount}</b></span>
            )}
          </div>
          {message && (
            <p
              className={`mt-2 text-sm ${
                message.includes("שגיאה") ? "text-red-600" : "text-green-600"
              }`}
            >
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">הזנת תוצאות ידנית</CardTitle>
              <div className="flex gap-1 flex-wrap">
                {[{ key: "ALL", label: "הכל" }, ...STAGE_ORDER.map((s) => ({ key: s, label: STAGE_LABEL[s] }))].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setFilterStage(s.key)}
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      filterStage === s.key
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prominent save bar (sticky-feel via color) */}
            {dirtyCount > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💾</span>
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      {dirtyCount} {dirtyCount === 1 ? "תוצאה לא נשמרה" : "תוצאות לא נשמרו"}
                    </p>
                    <p className="text-xs text-amber-700">לחץ שמירה כדי לעדכן את ה-DB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={discardChanges}
                    disabled={saving}
                  >
                    בטל
                  </Button>
                  <Button
                    size="lg"
                    onClick={saveDirty}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                    {saving ? "שומר..." : `שמור ${dirtyCount} תוצאות`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-400 text-center py-6">טוען משחקים...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-6">
              אין משחקים בשלב זה. בצעו סנכרון אוטומטי להביא את הלו״ז.
            </p>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              {filtered.map((r) => (
                <MatchRow
                  key={r.matchId}
                  row={r}
                  onHomeChange={(v) => updateRow(r.matchId, { homeGoals: v })}
                  onAwayChange={(v) => updateRow(r.matchId, { awayGoals: v })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function MatchRow({
  row,
  onHomeChange,
  onAwayChange,
}: {
  row: Row;
  onHomeChange: (v: number | null) => void;
  onAwayChange: (v: number | null) => void;
}) {
  const bg = row.dirty
    ? "bg-amber-50 border-amber-300"
    : row.hasSaved
    ? "bg-green-50 border-green-200"
    : "bg-white border-gray-200";

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${bg}`}>
      {/* Date / time */}
      <span
        className="text-xs text-gray-400 w-14 shrink-0 text-center"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {formatDate(row.scheduledAt)}
        <br />
        {formatTime(row.scheduledAt)}
      </span>

      {/* Stage + group badges */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <Badge variant="outline" className="text-[10px] w-14 justify-center h-5 px-1">
          {STAGE_LABEL[row.stage] || row.stage}
        </Badge>
        {row.groupId && (
          <Badge variant="outline" className="text-[10px] w-14 justify-center h-5 px-1 bg-gray-100">
            בית {row.groupId}
          </Badge>
        )}
      </div>

      {/* Team 1 (home) — on the right in RTL, text-end so the name hugs the score */}
      <div
        className="flex items-center gap-2 flex-1 min-w-0 justify-end"
        title={row.home}
      >
        <span className="text-sm font-bold text-gray-900 truncate">{teamNameHe(row.home)}</span>
        <span className="text-xl shrink-0">{teamFlag(row.home)}</span>
      </div>

      {/* Scores */}
      <Input
        type="number"
        min={0}
        value={row.homeGoals ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onHomeChange(v === "" ? null : Math.max(0, parseInt(v) || 0));
        }}
        className="w-12 text-center font-bold text-base shrink-0"
        dir="ltr"
        placeholder="-"
      />
      <span className="text-gray-300 font-bold shrink-0">:</span>
      <Input
        type="number"
        min={0}
        value={row.awayGoals ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onAwayChange(v === "" ? null : Math.max(0, parseInt(v) || 0));
        }}
        className="w-12 text-center font-bold text-base shrink-0"
        dir="ltr"
        placeholder="-"
      />

      {/* Team 2 (away) — on the left in RTL */}
      <div
        className="flex items-center gap-2 flex-1 min-w-0 justify-start"
        title={row.away}
      >
        <span className="text-xl shrink-0">{teamFlag(row.away)}</span>
        <span className="text-sm font-bold text-gray-900 truncate">{teamNameHe(row.away)}</span>
      </div>

      {/* Status indicator */}
      <span className="text-[10px] w-12 shrink-0 text-start">
        {row.dirty ? (
          <span className="text-amber-700 font-bold">ממתין</span>
        ) : row.hasSaved ? (
          <span className="text-green-700">✓ נשמר</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </span>
    </div>
  );
}
