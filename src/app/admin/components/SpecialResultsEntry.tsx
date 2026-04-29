"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ALL_TEAMS, GROUP_LETTERS } from "@/lib/tournament/groups";
import { getFlag } from "@/lib/flags";
import { MATCHUPS } from "@/lib/matchups";

type Actuals = {
  top_scorer_player: string | null;
  top_scorer_team: string | null;
  top_scorer_goals: number | null;
  top_assists_player: string | null;
  top_assists_team: string | null;
  top_assists_count: number | null;
  best_attack_team: string | null;
  best_attack_goals: number | null;
  dirtiest_team: string | null;
  dirtiest_team_cards: number | null;
  most_prolific_group: string | null;
  most_prolific_goals: number | null;
  driest_group: string | null;
  driest_group_goals: number | null;
  matchup_result_1: "1" | "X" | "2" | null;
  matchup_result_2: "1" | "X" | "2" | null;
  matchup_result_3: "1" | "X" | "2" | null;
  total_penalties: number | null;
  penalties_over_under: "OVER" | "UNDER" | null;
  champion: string | null;
};

const EMPTY: Actuals = {
  top_scorer_player: "",
  top_scorer_team: null,
  top_scorer_goals: null,
  top_assists_player: "",
  top_assists_team: null,
  top_assists_count: null,
  best_attack_team: null,
  best_attack_goals: null,
  dirtiest_team: null,
  dirtiest_team_cards: null,
  most_prolific_group: null,
  most_prolific_goals: null,
  driest_group: null,
  driest_group_goals: null,
  matchup_result_1: null,
  matchup_result_2: null,
  matchup_result_3: null,
  total_penalties: null,
  penalties_over_under: null,
  champion: null,
};

const TEAMS_SORTED = [...ALL_TEAMS].sort((a, b) =>
  (a.name_he || a.code).localeCompare(b.name_he || b.code, "he")
);

