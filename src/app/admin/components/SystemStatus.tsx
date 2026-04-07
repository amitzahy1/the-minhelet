"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SystemStatus() {
  const [status, setStatus] = useState<Record<string, { ok: boolean; message: string; lastUpdate?: string }>>({});
  const [checking, setChecking] = useState(false);

  const checkAll = async () => {
    setChecking(true);
    const results: Record<string, { ok: boolean; message: string; lastUpdate?: string }> = {};

    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("tournaments").select("short_name").limit(1);
      results.supabase = error
        ? { ok: false, message: `שגיאה: ${error.message}` }
        : { ok: true, message: `מחובר — ${data?.length || 0} טורנירים`, lastUpdate: new Date().toLocaleString("he-IL") };
    } catch (e) { results.supabase = { ok: false, message: `שגיאת חיבור: ${e}` }; }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      results.auth = user
        ? { ok: true, message: `מחובר כ-${user.email}`, lastUpdate: new Date().toLocaleString("he-IL") }
        : { ok: false, message: "לא מחובר" };
    } catch { results.auth = { ok: false, message: "שגיאת אימות" }; }

    try {
      const res = await fetch("/api/matches");
      const data = await res.json();
      results.footballApi = data.matches?.length > 0
        ? { ok: true, message: `${data.matches.length} משחקים זמינים`, lastUpdate: new Date().toLocaleString("he-IL") }
        : { ok: false, message: data.error || "אין נתוני משחקים" };
    } catch { results.footballApi = { ok: false, message: "שגיאת חיבור ל-API" }; }

    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      results.sync = data.success
        ? { ok: true, message: `סונכרנו ${data.matchesCount} משחקים`, lastUpdate: new Date().toLocaleString("he-IL") }
        : { ok: false, message: data.error || "סנכרון נכשל" };
    } catch { results.sync = { ok: false, message: "שגיאת סנכרון" }; }

    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("wc2026"));
      const totalSize = keys.reduce((sum, k) => sum + (localStorage.getItem(k)?.length || 0), 0);
      results.localStorage = { ok: true, message: `${keys.length} מפתחות, ${Math.round(totalSize / 1024)}KB`, lastUpdate: new Date().toLocaleString("he-IL") };
    } catch { results.localStorage = { ok: false, message: "לא זמין" }; }

    setStatus(results);
    setChecking(false);
  };

  useEffect(() => { checkAll(); }, []);

  const services = [
    { key: "supabase", label: "Supabase (בסיס נתונים)", icon: "💾" },
    { key: "auth", label: "אימות משתמשים", icon: "🔐" },
    { key: "footballApi", label: "Football-Data.org API", icon: "⚽" },
    { key: "sync", label: "סנכרון תוצאות", icon: "🔄" },
    { key: "localStorage", label: "אחסון מקומי (גיבוי)", icon: "💿" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">סטטוס מערכת</CardTitle>
            <Button onClick={checkAll} disabled={checking} variant="outline" size="sm">
              {checking ? "בודק..." : "בדוק עכשיו"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {services.map(s => {
              const st = status[s.key];
              return (
                <div key={s.key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  !st ? "border-gray-200 bg-gray-50" :
                  st.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}>
                  <span className="text-2xl">{s.icon}</span>
                  <div className="flex-1">
                    <p className="font-bold text-lg text-gray-900">{s.label}</p>
                    <p className={`text-sm font-medium ${st?.ok ? "text-green-700" : st ? "text-red-700" : "text-gray-400"}`}>
                      {st?.message || "ממתין לבדיקה..."}
                    </p>
                  </div>
                  {st && (
                    <div className="text-end">
                      <span className={`inline-block w-4 h-4 rounded-full ${st.ok ? "bg-green-500" : "bg-red-500"}`}></span>
                      {st.lastUpdate && <p className="text-xs text-gray-400 mt-1">{st.lastUpdate}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">פעולות מהירות</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="justify-start" onClick={() => { window.location.href = "/api/sync"; }}>
              🔄 סנכרן תוצאות מ-API
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => {
              const state = JSON.parse(localStorage.getItem("wc2026-bets") || "{}");
              const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `backup-${new Date().toISOString().split("T")[0]}.json`; a.click();
            }}>
              💾 הורד גיבוי JSON
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => {
              localStorage.removeItem("wc2026-onboarding-seen");
              alert("ה-onboarding יוצג שוב בכניסה הבאה");
            }}>
              📋 אפס הדרכה
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => window.location.href = "/standings"}>
              📊 חזרה לאתר
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
