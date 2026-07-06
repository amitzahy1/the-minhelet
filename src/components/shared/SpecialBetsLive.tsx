"use client";

// SpecialBetsLive — third tab on /live. Shows actual tournament results
// for special bets (top scorer, top assists, best attack, etc.). Pulls a
// hybrid feed from /api/special-live (football-data + tournament_actuals)
// and derives best-attack / prolific group / driest group locally from the
// finished-matches array already loaded by the parent.

import { useEffect, useMemo, useState } from "react";
import { GROUPS, GROUP_LETTERS } from "@/lib/tournament/groups";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { normalizeGroupLetter } from "@/lib/results-hits";

interface MatchApi {
  id: number;
  date: string;
  homeTla: string;
  awayTla: string;
  group?: string;
  stage?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

interface ApiPayload {
  topScorers: { player: string; team: string; teamName: string; goals: number; assists: number | null; playedMatches: number }[];
  topAssists: {
    source: "api" | "manual";
    list: { player: string; team: string; teamName: string; assists: number; goals: number }[];
    manual: { player: string; team: string; assists: number } | null;
  };
  bestAttack: { team: string; goals: number | null } | null;
  dirtiestTeam: { team: string; cards: number | null } | null;
  prolificGroup: { group: string; goals: number | null } | null;
  driestGroup: { group: string; goals: number | null } | null;
  matchups: (string | null)[];
  penalties: { result: string; total: number | null } | null;
  champion: string | null;
  lastUpdated: string | null;
  apiError: string | null;
}

function Card({ title, children, source, updatedAt }: {
  title: string; children: React.ReactNode; source?: "api" | "manual" | "computed"; updatedAt?: string | null;
}) {
  // The updatedAt timestamp comes from tournament_actuals.updated_at, which
  // bumps any time *any* field on the row changes — not just the field shown
  // here. We surface it as a generic "last-touched" hint rather than a
  // per-field freshness signal.
  const sourceLabel = source === "api" ? "מקור: Football-Data.org"
    : source === "manual" ? "מקור: עדכון ידני של מנהל"
    : source === "computed" ? "מחושב מתוצאות אמת"
    : null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-l from-white via-purple-50/30 to-pink-50/30 border-b border-purple-100/50 flex items-center justify-between">
        <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>{title}</h3>
        {sourceLabel && (
          <span className="text-[10px] text-gray-400 font-medium">
            {sourceLabel}
            {source === "manual" && updatedAt && ` · עודכן לאחרונה ${new Date(updatedAt).toLocaleDateString("he-IL")}`}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PendingState({ msg = "ממתין לתוצאות" }: { msg?: string }) {
  return <p className="text-sm text-gray-400 italic">{msg}</p>;
}

// Compute best-attack (team with most goals) from finished matches
function computeBestAttack(matches: MatchApi[]) {
  const goalsByTeam = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== "FINISHED") continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;
    goalsByTeam.set(m.homeTla, (goalsByTeam.get(m.homeTla) ?? 0) + m.homeGoals);
    goalsByTeam.set(m.awayTla, (goalsByTeam.get(m.awayTla) ?? 0) + m.awayGoals);
  }
  if (goalsByTeam.size === 0) return null;
  const sorted = [...goalsByTeam.entries()].sort((a, b) => b[1] - a[1]);
  return { team: sorted[0][0], goals: sorted[0][1], top5: sorted.slice(0, 5) };
}

// Compute prolific / driest group from finished matches
function computeGroupGoals(matches: MatchApi[]) {
  const totals = new Map<string, { goals: number; played: number }>();
  for (const l of GROUP_LETTERS) totals.set(l, { goals: 0, played: 0 });
  for (const m of matches) {
    const g = normalizeGroupLetter(m.group);
    if (!g) continue;
    if (m.status !== "FINISHED") continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const cur = totals.get(g);
    if (!cur) continue;
    cur.goals += m.homeGoals + m.awayGoals;
    cur.played += 1;
  }
  const playedGroups = [...totals.entries()].filter(([, v]) => v.played > 0);
  if (playedGroups.length === 0) return { prolific: null, driest: null, all: [] };
  const sortedDesc = [...playedGroups].sort((a, b) => b[1].goals - a[1].goals);
  return {
    prolific: { group: sortedDesc[0][0], goals: sortedDesc[0][1].goals, played: sortedDesc[0][1].played },
    driest: { group: sortedDesc[sortedDesc.length - 1][0], goals: sortedDesc[sortedDesc.length - 1][1].goals, played: sortedDesc[sortedDesc.length - 1][1].played },
    all: sortedDesc,
  };
}

function teamLabel(tla: string) {
  // Look up Hebrew name from groups data, fall back to flag-only mapping
  for (const l of GROUP_LETTERS) {
    const t = (GROUPS[l] || []).find(x => x.code === tla);
    if (t) return { name: t.name_he, flag: getFlag(tla) };
  }
  return { name: getTeamNameHe(tla), flag: getFlag(tla) };
}

export function SpecialBetsLive({ matches }: { matches: MatchApi[] }) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/special-live", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: ApiPayload) => { if (alive) setData(d); })
      .catch(() => { /* swallow — component shows manual fallbacks */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const localBestAttack = useMemo(() => computeBestAttack(matches), [matches]);
  const localGroupGoals = useMemo(() => computeGroupGoals(matches), [matches]);
  const finishedCount = useMemo(() => matches.filter(m => m.status === "FINISHED").length, [matches]);

  if (loading && finishedCount === 0) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">טוען נתוני הימורים מיוחדים...</p>
      </div>
    );
  }

  const showApiTopScorers = data && data.topScorers.length > 0;
  const useApiAssists = data?.topAssists.source === "api" && data.topAssists.list.length > 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Top scorers */}
      <Card title="מלכי שערים" source={showApiTopScorers ? "api" : data?.topScorers.length ? "manual" : undefined}>
        {showApiTopScorers ? (
          <ol className="space-y-1.5">
            {data!.topScorers.slice(0, 8).map((s, i) => (
              <li key={`${s.player}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center text-gray-400 font-bold">{i + 1}</span>
                <span className="text-base">{getFlag(s.team)}</span>
                <span className="font-bold text-gray-900 truncate flex-1">{s.player}</span>
                <span className="font-black text-purple-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{s.goals}</span>
              </li>
            ))}
          </ol>
        ) : <PendingState />}
      </Card>

      {/* Top assists */}
      <Card
        title="מלכי בישולים"
        source={useApiAssists ? "api" : data?.topAssists.manual ? "manual" : undefined}
        updatedAt={!useApiAssists && data?.lastUpdated ? data.lastUpdated : undefined}
      >
        {useApiAssists ? (
          <ol className="space-y-1.5">
            {data!.topAssists.list.slice(0, 8).map((s, i) => (
              <li key={`${s.player}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center text-gray-400 font-bold">{i + 1}</span>
                <span className="text-base">{getFlag(s.team)}</span>
                <span className="font-bold text-gray-900 truncate flex-1">{s.player}</span>
                <span className="font-black text-blue-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{s.assists}</span>
              </li>
            ))}
          </ol>
        ) : data?.topAssists.manual ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-base">{getFlag(data.topAssists.manual.team)}</span>
            <span className="font-bold text-gray-900 flex-1">{data.topAssists.manual.player}</span>
            <span className="font-black text-blue-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{data.topAssists.manual.assists}</span>
          </div>
        ) : <PendingState />}
      </Card>

