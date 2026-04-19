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

import { SystemStatus } from "./components/SystemStatus";
import { MatchResultsEntry } from "./components/MatchResultsEntry";
import { UserManagement } from "./components/UserManagement";
import { AdminsList } from "./components/AdminsList";
import { AdminGuide } from "./components/AdminGuide";
import { CompletionMatrix } from "./components/CompletionMatrix";
import { UserBetsEditor } from "./components/UserBetsEditor";
import { BotGenerator } from "./components/BotGenerator";

interface ScoringConfig {
  toto_group: number; toto_r32: number; toto_r16: number;
  toto_qf: number; toto_sf: number; toto_third: number; toto_final: number;
  exact_group: number; exact_r32: number; exact_r16: number;
  exact_qf: number; exact_sf: number; exact_third: number; exact_final: number;
  group_advance_exact: number; group_advance_partial: number;
  advance_qf: number; advance_sf: number; advance_final: number; advance_winner: number;
  top_scorer_exact: number; top_scorer_relative: number;
  top_assists_exact: number; top_assists_relative: number;
  best_attack: number; prolific_group: number; driest_group: number;
  dirtiest_team: number; matchup: number; penalties_over_under: number;
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
    if (!user) { setIsAdmin(false); return; }
    const { data: admin } = await supabase.from("admins").select("*").eq("email", user.email).single();
    setIsAdmin(!!admin);
    if (admin) loadData();
  }

  async function loadData() {
    const supabase = createClient();
    const { data: tourns } = await supabase.from("tournaments").select("*").order("start_date", { ascending: false });
    setTournaments(tourns || []);
    const { data: config } = await supabase.from("scoring_config").select("*").limit(1).single();
    if (config) setScoringConfig(config);
  }

  async function saveScoringConfig() {
    if (!scoringConfig) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("scoring_config").update(scoringConfig).eq("tournament_id", tournaments.find(t => t.is_current)?.id);
    if (error) { setMessage("שגיאה בשמירה: " + error.message); }
    else { setMessage("ההגדרות נשמרו בהצלחה ✓"); }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  if (isAdmin === null) return <div className="flex min-h-screen items-center justify-center">טוען...</div>;
  if (!isAdmin) return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="max-w-sm text-center">
        <CardContent className="pt-8">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold mb-2">אין גישה</h2>
          <p className="text-sm text-gray-500">דף זה מיועד למנהלים בלבד. פנה למנהל המערכת להוספת הרשאות.</p>
        </CardContent>
      </Card>
    </div>
  );

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
          <Badge variant="outline" className="bg-purple-50 text-purple-700">מנהל</Badge>
        </div>

        <Tabs defaultValue="status" dir="rtl">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="status">סטטוס מערכת</TabsTrigger>
            <TabsTrigger value="results">תוצאות משחקים</TabsTrigger>
            <TabsTrigger value="scoring">ניקוד</TabsTrigger>
            <TabsTrigger value="tournaments">טורנירים</TabsTrigger>
            <TabsTrigger value="guide">מדריך למנהל</TabsTrigger>
            <TabsTrigger value="users">משתמשים</TabsTrigger>
            <TabsTrigger value="admins">מנהלים</TabsTrigger>
            <TabsTrigger value="completion">סטטוס מילוי</TabsTrigger>
            <TabsTrigger value="edit-bets">עריכת הימורים</TabsTrigger>
            <TabsTrigger value="bot">🤖 בוט</TabsTrigger>
          </TabsList>

          <TabsContent value="status"><SystemStatus /></TabsContent>
          <TabsContent value="results"><MatchResultsEntry /></TabsContent>

          <TabsContent value="scoring">
            {scoringConfig && (
              <div className="space-y-6">
                <ScoringSection title="ניקוד משחקים — טוטו (1X2)" fields={[
                  ["toto_group", "בתים"], ["toto_r32", "שמינית"], ["toto_r16", "רבע"],
                  ["toto_qf", "רבע גמר"], ["toto_sf", "חצי"], ["toto_third", "מקום 3"], ["toto_final", "גמר"],
                ]} config={scoringConfig} onChange={setScoringConfig} cols={4} />

                <ScoringSection title="ניקוד משחקים — תוצאה מדויקת (בונוס)" fields={[
                  ["exact_group", "בתים"], ["exact_r32", "שמינית"], ["exact_r16", "רבע"],
                  ["exact_qf", "רבע גמר"], ["exact_sf", "חצי"], ["exact_third", "מקום 3"], ["exact_final", "גמר"],
                ]} config={scoringConfig} onChange={setScoringConfig} cols={4} />

                <ScoringSection title="ניקוד עולות מבעוד מועד" fields={[
                  ["group_advance_exact", "עולה מדויקת מבית"], ["group_advance_partial", "עולה לא מדויקת"],
                  ["advance_qf", "עולה לרבע"], ["advance_sf", "עולה לחצי"],
                  ["advance_final", "עולה לגמר"], ["advance_winner", "זוכה"],
                ]} config={scoringConfig} onChange={setScoringConfig} cols={3} />

                <Card>
                  <CardHeader><CardTitle className="text-base">ניקוד הימורים מיוחדים</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {([
                        ["top_scorer_exact", "מלך שערים (מוחלט)"], ["top_scorer_relative", "מלך שערים (יחסי)"],
                        ["top_assists_exact", "מלך בישולים (מוחלט)"], ["top_assists_relative", "מלך בישולים (יחסי)"],
                        ["best_attack", "התקפה טובה"], ["prolific_group", "בית פורה"],
                        ["driest_group", "בית יבש"], ["dirtiest_team", "כסחנית"],
                        ["matchup", "מאצ'אפ"], ["penalties_over_under", "פנדלים"],
                      ] as [keyof ScoringConfig, string][]).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input type="number" min={0} value={scoringConfig[key]}
                            onChange={(e) => setScoringConfig({ ...scoringConfig, [key]: parseInt(e.target.value) || 0 })}
                            className="text-center" />
                        </div>
                      ))}
                    </div>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">מינימום שערים למלך יחסי</Label>
                        <Input type="number" min={0} value={scoringConfig.top_scorer_min_goals}
                          onChange={(e) => setScoringConfig({ ...scoringConfig, top_scorer_min_goals: parseInt(e.target.value) || 0 })}
                          className="text-center" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">מינימום בישולים למלך יחסי</Label>
                        <Input type="number" min={0} value={scoringConfig.top_assists_min}
                          onChange={(e) => setScoringConfig({ ...scoringConfig, top_assists_min: parseInt(e.target.value) || 0 })}
                          className="text-center" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3">
                  <Button onClick={saveScoringConfig} disabled={saving}>{saving ? "שומר..." : "שמור הגדרות ניקוד"}</Button>
                  {message && <span className="text-sm text-green-600">{message}</span>}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tournaments">
            <Card>
              <CardHeader><CardTitle className="text-base">טורנירים</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tournaments.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-gray-500">{t.start_date} — {t.end_date}</p>
                      </div>
                      <Badge variant="outline" className={
                        t.is_current ? "bg-green-50 text-green-700" : t.status === "FINISHED" ? "bg-gray-100 text-gray-500" : ""
                      }>
                        {t.is_current ? "פעיל" : t.status === "FINISHED" ? "הסתיים" : t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <p className="text-xs text-gray-400">להוספת טורניר חדש (למשל מונדיאל 2030), צרו טורניר חדש כאן. הנתונים מטורנירים קודמים נשמרים ונגישים לצפייה.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users"><UserManagement /></TabsContent>
          <TabsContent value="admins"><AdminsList /></TabsContent>
          <TabsContent value="guide"><AdminGuide /></TabsContent>
          <TabsContent value="completion"><CompletionMatrix /></TabsContent>
          <TabsContent value="edit-bets"><UserBetsEditor /></TabsContent>
          <TabsContent value="bot"><BotGenerator /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ScoringSection({ title, fields, config, onChange, cols }: {
  title: string;
  fields: [keyof ScoringConfig, string][];
  config: ScoringConfig;
  onChange: (c: ScoringConfig) => void;
  cols: number;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className={`grid grid-cols-2 sm:grid-cols-${cols} gap-4`}>
          {fields.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input type="number" min={0} value={config[key]}
                onChange={(e) => onChange({ ...config, [key]: parseInt(e.target.value) || 0 })}
                className="text-center" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
