"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface ScoringConfig {
  // Toto
  toto_group: number; toto_r32: number; toto_r16: number;
  toto_qf: number; toto_sf: number; toto_third: number; toto_final: number;
  // Exact
  exact_group: number; exact_r32: number; exact_r16: number;
  exact_qf: number; exact_sf: number; exact_third: number; exact_final: number;
  // Advancement
  group_advance_exact: number; group_advance_partial: number;
  advance_qf: number; advance_sf: number; advance_final: number; advance_winner: number;
  // Specials
  top_scorer_exact: number; top_scorer_relative: number;
  top_assists_exact: number; top_assists_relative: number;
  best_attack: number; prolific_group: number; driest_group: number;
  dirtiest_team: number; matchup: number; penalties_over_under: number;
  // Minimums
  top_scorer_min_goals: number; top_assists_min: number;
}

interface Tournament {
  id: string;
  name: string;
  short_name: string;
  status: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data: admin } = await supabase
      .from("admins")
      .select("*")
      .eq("email", user.email)
      .single();

    setIsAdmin(!!admin);

    if (admin) {
      loadData();
    }
  }

  async function loadData() {
    const supabase = createClient();

    const { data: tourns } = await supabase
      .from("tournaments")
      .select("*")
      .order("start_date", { ascending: false });
    setTournaments(tourns || []);

    const { data: config } = await supabase
      .from("scoring_config")
      .select("*")
      .limit(1)
      .single();
    if (config) setScoringConfig(config);
  }

  async function saveScoringConfig() {
    if (!scoringConfig) return;
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("scoring_config")
      .update(scoringConfig)
      .eq("tournament_id", tournaments.find(t => t.is_current)?.id);

    if (error) {
      setMessage("שגיאה בשמירה: " + error.message);
    } else {
      setMessage("ההגדרות נשמרו בהצלחה ✓");
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center">טוען...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-sm text-center">
          <CardContent className="pt-8">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-lg font-bold mb-2">אין גישה</h2>
            <p className="text-sm text-gray-500">
              דף זה מיועד למנהלים בלבד. פנה למנהל המערכת להוספת הרשאות.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/standings" className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </a>
            <h1 className="text-2xl font-bold">ניהול מערכת</h1>
          </div>
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            מנהל
          </Badge>
        </div>

        <Tabs defaultValue="results" dir="rtl">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="results">תוצאות משחקים</TabsTrigger>
            <TabsTrigger value="scoring">ניקוד</TabsTrigger>
            <TabsTrigger value="tournaments">טורנירים</TabsTrigger>
            <TabsTrigger value="guide">מדריך למנהל</TabsTrigger>
            <TabsTrigger value="admins">מנהלים</TabsTrigger>
          </TabsList>

          {/* Match Results Entry */}
          <TabsContent value="results">
            <MatchResultsEntry />
          </TabsContent>

          {/* Scoring Config */}
          <TabsContent value="scoring">
            {scoringConfig && (
              <div className="space-y-6">
                {/* Match scoring */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ניקוד משחקים — טוטו (1X2)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {([
                        ["toto_group", "בתים"],
                        ["toto_r32", "שמינית"],
                        ["toto_r16", "רבע"],
                        ["toto_qf", "רבע גמר"],
                        ["toto_sf", "חצי"],
                        ["toto_third", "מקום 3"],
                        ["toto_final", "גמר"],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={scoringConfig[key]}
                            onChange={(e) =>
                              setScoringConfig({
                                ...scoringConfig,
                                [key]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Exact score */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ניקוד משחקים — תוצאה מדויקת (בונוס)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {([
                        ["exact_group", "בתים"],
                        ["exact_r32", "שמינית"],
                        ["exact_r16", "רבע"],
                        ["exact_qf", "רבע גמר"],
                        ["exact_sf", "חצי"],
                        ["exact_third", "מקום 3"],
                        ["exact_final", "גמר"],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={scoringConfig[key]}
                            onChange={(e) =>
                              setScoringConfig({
                                ...scoringConfig,
                                [key]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Advancement */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ניקוד עולות מבעוד מועד</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {([
                        ["group_advance_exact", "עולה מדויקת מבית"],
                        ["group_advance_partial", "עולה לא מדויקת"],
                        ["advance_qf", "עולה לרבע"],
                        ["advance_sf", "עולה לחצי"],
                        ["advance_final", "עולה לגמר"],
                        ["advance_winner", "זוכה"],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={scoringConfig[key]}
                            onChange={(e) =>
                              setScoringConfig({
                                ...scoringConfig,
                                [key]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Special bets */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ניקוד הימורים מיוחדים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {([
                        ["top_scorer_exact", "מלך שערים (מוחלט)"],
                        ["top_scorer_relative", "מלך שערים (יחסי)"],
                        ["top_assists_exact", "מלך בישולים (מוחלט)"],
                        ["top_assists_relative", "מלך בישולים (יחסי)"],
                        ["best_attack", "התקפה טובה"],
                        ["prolific_group", "בית פורה"],
                        ["driest_group", "בית יבש"],
                        ["dirtiest_team", "כסחנית"],
                        ["matchup", "מאצ'אפ"],
                        ["penalties_over_under", "פנדלים"],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={scoringConfig[key]}
                            onChange={(e) =>
                              setScoringConfig({
                                ...scoringConfig,
                                [key]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="text-center"
                          />
                        </div>
                      ))}
                    </div>

                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">מינימום שערים למלך יחסי</Label>
                        <Input
                          type="number"
                          min={0}
                          value={scoringConfig.top_scorer_min_goals}
                          onChange={(e) =>
                            setScoringConfig({
                              ...scoringConfig,
                              top_scorer_min_goals: parseInt(e.target.value) || 0,
                            })
                          }
                          className="text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">מינימום בישולים למלך יחסי</Label>
                        <Input
                          type="number"
                          min={0}
                          value={scoringConfig.top_assists_min}
                          onChange={(e) =>
                            setScoringConfig({
                              ...scoringConfig,
                              top_assists_min: parseInt(e.target.value) || 0,
                            })
                          }
                          className="text-center"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <Button onClick={saveScoringConfig} disabled={saving}>
                    {saving ? "שומר..." : "שמור הגדרות ניקוד"}
                  </Button>
                  {message && (
                    <span className="text-sm text-green-600">{message}</span>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tournaments */}
          <TabsContent value="tournaments">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">טורנירים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tournaments.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-gray-500">
                          {t.start_date} — {t.end_date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            t.is_current
                              ? "bg-green-50 text-green-700"
                              : t.status === "FINISHED"
                              ? "bg-gray-100 text-gray-500"
                              : ""
                          }
                        >
                          {t.is_current ? "פעיל" : t.status === "FINISHED" ? "הסתיים" : t.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <p className="text-xs text-gray-400">
                  להוספת טורניר חדש (למשל מונדיאל 2030), צרו טורניר חדש כאן.
                  הנתונים מטורנירים קודמים נשמרים ונגישים לצפייה.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admins */}
          <TabsContent value="admins">
            <AdminsList />
          </TabsContent>

          {/* Guide */}
          <TabsContent value="guide">
            <AdminGuide />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MatchResultsEntry() {
  const [results, setResults] = useState<Record<string, { home: number; away: number }>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState("GROUP");

  // Sample matches — in production loaded from Supabase
  const SAMPLE_MATCHES = [
    // Group A
    { id: "1", home: "MAR", away: "PER", stage: "GROUP", group: "A", date: "11/06", time: "18:00" },
    { id: "2", home: "CAN", away: "BFA", stage: "GROUP", group: "A", date: "11/06", time: "21:00" },
    { id: "3", home: "MAR", away: "CAN", stage: "GROUP", group: "A", date: "15/06", time: "18:00" },
    { id: "4", home: "BFA", away: "PER", stage: "GROUP", group: "A", date: "15/06", time: "21:00" },
    { id: "5", home: "BFA", away: "MAR", stage: "GROUP", group: "A", date: "19/06", time: "18:00" },
    { id: "6", home: "PER", away: "CAN", stage: "GROUP", group: "A", date: "19/06", time: "18:00" },
    // Group B
    { id: "7", home: "FRA", away: "NZL", stage: "GROUP", group: "B", date: "12/06", time: "18:00" },
    { id: "8", home: "COL", away: "HON", stage: "GROUP", group: "B", date: "12/06", time: "21:00" },
    // Group C
    { id: "13", home: "ARG", away: "IDN", stage: "GROUP", group: "C", date: "13/06", time: "18:00" },
    { id: "14", home: "MEX", away: "UZB", stage: "GROUP", group: "C", date: "13/06", time: "21:00" },
    // Knockout sample
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
      {/* Sync button */}
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

      {/* Entered results summary */}
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

      {/* Match list */}
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
                  <Input
                    type="number" min="0"
                    value={hasResult?.home ?? ""}
                    onChange={e => handleScore(m.id, "home", e.target.value)}
                    className="w-12 text-center font-bold" dir="ltr"
                    placeholder="-"
                  />
                  <span className="text-gray-300">:</span>
                  <Input
                    type="number" min="0"
                    value={hasResult?.away ?? ""}
                    onChange={e => handleScore(m.id, "away", e.target.value)}
                    className="w-12 text-center font-bold" dir="ltr"
                    placeholder="-"
                  />
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

function GuideSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <summary className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between font-bold text-gray-900">
        {title}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div className="px-5 pb-4 text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-3">{children}</div>
    </details>
  );
}

function AdminGuide() {
  return (
    <div className="space-y-3" dir="rtl">
      <GuideSection title="סקירה כללית — מה זה The Minhelet?" defaultOpen>
        <p className="mb-2">פלטפורמת הימורים פרטית למונדיאל 2026. חברי הקבוצה נרשמים, מזינים הימורים על כל שלב בטורניר, ומתחרים על ניקוד.</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-gray-50 rounded-lg p-3"><strong>כתובת:</strong> the-minhelet.vercel.app</div>
          <div className="bg-gray-50 rounded-lg p-3"><strong>קוד כניסה:</strong> minhelet26</div>
          <div className="bg-gray-50 rounded-lg p-3"><strong>נבחרות:</strong> 48</div>
          <div className="bg-gray-50 rounded-lg p-3"><strong>משחקים:</strong> 104</div>
        </div>
      </GuideSection>

      <GuideSection title="תהליך המשתמש — מה כל אחד צריך לעשות" defaultOpen>
        <div className="space-y-3">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="font-bold text-blue-800 mb-1">שלב 1: שלב הבתים</p>
            <p className="text-blue-700">הזנת תוצאה מדויקת ל-72 משחקים ב-12 בתים. הטבלה מתעדכנת אוטומטית לפי חוקי FIFA.</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <p className="font-bold text-amber-800 mb-1">שלב 2: עץ הנוק-אאוט</p>
            <p className="text-amber-700">הנבחרות שעלו מהבתים מופיעות אוטומטית. הזנת תוצאה + בחירת מי עולה מהשמינית ועד הגמר.</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
            <p className="font-bold text-purple-800 mb-1">שלב 3: הימורים מיוחדים</p>
            <p className="text-purple-700">מי זוכה, עולות לכל שלב, מלך שערים, מלך בישולים, כסחנית, מאצ׳אפים, פנדלים.</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <p className="font-bold text-red-800">נעילה: 10 ביוני 2026, 17:00 (שעון ישראל) — אי אפשר לשנות אחרי!</p>
          </div>
        </div>
      </GuideSection>

      <GuideSection title="מבנה הניקוד">
        <h4 className="font-bold mb-2">הימורי תוצאות (לכל משחק)</h4>
        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden mb-4">
          <thead><tr className="bg-gray-100"><th className="py-2 px-3 text-start">שלב</th><th className="py-2 px-3 text-center">טוטו</th><th className="py-2 px-3 text-center">מדויקת</th><th className="py-2 px-3 text-center">סה״כ</th></tr></thead>
          <tbody>
            {[["בתים",2,1,3],["שמינית/רבע",3,1,4],["חצי גמר",3,2,5],["גמר",4,2,6]].map(([s,t,e,tot]) => (
              <tr key={String(s)} className="border-t border-gray-100"><td className="py-1.5 px-3">{s}</td><td className="py-1.5 px-3 text-center text-blue-600 font-bold">{t}</td><td className="py-1.5 px-3 text-center text-green-600 font-bold">+{e}</td><td className="py-1.5 px-3 text-center font-bold">{tot}</td></tr>
            ))}
          </tbody>
        </table>
        <h4 className="font-bold mb-2">הימורי עולות (מבעוד מועד)</h4>
        <ul className="space-y-1 mb-4">
          <li>• עולה מדויקת מהבית: <strong>5 נק׳</strong> · עולה לא מדויקת: <strong>3 נק׳</strong></li>
          <li>• רבע: <strong>4</strong> · חצי: <strong>6</strong> · גמר: <strong>8</strong> · זוכה: <strong>12</strong></li>
        </ul>
        <h4 className="font-bold mb-2">הימורים מיוחדים</h4>
        <ul className="space-y-1 mb-4">
          <li>• מלך שערים: <strong>9</strong> (מוחלט) / <strong>5</strong> (יחסי)</li>
          <li>• מלך בישולים: <strong>7</strong> / <strong>4</strong></li>
          <li>• התקפה, כסחנית, בית פורה/יבש, מאצ׳אפ, פנדלים: <strong>5-6</strong> כ״א</li>
        </ul>
        <h4 className="font-bold mb-2">שובר שוויון</h4>
        <ol className="space-y-0.5">
          {["זוכה","עולות לגמר","טוטו גמר","עולות לחצי","טוטו חצי","מלך שערים","עולות לרבע"].map((r,i) => (
            <li key={i}>{i+1}. {r}</li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection title="עדכון תוצאות — אוטומטי וידני">
        <div className="space-y-3">
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="font-bold text-green-800 mb-1">אוטומטי — Football-Data.org</p>
            <p className="text-green-700">בטאב ״תוצאות משחקים״ → לחצו ״סנכרון עכשיו״. מושך תוצאות מה-API. חינמי, 10 בקשות/דקה.</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="font-bold text-blue-800 mb-1">ידני</p>
            <p className="text-blue-700">בטאב ״תוצאות משחקים״ → בחרו משחק → הזינו תוצאה → נשמר מיד.</p>
          </div>
          <p className="text-gray-500 text-xs">המלצה: לסנכרן אוטומטית כל 30 דקות ביום משחק. להזין ידנית אם יש עיכוב.</p>
        </div>
      </GuideSection>

      <GuideSection title="דפי האתר — מה כל דף עושה">
        <div className="space-y-2">
          {[
            { name: "דירוג", path: "/standings", desc: "טבלת ניקוד כולל, השוואת מהמרים, מלכי קטגוריות, גרפים" },
            { name: "השוואה", path: "/compare", desc: "השוואה מלאה בין כל המהמרים — עולות, מיוחדים, בתים" },
            { name: "לו״ז", path: "/schedule", desc: "לוח 104 משחקים בשעון ישראל, סינון לפי בית" },
            { name: "לייב", path: "/live", desc: "משחקים חיים, ניחושי חברים, בריאות העץ שלך" },
            { name: "נבחרות", path: "/squads", desc: "סגלים של 48 נבחרות, הרכב פתיחה על מגרש" },
            { name: "חוקים", path: "/rules", desc: "כל טבלאות הניקוד, שוברי שוויון, לוח זמנים" },
            { name: "הימורי משתמש", path: "/groups", desc: "3 שלבים: בתים → נוק-אאוט → מיוחדים" },
            { name: "ניהול", path: "/admin", desc: "תוצאות, ניקוד, טורנירים, מנהלים, מדריך" },
          ].map(p => (
            <div key={p.name} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
              <span className="font-bold text-gray-800 shrink-0 w-20">{p.name}</span>
              <span className="text-gray-500 text-xs shrink-0" dir="ltr">{p.path}</span>
              <span className="text-gray-600 flex-1">{p.desc}</span>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection title="גיבויים ושמירת נתונים">
        <ul className="space-y-2">
          <li>• <strong>שמירה אוטומטית:</strong> כל שינוי בהימורים נשמר ב-localStorage + Supabase (ענן)</li>
          <li>• <strong>גיבוי יומי:</strong> כל יום נשמר snapshot מלא של כל ההימורים ב-localStorage</li>
          <li>• <strong>ייצוא CSV:</strong> בדף הדירוג יש כפתור CSV להורדת כל הנתונים</li>
          <li>• <strong>ייצוא JSON:</strong> כפתור ״גיבוי״ בדף הדירוג מוריד גיבוי מלא</li>
          <li>• <strong>שחזור:</strong> ניתן לשחזר מגיבוי דרך קונסולת הדפדפן</li>
        </ul>
      </GuideSection>

      <GuideSection title="שאלות נפוצות">
        {[
          { q: "משתמש שכח להזין הימורים?", a: "לא מקבל נקודות על מה שלא הזין." },
          { q: "הוספת משתמש אחרי הטורניר התחיל?", a: "אפשר, אבל יפסיד נקודות על בתים ועולות." },
          { q: "טעות בתוצאה?", a: "מנהל מתקן בטאב ״תוצאות משחקים״." },
          { q: "שינוי קוד הכניסה?", a: "בקובץ src/app/api/verify-code/route.ts" },
          { q: "שינוי ניקוד?", a: "בטאב ״ניקוד״ בדף הניהול — מיידי." },
          { q: "הוספת מנהל?", a: "בטאב ״מנהלים״ — הזנת אימייל." },
          { q: "איפה רואים הימורים של כולם?", a: "דף ״השוואה״ מציג הכל." },
        ].map(({ q, a }) => (
          <div key={q} className="py-2 border-b border-gray-100 last:border-0">
            <p className="font-bold text-gray-800">{q}</p>
            <p className="text-gray-500 text-xs mt-0.5">{a}</p>
          </div>
        ))}
      </GuideSection>

      <GuideSection title="פרטים טכניים">
        <div className="space-y-2 text-xs text-gray-500">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2"><strong>Framework:</strong> Next.js 15</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Language:</strong> TypeScript</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Styling:</strong> Tailwind CSS v4 + shadcn/ui</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>State:</strong> Zustand + persist</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>DB:</strong> Supabase (PostgreSQL)</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Auth:</strong> Supabase Auth (Google + Email)</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>API (matches):</strong> Football-Data.org</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>API (live):</strong> API-Football</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Deploy:</strong> Vercel</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Repo:</strong> github.com/amitzahy1/the-minhelet</div>
          </div>
          <h4 className="font-bold text-gray-700 mt-3">מבנה טבלאות DB (Supabase)</h4>
          <ul className="space-y-0.5">
            {[
              "profiles — פרופילי משתמשים",
              "leagues — ליגות פרטיות",
              "league_members — חברות בליגה",
              "teams — 48 נבחרות",
              "matches — 104 משחקים",
              "user_brackets — עץ הימורים (JSONB)",
              "advancement_picks — הימורי עולות",
              "special_bets — הימורים מיוחדים",
              "match_predictions — הימורי תוצאות",
              "scoring_log — יומן ניקוד",
              "scoring_config — הגדרות ניקוד (ניתן לשינוי)",
              "tournaments — טורנירים (WC2026, WC2030...)",
              "admins — רשימת מנהלים",
            ].map(t => <li key={t}>• {t}</li>)}
          </ul>
          <h4 className="font-bold text-gray-700 mt-3">Environment Variables</h4>
          <ul className="space-y-0.5 font-mono text-[10px]">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>SUPABASE_SERVICE_ROLE_KEY</li>
            <li>FOOTBALL_DATA_TOKEN</li>
            <li>API_FOOTBALL_KEY</li>
          </ul>
        </div>
      </GuideSection>
    </div>
  );
}

function AdminsList() {
  const [admins, setAdmins] = useState<{ email: string; role: string }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    const supabase = createClient();
    const { data } = await supabase.from("admins").select("email, role");
    setAdmins(data || []);
  }

  async function addAdmin() {
    if (!newEmail) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("admins").insert({ email: newEmail, role: "LEAGUE_ADMIN" });
    setNewEmail("");
    await loadAdmins();
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">מנהלים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {admins.map((a) => (
            <div
              key={a.email}
              className="flex items-center justify-between rounded-lg border px-4 py-2.5"
            >
              <span className="text-sm" dir="ltr">{a.email}</span>
              <Badge variant="outline" className="text-xs">
                {a.role === "SUPER_ADMIN" ? "סופר אדמין" : "מנהל ליגה"}
              </Badge>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="הזינו אימייל של מנהל חדש"
            dir="ltr"
            className="flex-1"
          />
          <Button onClick={addAdmin} disabled={loading || !newEmail}>
            הוספה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