      {/* Best attack — computed locally from finished matches */}
      <Card title="התקפה הכי טובה" source="computed">
        {localBestAttack ? (
          <ol className="space-y-1.5">
            {localBestAttack.top5.map(([tla, goals], i) => {
              const { name, flag } = teamLabel(tla);
              return (
                <li key={tla} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center text-gray-400 font-bold">{i + 1}</span>
                  <span className="text-base">{flag}</span>
                  <span className="font-bold text-gray-900 truncate flex-1">{name}</span>
                  <span className="font-black text-amber-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{goals}</span>
                </li>
              );
            })}
          </ol>
        ) : <PendingState />}
      </Card>

      {/* Prolific / Driest groups */}
      <Card title="בית פורה / בית יבש" source="computed">
        {localGroupGoals.prolific && localGroupGoals.driest ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 border border-green-200">
              <span className="font-bold text-green-900 text-sm">פורה — בית {localGroupGoals.prolific.group}</span>
              <span className="font-black text-green-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                {localGroupGoals.prolific.goals} שערים · {localGroupGoals.prolific.played} מש׳
              </span>
            </div>
            <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
              <span className="font-bold text-orange-900 text-sm">יבש — בית {localGroupGoals.driest.group}</span>
              <span className="font-black text-orange-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                {localGroupGoals.driest.goals} שערים · {localGroupGoals.driest.played} מש׳
              </span>
            </div>
          </div>
        ) : <PendingState msg="ממתין למשחקי בתים" />}
      </Card>

      {/* Dirtiest team */}
      <Card title="נבחרת כסחנית" source={data?.dirtiestTeam ? "manual" : undefined} updatedAt={data?.lastUpdated}>
        {data?.dirtiestTeam ? (() => {
          const { name, flag } = teamLabel(data.dirtiestTeam.team);
          return (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base">{flag}</span>
              <span className="font-bold text-gray-900 flex-1">{name}</span>
              {data.dirtiestTeam.cards != null && (
                <span className="font-black text-red-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{data.dirtiestTeam.cards} כרטיסים</span>
              )}
            </div>
          );
        })() : <PendingState />}
      </Card>

      {/* (Penalties O/U card removed — the bet was dropped from the game 2026-06-13.) */}

      {/* Matchups */}
      <Card title="מאצ׳אפים" source={data?.matchups.some(m => m) ? "manual" : undefined} updatedAt={data?.lastUpdated}>
        {data?.matchups.some(m => m) ? (
          <ul className="space-y-1.5">
            {data!.matchups.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-gray-400 font-bold text-xs">מאצ'אפ {i + 1}</span>
                {m ? (() => {
                  const { name, flag } = teamLabel(m);
                  return <><span className="text-base">{flag}</span><span className="font-bold text-gray-900">{name}</span></>;
                })() : <span className="text-gray-300 italic">ממתין</span>}
              </li>
            ))}
          </ul>
        ) : <PendingState />}
      </Card>

      {/* Champion */}
      <Card title="אלוף הטורניר" source={data?.champion ? "manual" : undefined} updatedAt={data?.lastUpdated}>
        {data?.champion ? (() => {
          const { name, flag } = teamLabel(data.champion);
          return (
            <div className="flex items-center justify-center gap-3 bg-gradient-to-l from-yellow-50 to-amber-50 rounded-lg px-4 py-4 border border-amber-200">
              <span className="text-3xl">🏆</span>
              <span className="text-2xl">{flag}</span>
              <span className="text-lg font-black text-amber-900" style={{ fontFamily: "var(--font-secular)" }}>{name}</span>
            </div>
          );
        })() : <PendingState msg="הטורניר עוד לא הסתיים" />}
      </Card>

      {data?.apiError && (
        <div className="sm:col-span-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ Football-Data API לא זמין כרגע · משתמש בנתונים שמוזנים ידנית
        </div>
      )}
    </div>
  );
}
