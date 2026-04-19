"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

      // 1. Rows driven by the fixture list
      for (const m of fdMatches) {
        const key = String(m.id);
        mergedKeys.add(key);
        const saved = savedByKey[key];
        merged.push({
          matchId: key,
          stage: normalizeStage(m.stage),
          groupId: m.group || null,
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

      // 2. Rows that only exist in our DB (manual entries for fixtures we don't have yet)
      for (const r of savedResults) {
        if (mergedKeys.has(r.match_id)) continue;
        merged.push({
          matchId: r.match_id,
          stage: r.stage,
          groupId: r.group_id,
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
            group_id: r.groupId,
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
        // Mark saved rows as clean + has_saved
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
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
            {dirtyCount > 0 && <span>ממתינים: <b className="text-amber-700">{dirtyCount}</b></span>}
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">הזנת תוצאות ידנית</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveDirty} disabled={saving || dirtyCount === 0}>
                {saving ? "שומר..." : `שמור שינויים${dirtyCount ? ` (${dirtyCount})` : ""}`}
              </Button>
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
                <div
                  key={r.matchId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    r.dirty
                      ? "bg-amber-50 border-amber-300"
                      : r.hasSaved
                      ? "bg-green-50 border-green-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <span
                    className="text-xs text-gray-400 w-16 shrink-0"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    {formatDate(r.scheduledAt)}
                    <br />
                    {formatTime(r.scheduledAt)}
                  </span>
                  {r.groupId && (
                    <Badge variant="outline" className="text-xs w-8 justify-center shrink-0">
                      {r.groupId}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] w-12 justify-center shrink-0">
                    {STAGE_LABEL[r.stage] || r.stage}
                  </Badge>
                  <span className="font-bold text-sm w-12 text-end shrink-0" dir="ltr">
                    {r.home}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={r.homeGoals ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateRow(r.matchId, {
                        homeGoals: v === "" ? null : Math.max(0, parseInt(v) || 0),
                      });
                    }}
                    className="w-14 text-center font-bold"
                    dir="ltr"
                    placeholder="-"
                  />
                  <span className="text-gray-300">:</span>
                  <Input
                    type="number"
                    min={0}
                    value={r.awayGoals ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateRow(r.matchId, {
                        awayGoals: v === "" ? null : Math.max(0, parseInt(v) || 0),
                      });
                    }}
                    className="w-14 text-center font-bold"
                    dir="ltr"
                    placeholder="-"
                  />
                  <span className="font-bold text-sm w-12 shrink-0" dir="ltr">
                    {r.away}
                  </span>
                  <span className="ms-auto text-xs text-gray-400 shrink-0">
                    {r.hasSaved ? "נשמר" : r.dirty ? "ממתין" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
