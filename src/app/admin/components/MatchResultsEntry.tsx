"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MatchResultsEntry() {
  const [results, setResults] = useState<Record<string, { home: number; away: number }>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState("GROUP");

  const SAMPLE_MATCHES = [
    { id: "1", home: "MAR", away: "PER", stage: "GROUP", group: "A", date: "11/06", time: "18:00" },
    { id: "2", home: "CAN", away: "BFA", stage: "GROUP", group: "A", date: "11/06", time: "21:00" },
    { id: "3", home: "MAR", away: "CAN", stage: "GROUP", group: "A", date: "15/06", time: "18:00" },
    { id: "4", home: "BFA", away: "PER", stage: "GROUP", group: "A", date: "15/06", time: "21:00" },
    { id: "5", home: "BFA", away: "MAR", stage: "GROUP", group: "A", date: "19/06", time: "18:00" },
    { id: "6", home: "PER", away: "CAN", stage: "GROUP", group: "A", date: "19/06", time: "18:00" },
    { id: "7", home: "FRA", away: "NZL", stage: "GROUP", group: "B", date: "12/06", time: "18:00" },
    { id: "8", home: "COL", away: "HON", stage: "GROUP", group: "B", date: "12/06", time: "21:00" },
    { id: "13", home: "ARG", away: "IDN", stage: "GROUP", group: "C", date: "13/06", time: "18:00" },
    { id: "14", home: "MEX", away: "UZB", stage: "GROUP", group: "C", date: "13/06", time: "21:00" },
    { id: "73", home: "TBD", away: "TBD", stage: "R32", group: "", date: "28/06", time: "18:00" },
    { id: "74", home: "TBD", away: "TBD", stage: "R32", group: "", date: "28/06", time: "21:00" },
    { id: "89", home: "TBD", away: "TBD", stage: "R16", group: "", date: "03/07", time: "18:00" },
    { id: "97", home: "TBD", away: "TBD", stage: "QF", group: "", date: "09/07", time: "18:00" },
    { id: "103", home: "TBD", away: "TBD", stage: "FINAL", group: "", date: "19/07", time: "21:00" },
  ];

  const filtered = SAMPLE_MATCHES.filter(m => {
    if (filterStage === "ALL") return true;
    if (filterStage === "GROUP") return m.stage === "GROUP";
    return m.stage === filterStage;
  });

  const enteredCount = Object.keys(results).length;

  const handleScore = (matchId: string, side: "home" | "away", value: string) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0) return;
    setResults(prev => ({
      ...prev,
      [matchId]: {
        home: side === "home" ? num : (prev[matchId]?.home ?? 0),
        away: side === "away" ? num : (prev[matchId]?.away ?? 0),
      },
    }));
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`סונכרנו ${data.matchesCount} משחקים מ-Football-Data.org`);
      } else {
        setSyncMessage(`שגיאה: ${data.error}`);
      }
    } catch {
      setSyncMessage("שגיאת רשת — בדקו חיבור");
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-gray-800">סנכרון אוטומטי</p>
              <p className="text-sm text-gray-500">משוך תוצאות מ-Football-Data.org</p>
            </div>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? "מסנכרן..." : "סנכרון עכשיו"}
            </Button>
          </div>
          {syncMessage && (
            <p className={`mt-2 text-sm ${syncMessage.includes("שגיאה") ? "text-red-600" : "text-green-600"}`}>{syncMessage}</p>
          )}
        </CardContent>
      </Card>

      {enteredCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-green-700">תוצאות שהוזנו ידנית ({enteredCount})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(results).map(([id, score]) => {
                const match = SAMPLE_MATCHES.find(m => m.id === id);
                if (!match) return null;
                return (
                  <div key={id} className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-lg text-sm border border-green-200">
                    <span className="font-bold">{match.home} {score.home} - {score.away} {match.away}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{match.date}</span>
                      <Badge variant="outline" className="text-xs">{match.stage}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">הזנת תוצאות ידנית</CardTitle>
            <div className="flex gap-1">
              {[
                { key: "ALL", label: "הכל" },
                { key: "GROUP", label: "בתים" },
                { key: "R32", label: "שמינית" },
                { key: "R16", label: "רבע" },
                { key: "QF", label: "רבע גמר" },
                { key: "SF", label: "חצי" },
                { key: "FINAL", label: "גמר" },
              ].map(s => (
                <button key={s.key} onClick={() => setFilterStage(s.key)}
                  className={`px-2 py-1 rounded text-xs font-bold ${filterStage === s.key ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-100"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filtered.map(m => {
              const hasResult = results[m.id];
              return (
                <div key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${hasResult ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
                  <span className="text-xs text-gray-400 w-8" style={{ fontFamily: "var(--font-inter)" }}>#{m.id}</span>
                  <span className="text-xs text-gray-400 w-12">{m.date}</span>
                  {m.group && <Badge variant="outline" className="text-xs w-8 justify-center">{m.group}</Badge>}
                  <span className="font-bold text-sm w-10 text-end" dir="ltr">{m.home}</span>
                  <Input type="number" min="0" value={hasResult?.home ?? ""} onChange={e => handleScore(m.id, "home", e.target.value)} className="w-12 text-center font-bold" dir="ltr" placeholder="-" />
                  <span className="text-gray-300">:</span>
                  <Input type="number" min="0" value={hasResult?.away ?? ""} onChange={e => handleScore(m.id, "away", e.target.value)} className="w-12 text-center font-bold" dir="ltr" placeholder="-" />
                  <span className="font-bold text-sm w-10" dir="ltr">{m.away}</span>
                  <span className="text-xs text-gray-400 ms-auto">{m.time}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