export function SpecialResultsEntry() {
  const [actuals, setActuals] = useState<Actuals>(EMPTY);
  const [baseline, setBaseline] = useState<Actuals>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingScorer, setSyncingScorer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/special-results");
      const data = await res.json();
      if (data.actuals) {
        const merged: Actuals = { ...EMPTY };
        for (const k of Object.keys(EMPTY) as (keyof Actuals)[]) {
          (merged as Record<string, unknown>)[k] = data.actuals[k] ?? EMPTY[k];
        }
        setActuals(merged);
        setBaseline(merged);
      } else {
        setActuals(EMPTY);
        setBaseline(EMPTY);
      }
    } catch (e) {
      setMessage("שגיאה בטעינה: " + String(e));
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/special-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actuals),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage("שגיאה: " + (data.error || res.statusText));
      } else if (data.changed === 0) {
        setMessage("אין שינויים");
      } else {
        setMessage(`נשמרו ${data.changed} שדות ✓`);
        setBaseline(actuals);
      }
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  }

  async function syncTopScorer() {
    setSyncingScorer(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/special-results/sync-topscorer", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage(`מלך שערים: ${data.topScorer.player} (${data.topScorer.team}) — ${data.topScorer.goals} שערים ✓`);
        await load();
      } else {
        setMessage("שגיאה: " + (data.error || "Sync failed"));
      }
    } catch {
      setMessage("שגיאת רשת בסנכרון מלך שערים");
    }
    setSyncingScorer(false);
    setTimeout(() => setMessage(null), 5000);
  }

  const isDirty = JSON.stringify(actuals) !== JSON.stringify(baseline);

  function set<K extends keyof Actuals>(k: K, v: Actuals[K]) {
    setActuals((prev) => ({ ...prev, [k]: v }));
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-400">טוען תוצאות מיוחדים...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">🏆 תוצאות ההימורים המיוחדים</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={syncTopScorer} disabled={syncingScorer} className="text-xs">
              {syncingScorer ? "מסנכרן..." : "🔄 Auto מלך שערים"}
            </Button>
            {isDirty && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                {Object.keys(actuals).filter((k) => actuals[k as keyof Actuals] !== baseline[k as keyof Actuals]).length} שינויים
              </Badge>
            )}
            <Button onClick={save} disabled={!isDirty || saving}>
              {saving ? "שומר..." : "שמור תוצאות"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          הזינו את התוצאות בפועל של ההימורים המיוחדים. הנתונים יוצגו בדף המעקב
          במערכת ויחושבו מול ההימורים של המהמרים. משדות ריקים — עדיין טרם נסגר.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Top scorer + assists */}
        <Section title="⚽ מלך שערים ומלך בישולים">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="מלך שערים — שם השחקן">
              <Input
                value={actuals.top_scorer_player || ""}
                onChange={(e) => set("top_scorer_player", e.target.value)}
                placeholder="Kylian Mbappé"
              />
            </Field>
            <Field label="מלך שערים — נבחרת">
              <TeamPicker value={actuals.top_scorer_team} onChange={(v) => set("top_scorer_team", v)} />
            </Field>
            <Field label="מלך שערים — מס׳ שערים (opt.)">
              <Input
                type="number"
                min={0}
                value={actuals.top_scorer_goals ?? ""}
                onChange={(e) => set("top_scorer_goals", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))}
                dir="ltr"
              />
            </Field>
            <Field label=" "><div /></Field>

            <Field label="מלך בישולים — שם השחקן">
              <Input
                value={actuals.top_assists_player || ""}
                onChange={(e) => set("top_assists_player", e.target.value)}
                placeholder="Lionel Messi"
              />
            </Field>
            <Field label="מלך בישולים — נבחרת">
              <TeamPicker value={actuals.top_assists_team} onChange={(v) => set("top_assists_team", v)} />
            </Field>
            <Field label="מלך בישולים — מס׳ בישולים (opt.)">
              <Input
                type="number"
                min={0}
                value={actuals.top_assists_count ?? ""}
                onChange={(e) => set("top_assists_count", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))}
                dir="ltr"
              />
            </Field>
            <Field label=" "><div /></Field>
          </div>
        </Section>

        {/* Team-level */}
        <Section title="🛡️ נבחרות">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="נבחרת הכי התקפית (הכי הרבה שערים)">
              <TeamPicker value={actuals.best_attack_team} onChange={(v) => set("best_attack_team", v)} />
            </Field>
            <Field label="מס׳ שערים שכבשה">
              <Input
                type="number"
                min={0}
                value={actuals.best_attack_goals ?? ""}
                onChange={(e) => set("best_attack_goals", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))}
                dir="ltr"
              />
            </Field>
            <Field label="נבחרת כסחנית (הכי הרבה כרטיסים)">
              <TeamPicker value={actuals.dirtiest_team} onChange={(v) => set("dirtiest_team", v)} />
            </Field>
            <Field label="מס׳ כרטיסים">
              <Input
                type="number"
                min={0}
                value={actuals.dirtiest_team_cards ?? ""}
                onChange={(e) => set("dirtiest_team_cards", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))}
                dir="ltr"
              />
            </Field>
          </div>
        </Section>

        {/* Groups */}
        <Section title="🏟️ בתים">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="בית פורה (הכי הרבה שערים בשלב הבתים)">
              <GroupPicker value={actuals.most_prolific_group} onChange={(v) => set("most_prolific_group", v)} />
            </Field>
            <Field label="מס׳ שערים בבית">
              <Input
                type="number"
                min={0}
                value={actuals.most_prolific_goals ?? ""}
                onChange={(e) => set("most_prolific_goals", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))}
                dir="ltr"
              />
            </Field>
            <Field label="בית יבש (הכי מעט שערים בבתים)">
              <GroupPicker value={actuals.driest_group} onChange={(v) => set("driest_group", v)} />
            </Field>
            <Field label="מס׳ שערים בבית">
              <Input
                type="number"
                min={0}
                value={actuals.driest_group_goals ?? ""}
                onChange={(e) => set("driest_group_goals", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))}
                dir="ltr"
              />
            </Field>
          </div>
        </Section>

        {/* Matchups */}
        <Section title="🤼 מאצ׳אפים">
          <div className="space-y-2">
            {MATCHUPS.map((mu, i) => {
              const key = `matchup_result_${i + 1}` as "matchup_result_1" | "matchup_result_2" | "matchup_result_3";
              const value = actuals[key];
              const options = [
                { val: "1" as const, label: mu.p1 },
                { val: "X" as const, label: "🤝 שווה" },
                { val: "2" as const, label: mu.p2 },
              ];
              return (
                <div key={mu.id} className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-sm font-bold mb-1.5">{mu.p1} vs {mu.p2}</p>
                  <div className="flex gap-2">
                    {options.map((o) => {
                      const active = value === o.val;
                      return (
                        <button
                          key={o.val}
                          type="button"
                          onClick={() => set(key, active ? null : o.val)}
                          className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${
                            active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50"
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Penalties + champion */}
        <Section title="⚖️ פנדלים ואלוף">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="סה״כ פנדלים בטורניר">
              <Input
                type="number"
                min={0}
                value={actuals.total_penalties ?? ""}
                onChange={(e) => set("total_penalties", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))}
                dir="ltr"
              />
            </Field>
            <Field label="פנדלים — מעל / מתחת 18.5">
              <div className="flex gap-2">
                {(["OVER", "UNDER"] as const).map((side) => {
                  const active = actuals.penalties_over_under === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => set("penalties_over_under", active ? null : side)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${
                        active
                          ? side === "OVER"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {side === "OVER" ? "⬆ מעל 18.5" : "⬇ מתחת 18.5"}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="אלוף העולם">
              <TeamPicker value={actuals.champion} onChange={(v) => set("champion", v)} />
            </Field>
          </div>
        </Section>

        {message && (
          <p className={`text-sm ${message.includes("שגיאה") ? "text-red-600" : "text-green-700"}`}>
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-600 font-medium">{label}</label>
      {children}
    </div>
  );
}

function TeamPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white w-full"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">— בחר נבחרת —</option>
      {TEAMS_SORTED.map((t) => (
        <option key={t.code} value={t.code}>
          {getFlag(t.code)} {t.name_he} ({t.code})
        </option>
      ))}
    </select>
  );
}

function GroupPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white w-full"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">—</option>
      {GROUP_LETTERS.map((g) => (
        <option key={g} value={g}>
          בית {g}
        </option>
      ))}
    </select>
  );
}
