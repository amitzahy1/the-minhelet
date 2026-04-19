"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GROUPS, GROUP_LETTERS, ALL_TEAMS } from "@/lib/tournament/groups";
import { getFlag } from "@/lib/flags";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupMatchScore {
  home: number | null;
  away: number | null;
}
interface GroupState {
  order: number[];
  scores: GroupMatchScore[];
}
interface KnockoutMatchState {
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

interface BracketRow {
  group_predictions: Record<string, GroupState>;
  third_place_qualifiers: string[];
  knockout_tree: Record<string, KnockoutMatchState>;
  champion: string | null;
}

interface AdvancementRow {
  group_qualifiers: Record<string, string[]>;
  advance_to_qf: string[];
  advance_to_sf: string[];
  advance_to_final: string[];
  winner: string;
}

interface SpecialRow {
  top_scorer_player: string | null;
  top_scorer_team: string | null;
  top_assists_player: string | null;
  top_assists_team: string | null;
  best_attack_team: string | null;
  most_prolific_group: string | null;
  driest_group: string | null;
  dirtiest_team: string | null;
  matchup_pick: string | null;
  penalties_over_under: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
}

// Structure for the 6 group matches: pairs of team indices in [0..3]
const GROUP_MATCH_PAIRS: Array<[number, number]> = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

// Knockout slot layout
const KO_STAGES: Array<{ stage: string; label: string; keys: string[] }> = [
  {
    stage: "r32",
    label: "שמינית (R32)",
    keys: [
      "r32l_0", "r32l_1", "r32l_2", "r32l_3", "r32l_4", "r32l_5", "r32l_6", "r32l_7",
      "r32r_0", "r32r_1", "r32r_2", "r32r_3", "r32r_4", "r32r_5", "r32r_6", "r32r_7",
    ],
  },
  { stage: "r16", label: "רבע (R16)", keys: ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3"] },
  { stage: "qf", label: "רבע גמר (QF)", keys: ["qfl_0", "qfl_1", "qfr_0", "qfr_1"] },
  { stage: "sf", label: "חצי גמר (SF)", keys: ["sfl_0", "sfr_0"] },
  { stage: "final", label: "גמר", keys: ["final"] },
];

// Sorted team list for dropdowns
const TEAMS_SORTED = [...ALL_TEAMS].sort((a, b) =>
  (a.name_he || a.code).localeCompare(b.name_he || b.code, "he")
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyGroup(): GroupState {
  return {
    order: [0, 1, 2, 3],
    scores: Array(6)
      .fill(null)
      .map(() => ({ home: null, away: null })),
  };
}

function emptyBracket(): BracketRow {
  const group_predictions: Record<string, GroupState> = {};
  for (const g of GROUP_LETTERS) group_predictions[g] = emptyGroup();
  return { group_predictions, third_place_qualifiers: [], knockout_tree: {}, champion: null };
}

function emptyAdvancement(): AdvancementRow {
  return {
    group_qualifiers: {},
    advance_to_qf: ["", "", "", "", "", "", "", ""],
    advance_to_sf: ["", "", "", ""],
    advance_to_final: ["", ""],
    winner: "",
  };
}

function emptySpecial(): SpecialRow {
  return {
    top_scorer_player: "",
    top_scorer_team: "",
    top_assists_player: "",
    top_assists_team: "",
    best_attack_team: "",
    most_prolific_group: "",
    driest_group: "",
    dirtiest_team: "",
    matchup_pick: "",
    penalties_over_under: "",
  };
}

function isFilledStr(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function isFilledScore(s: GroupMatchScore | undefined): boolean {
  return !!s && s.home !== null && s.home !== undefined && s.away !== null && s.away !== undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserBetsEditor() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");

  // Snapshot of what's LOCKED (what the DB had when we loaded)
  const [lockedBracket, setLockedBracket] = useState<BracketRow>(emptyBracket());
  const [lockedAdv, setLockedAdv] = useState<AdvancementRow>(emptyAdvancement());
  const [lockedSpecial, setLockedSpecial] = useState<SpecialRow>(emptySpecial());

  // Editable draft (merged with locked). We only write to empty slots.
  const [bracket, setBracket] = useState<BracketRow>(emptyBracket());
  const [advancement, setAdvancement] = useState<AdvancementRow>(emptyAdvancement());
  const [special, setSpecial] = useState<SpecialRow>(emptySpecial());

  const [dirty, setDirty] = useState<{ bracket: boolean; advancement: boolean; special: boolean }>({
    bracket: false,
    advancement: false,
    special: false,
  });

  const [groupLetter, setGroupLetter] = useState<string>("A");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers(
          data.users.map((u: { id: string; email?: string; name?: string }) => ({
            id: u.id,
            email: u.email || "",
            name: u.name || u.email?.split("@")[0] || "ללא שם",
          }))
        );
      }
    } catch {
      setMessage("שגיאה בטעינת משתמשים");
    }
  }

  function padArr(arr: unknown, n: number): string[] {
    const a = Array.isArray(arr) ? (arr as string[]) : [];
    return Array.from({ length: n }, (_, i) => a[i] ?? "");
  }

  async function loadUserBets(userId: string) {
    if (!userId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/user-bets?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage("שגיאה: " + (data.error || res.statusText));
        setLoading(false);
        return;
      }

      // Bracket
      const lb: BracketRow = emptyBracket();
      if (data.bracket) {
        for (const g of GROUP_LETTERS) {
          const src = data.bracket.group_predictions?.[g];
          if (src) {
            lb.group_predictions[g] = {
              order: Array.isArray(src.order) && src.order.length === 4 ? src.order : [0, 1, 2, 3],
              scores:
                Array.isArray(src.scores) && src.scores.length === 6
                  ? src.scores.map((s: GroupMatchScore) => ({
                      home: s?.home ?? null,
                      away: s?.away ?? null,
                    }))
                  : emptyGroup().scores,
            };
          }
        }
        lb.third_place_qualifiers = Array.isArray(data.bracket.third_place_qualifiers)
          ? data.bracket.third_place_qualifiers
          : [];
        lb.knockout_tree = data.bracket.knockout_tree || {};
        lb.champion = data.bracket.champion ?? null;
      }
      setLockedBracket(lb);
      setBracket(JSON.parse(JSON.stringify(lb))); // deep clone for editing

      // Advancement
      const la: AdvancementRow = emptyAdvancement();
      if (data.advancement) {
        la.group_qualifiers = data.advancement.group_qualifiers || {};
        la.advance_to_qf = padArr(data.advancement.advance_to_qf, 8);
        la.advance_to_sf = padArr(data.advancement.advance_to_sf, 4);
        la.advance_to_final = padArr(data.advancement.advance_to_final, 2);
        la.winner = data.advancement.winner || "";
      }
      setLockedAdv(la);
      setAdvancement(JSON.parse(JSON.stringify(la)));

      // Special
      const ls: SpecialRow = emptySpecial();
      if (data.special) {
        for (const k of Object.keys(emptySpecial()) as (keyof SpecialRow)[]) {
          ls[k] = data.special[k] ?? "";
        }
      }
      setLockedSpecial(ls);
      setSpecial(JSON.parse(JSON.stringify(ls)));

      setDirty({ bracket: false, advancement: false, special: false });
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setLoading(false);
  }

  // ---------- Completion stats ----------
  // These counts mirror /api/admin/completion EXACTLY so the numbers here
  // match the "סטטוס מילוי" page.
  // Total = 12 groups + 31 knockout + 25 special/advancement = 68
  const completion = useMemo(() => {
    // Groups: count FULLY completed groups (all 6 match scores filled)
    let groupsCompleted = 0;
    for (const g of GROUP_LETTERS) {
      const gp = lockedBracket.group_predictions[g];
      if (!gp?.scores) continue;
      if (gp.scores.filter(isFilledScore).length === 6) groupsCompleted += 1;
    }

    // Knockout: matches with winner set (31 max)
    let koFilled = 0;
    for (const stage of KO_STAGES) {
      for (const k of stage.keys) {
        const m = lockedBracket.knockout_tree[k];
        if (isFilledStr(m?.winner)) koFilled += 1;
      }
    }

    // Special section = 10 items (NOT counting *_team fields)
    // 1 top_scorer_player + 1 top_assists_player + 1 best_attack + 1 prolific +
    // 1 driest + 1 dirtiest + up to 3 matchup_pick (split by commas) + 1 penalties = 10
    let specialOnly = 0;
    if (isFilledStr(lockedSpecial.top_scorer_player)) specialOnly += 1;
    if (isFilledStr(lockedSpecial.top_assists_player)) specialOnly += 1;
    if (isFilledStr(lockedSpecial.best_attack_team)) specialOnly += 1;
    if (isFilledStr(lockedSpecial.most_prolific_group)) specialOnly += 1;
    if (isFilledStr(lockedSpecial.driest_group)) specialOnly += 1;
    if (isFilledStr(lockedSpecial.dirtiest_team)) specialOnly += 1;
    if (isFilledStr(lockedSpecial.matchup_pick)) {
      specialOnly += (lockedSpecial.matchup_pick || "").split(",").filter(Boolean).length;
    }
    if (isFilledStr(lockedSpecial.penalties_over_under)) specialOnly += 1;

    // Advancement section = 15 items (8 QF + 4 SF + 2 final + 1 winner)
    let advanceOnly = 0;
    advanceOnly += lockedAdv.advance_to_qf.filter(isFilledStr).length;
    advanceOnly += lockedAdv.advance_to_sf.filter(isFilledStr).length;
    advanceOnly += lockedAdv.advance_to_final.filter(isFilledStr).length;
    if (isFilledStr(lockedAdv.winner)) advanceOnly += 1;

    const specialsFilled = specialOnly + advanceOnly;
    const totalFilled = groupsCompleted + koFilled + specialsFilled;
    const totalItems = 12 + 31 + 25;

    return {
      groupsCompleted,
      groupsTotal: 12,
      koFilled,
      koTotal: 31,
      specialOnly,
      specialOnlyTotal: 10,
      advanceOnly,
      advanceOnlyTotal: 15,
      specialsFilled,
      specialsTotal: 25,
      overallPct: Math.round((totalFilled / totalItems) * 100),
    };
  }, [lockedBracket, lockedSpecial, lockedAdv]);

  const fullyComplete = completion.overallPct >= 100;

  // ---------- Mutators (respect lock) ----------

  function updateGroupOrder(letter: string, teamIdx: number, newPos: number) {
    // Only allowed if the group has no filled scores yet
    const locked = lockedBracket.group_predictions[letter]?.scores || [];
    if (locked.some(isFilledScore)) return;
    setBracket((prev) => {
      const group = prev.group_predictions[letter] ?? emptyGroup();
      const order = [...group.order];
      const currentPos = order.indexOf(teamIdx);
      if (currentPos === -1 || currentPos === newPos) return prev;
      const other = order[newPos];
      order[newPos] = teamIdx;
      order[currentPos] = other;
      return { ...prev, group_predictions: { ...prev.group_predictions, [letter]: { ...group, order } } };
    });
    setDirty((d) => ({ ...d, bracket: true }));
  }

  function updateGroupScore(letter: string, matchIdx: number, side: "home" | "away", value: string) {
    // Only allowed if THIS side is currently null in the locked snapshot
    const locked = lockedBracket.group_predictions[letter]?.scores?.[matchIdx];
    if (locked?.[side] !== null && locked?.[side] !== undefined) return;
    const v = value === "" ? null : Math.max(0, parseInt(value) || 0);
    setBracket((prev) => {
      const group = prev.group_predictions[letter] ?? emptyGroup();
      const scores = group.scores.map((s, i) => (i === matchIdx ? { ...s, [side]: v } : s));
      return { ...prev, group_predictions: { ...prev.group_predictions, [letter]: { ...group, scores } } };
    });
    setDirty((d) => ({ ...d, bracket: true }));
  }

  function updateKnockout(key: string, patch: Partial<KnockoutMatchState>) {
    const locked = lockedBracket.knockout_tree[key] || { score1: null, score2: null, winner: null };
    const allowed: Partial<KnockoutMatchState> = {};
    if ("score1" in patch && (locked.score1 === null || locked.score1 === undefined)) allowed.score1 = patch.score1 ?? null;
    if ("score2" in patch && (locked.score2 === null || locked.score2 === undefined)) allowed.score2 = patch.score2 ?? null;
    if ("winner" in patch && !isFilledStr(locked.winner)) allowed.winner = patch.winner ?? null;
    if (Object.keys(allowed).length === 0) return;
    setBracket((prev) => {
      const existing = prev.knockout_tree[key] || { score1: null, score2: null, winner: null };
      return { ...prev, knockout_tree: { ...prev.knockout_tree, [key]: { ...existing, ...allowed } } };
    });
    setDirty((d) => ({ ...d, bracket: true }));
  }

  function updateChampion(code: string) {
    if (isFilledStr(lockedBracket.champion)) return;
    setBracket((prev) => ({ ...prev, champion: code || null }));
    setDirty((d) => ({ ...d, bracket: true }));
  }

  function setAdvArr(key: "advance_to_qf" | "advance_to_sf" | "advance_to_final", idx: number, value: string) {
    if (isFilledStr(lockedAdv[key][idx])) return;
    setAdvancement((prev) => {
      const arr = [...prev[key]];
      arr[idx] = value;
      return { ...prev, [key]: arr };
    });
    setDirty((d) => ({ ...d, advancement: true }));
  }

  function setAdvWinner(v: string) {
    if (isFilledStr(lockedAdv.winner)) return;
    setAdvancement((prev) => ({ ...prev, winner: v }));
    setDirty((d) => ({ ...d, advancement: true }));
  }

  function setSpecialField<K extends keyof SpecialRow>(k: K, v: string) {
    if (isFilledStr(lockedSpecial[k])) return;
    setSpecial((prev) => ({ ...prev, [k]: v }));
    setDirty((d) => ({ ...d, special: true }));
  }

  // ---------- Save ----------
  async function save() {
    if (!selectedUserId) return;
    setSaving(true);
    setMessage(null);
    const body: Record<string, unknown> = { userId: selectedUserId, note: note || undefined };
    if (dirty.bracket) {
      body.bracket = {
        group_predictions: bracket.group_predictions,
        third_place_qualifiers: bracket.third_place_qualifiers,
        knockout_tree: bracket.knockout_tree,
        champion: bracket.champion,
      };
    }
    if (dirty.advancement) {
      body.advancement = {
        advance_to_qf: advancement.advance_to_qf,
        advance_to_sf: advancement.advance_to_sf,
        advance_to_final: advancement.advance_to_final,
        winner: advancement.winner,
      };
    }
    if (dirty.special) {
      body.special = Object.fromEntries(
        Object.entries(special).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
      );
    }

    try {
      const res = await fetch("/api/admin/user-bets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage("שגיאה: " + (data.errors?.join(" | ") || data.error || res.statusText));
      } else {
        const a = data.applied || {};
        const totalApplied = (a.bracket || 0) + (a.advancement || 0) + (a.special || 0);
        if (totalApplied === 0) {
          setMessage("לא נשמרו שינויים — כל השדות שניסית לשנות כבר מולאו");
        } else {
          setMessage(
            `נשמר ✓ (בתים/נוקאאוט: ${a.bracket || 0}, עולות: ${a.advancement || 0}, מיוחדים: ${a.special || 0})`
          );
        }
        // Reload from DB to re-sync lock state + UI
        await loadUserBets(selectedUserId);
        setNote("");
      }
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 6000);
  }

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );
  const anyDirty = dirty.bracket || dirty.advancement || dirty.special;

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">עריכת הימורי משתמש (מילוי שדות חסרים)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mb-3 text-sm text-amber-900 leading-relaxed">
            <p className="font-bold mb-1">⚠️ כללים</p>
            <ul className="list-disc pr-5 space-y-0.5 text-xs">
              <li>ניתן למלא רק שדות <b>ריקים</b>. שדות שהמשתמש כבר מילא — נעולים ולא ניתנים לשינוי.</li>
              <li>שינוי תוצאות קיימות או החלטות אחרות דורש עדכון ידני במסד הנתונים.</li>
              <li>כל מילוי נרשם ללוג ביקורת (<code>admin_audit_log</code>) עם אימייל המנהל וההערה שצורפה.</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              value={selectedUserId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedUserId(id);
                if (id) loadUserBets(id);
              }}
            >
              <option value="">— בחר משתמש —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.email && `(${u.email})`}
                </option>
              ))}
            </select>

            <Input
              placeholder="הערת מנהל (לאודיט)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-64"
            />

            <Button onClick={save} disabled={!anyDirty || saving || fullyComplete}>
              {saving ? "שומר..." : "שמור שינויים"}
            </Button>

            {selectedUserId && !loading && (
              <Button variant="outline" size="sm" onClick={() => loadUserBets(selectedUserId)}>
                טען מחדש
              </Button>
            )}
          </div>

          {selectedUser && !loading && (
            <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
              <span className="font-bold text-gray-700">סטטוס מילוי של {selectedUser.name}:</span>
              <Badge variant="outline" className={completion.groupsCompleted === 12 ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}>
                בתים {completion.groupsCompleted}/12
              </Badge>
              <Badge variant="outline" className={completion.koFilled === 31 ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}>
                נוקאאוט {completion.koFilled}/31
              </Badge>
              <Badge variant="outline" className={completion.specialsFilled === 25 ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}>
                מיוחדים+עולות {completion.specialsFilled}/25
              </Badge>
              <Badge variant="outline" className={fullyComplete ? "text-green-700 bg-green-50" : ""}>
                סה״כ {completion.overallPct}%
              </Badge>
            </div>
          )}

          {message && (
            <p className={`mt-2 text-sm ${message.includes("שגיאה") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      {loading && <p className="text-center text-gray-400 py-6">טוען הימורים...</p>}

      {!loading && selectedUser && fullyComplete && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-lg font-bold text-green-700 mb-1">משתמש זה השלים את כל ההימורים ✓</p>
            <p className="text-sm text-gray-500">אין שדות חסרים למילוי. לצורך שינוי של ערכים קיימים נדרש עדכון ידני ב-DB.</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedUser && !fullyComplete && (
        <Tabs defaultValue="groups" dir="rtl">
          <TabsList>
            <TabsTrigger value="groups">בתים {completion.groupsCompleted === 12 && "✓"}</TabsTrigger>
            <TabsTrigger value="knockout">נוקאאוט {completion.koFilled === 31 && "✓"}</TabsTrigger>
            <TabsTrigger value="special">מיוחדים {completion.specialOnly === 10 && "✓"}</TabsTrigger>
            <TabsTrigger value="advancement">עולות {completion.advanceOnly === 15 && "✓"}</TabsTrigger>
          </TabsList>

          {/* =============== GROUPS =============== */}
          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">בתים — {selectedUser.name}</CardTitle>
                  <div className="flex gap-1 flex-wrap">
                    {GROUP_LETTERS.map((g) => {
                      const gp = lockedBracket.group_predictions[g];
                      const gpFilled = gp?.scores?.every(isFilledScore) ? "✓" : "";
                      return (
                        <button
                          key={g}
                          onClick={() => setGroupLetter(g)}
                          className={`w-10 h-8 rounded text-sm font-bold ${
                            groupLetter === g ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {g}{gpFilled}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <GroupEditor
                  letter={groupLetter}
                  group={bracket.group_predictions[groupLetter] || emptyGroup()}
                  locked={lockedBracket.group_predictions[groupLetter] || emptyGroup()}
                  onOrderChange={(teamIdx, newPos) => updateGroupOrder(groupLetter, teamIdx, newPos)}
                  onScoreChange={(matchIdx, side, value) =>
                    updateGroupScore(groupLetter, matchIdx, side, value)
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== KNOCKOUT =============== */}
          <TabsContent value="knockout">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">נוקאאוט — {selectedUser.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {KO_STAGES.map((stage) => (
                  <div key={stage.stage}>
                    <p className="text-sm font-bold text-gray-700 mb-2">{stage.label}</p>
                    <div className="space-y-1.5">
                      {stage.keys.map((k) => {
                        const m = bracket.knockout_tree[k] || { score1: null, score2: null, winner: null };
                        const lm = lockedBracket.knockout_tree[k] || { score1: null, score2: null, winner: null };
                        const s1Locked = lm.score1 !== null && lm.score1 !== undefined;
                        const s2Locked = lm.score2 !== null && lm.score2 !== undefined;
                        const wLocked = isFilledStr(lm.winner);
                        return (
                          <div key={k} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                            <span className="text-xs text-gray-500 w-20 shrink-0" style={{ fontFamily: "var(--font-inter)" }}>{k}</span>
                            <Input
                              type="number"
                              min={0}
                              value={m.score1 ?? ""}
                              disabled={s1Locked}
                              onChange={(e) =>
                                updateKnockout(k, {
                                  score1: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              placeholder={s1Locked ? "🔒" : "-"}
                              className={`w-14 text-center font-bold ${s1Locked ? "bg-gray-100" : ""}`}
                              dir="ltr"
                            />
                            <span className="text-gray-300">:</span>
                            <Input
                              type="number"
                              min={0}
                              value={m.score2 ?? ""}
                              disabled={s2Locked}
                              onChange={(e) =>
                                updateKnockout(k, {
                                  score2: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              placeholder={s2Locked ? "🔒" : "-"}
                              className={`w-14 text-center font-bold ${s2Locked ? "bg-gray-100" : ""}`}
                              dir="ltr"
                            />
                            <span className="text-xs text-gray-500 ms-2">מנצח:</span>
                            <TeamSelect
                              value={m.winner || ""}
                              locked={wLocked}
                              onChange={(v) => updateKnockout(k, { winner: v || null })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <span className="text-sm font-bold text-gray-700">אלוף מונדיאל:</span>
                  <TeamSelect
                    value={bracket.champion || ""}
                    locked={isFilledStr(lockedBracket.champion)}
                    onChange={(v) => updateChampion(v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== SPECIAL =============== */}
          <TabsContent value="special">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">הימורים מיוחדים — {selectedUser.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="מלך שערים — שחקן" locked={isFilledStr(lockedSpecial.top_scorer_player)}>
                    <Input
                      value={special.top_scorer_player || ""}
                      onChange={(e) => setSpecialField("top_scorer_player", e.target.value)}
                      disabled={isFilledStr(lockedSpecial.top_scorer_player)}
                      className={isFilledStr(lockedSpecial.top_scorer_player) ? "bg-gray-100" : ""}
                    />
                  </Field>
                  <Field label="מלך שערים — נבחרת" locked={isFilledStr(lockedSpecial.top_scorer_team)}>
                    <TeamSelect
                      value={special.top_scorer_team || ""}
                      locked={isFilledStr(lockedSpecial.top_scorer_team)}
                      onChange={(v) => setSpecialField("top_scorer_team", v)}
                    />
                  </Field>
                  <Field label="מלך בישולים — שחקן" locked={isFilledStr(lockedSpecial.top_assists_player)}>
                    <Input
                      value={special.top_assists_player || ""}
                      onChange={(e) => setSpecialField("top_assists_player", e.target.value)}
                      disabled={isFilledStr(lockedSpecial.top_assists_player)}
                      className={isFilledStr(lockedSpecial.top_assists_player) ? "bg-gray-100" : ""}
                    />
                  </Field>
                  <Field label="מלך בישולים — נבחרת" locked={isFilledStr(lockedSpecial.top_assists_team)}>
                    <TeamSelect
                      value={special.top_assists_team || ""}
                      locked={isFilledStr(lockedSpecial.top_assists_team)}
                      onChange={(v) => setSpecialField("top_assists_team", v)}
                    />
                  </Field>
                  <Field label="התקפה טובה ביותר" locked={isFilledStr(lockedSpecial.best_attack_team)}>
                    <TeamSelect
                      value={special.best_attack_team || ""}
                      locked={isFilledStr(lockedSpecial.best_attack_team)}
                      onChange={(v) => setSpecialField("best_attack_team", v)}
                    />
                  </Field>
                  <Field label="בית פורה" locked={isFilledStr(lockedSpecial.most_prolific_group)}>
                    <GroupSelect
                      value={special.most_prolific_group || ""}
                      locked={isFilledStr(lockedSpecial.most_prolific_group)}
                      onChange={(v) => setSpecialField("most_prolific_group", v)}
                    />
                  </Field>
                  <Field label="בית יבש" locked={isFilledStr(lockedSpecial.driest_group)}>
                    <GroupSelect
                      value={special.driest_group || ""}
                      locked={isFilledStr(lockedSpecial.driest_group)}
                      onChange={(v) => setSpecialField("driest_group", v)}
                    />
                  </Field>
                  <Field label="כסחנית" locked={isFilledStr(lockedSpecial.dirtiest_team)}>
                    <TeamSelect
                      value={special.dirtiest_team || ""}
                      locked={isFilledStr(lockedSpecial.dirtiest_team)}
                      onChange={(v) => setSpecialField("dirtiest_team", v)}
                    />
                  </Field>
                  <Field label="מאצ׳אפים (לדוגמה 1,X,2)" locked={isFilledStr(lockedSpecial.matchup_pick)}>
                    <Input
                      value={special.matchup_pick || ""}
                      onChange={(e) => setSpecialField("matchup_pick", e.target.value)}
                      disabled={isFilledStr(lockedSpecial.matchup_pick)}
                      className={isFilledStr(lockedSpecial.matchup_pick) ? "bg-gray-100" : ""}
                      dir="ltr"
                    />
                  </Field>
                  <Field label="פנדלים OVER/UNDER" locked={isFilledStr(lockedSpecial.penalties_over_under)}>
                    <select
                      className={`rounded-lg border border-gray-300 px-3 py-2 text-sm w-full ${isFilledStr(lockedSpecial.penalties_over_under) ? "bg-gray-100" : "bg-white"}`}
                      value={special.penalties_over_under || ""}
                      disabled={isFilledStr(lockedSpecial.penalties_over_under)}
                      onChange={(e) => setSpecialField("penalties_over_under", e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="OVER">OVER</option>
                      <option value="UNDER">UNDER</option>
                    </select>
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== ADVANCEMENT =============== */}
          <TabsContent value="advancement">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">עולות — {selectedUser.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ArrayEditor
                  label="עולות לרבע גמר (QF) — 8 נבחרות"
                  values={advancement.advance_to_qf}
                  lockedValues={lockedAdv.advance_to_qf}
                  onChange={(i, v) => setAdvArr("advance_to_qf", i, v)}
                />
                <ArrayEditor
                  label="עולות לחצי גמר (SF) — 4 נבחרות"
                  values={advancement.advance_to_sf}
                  lockedValues={lockedAdv.advance_to_sf}
                  onChange={(i, v) => setAdvArr("advance_to_sf", i, v)}
                />
                <ArrayEditor
                  label="עולות לגמר — 2 נבחרות"
                  values={advancement.advance_to_final}
                  lockedValues={lockedAdv.advance_to_final}
                  onChange={(i, v) => setAdvArr("advance_to_final", i, v)}
                />
                <Field label="אלופת העולם" locked={isFilledStr(lockedAdv.winner)}>
                  <TeamSelect
                    value={advancement.winner}
                    locked={isFilledStr(lockedAdv.winner)}
                    onChange={(v) => setAdvWinner(v)}
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={`text-xs font-medium flex items-center gap-1.5 ${locked ? "text-gray-400" : "text-gray-600"}`}>
        {label}
        {locked && <span className="text-[10px] text-gray-400">🔒 נעול</span>}
      </label>
      {children}
    </div>
  );
}

function TeamSelect({
  value,
  onChange,
  locked,
}: {
  value: string;
  onChange: (v: string) => void;
  locked?: boolean;
}) {
  const code = (value || "").toUpperCase();
  return (
    <select
      className={`rounded-lg border border-gray-300 px-3 py-2 text-sm w-full ${
        locked ? "bg-gray-100 text-gray-500" : "bg-white"
      }`}
      value={code}
      disabled={locked}
      onChange={(e) => onChange(e.target.value)}
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

function GroupSelect({
  value,
  onChange,
  locked,
}: {
  value: string;
  onChange: (v: string) => void;
  locked?: boolean;
}) {
  return (
    <select
      className={`rounded-lg border border-gray-300 px-3 py-2 text-sm w-full ${
        locked ? "bg-gray-100 text-gray-500" : "bg-white"
      }`}
      value={value}
      disabled={locked}
      onChange={(e) => onChange(e.target.value)}
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

function ArrayEditor({
  label,
  values,
  lockedValues,
  onChange,
}: {
  label: string;
  values: string[];
  lockedValues: string[];
  onChange: (idx: number, value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-gray-600 font-medium mb-2">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {values.map((v, i) => (
          <TeamSelect
            key={i}
            value={v}
            locked={isFilledStr(lockedValues[i])}
            onChange={(val) => onChange(i, val)}
          />
        ))}
      </div>
    </div>
  );
}

function GroupEditor({
  letter,
  group,
  locked,
  onOrderChange,
  onScoreChange,
}: {
  letter: string;
  group: GroupState;
  locked: GroupState;
  onOrderChange: (teamIdx: number, newPos: number) => void;
  onScoreChange: (matchIdx: number, side: "home" | "away", value: string) => void;
}) {
  const teams = GROUPS[letter] || [];
  // Order locked if ANY score already filled
  const orderLocked = locked.scores?.some(isFilledScore) ?? false;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-600 font-medium mb-2 flex items-center gap-1.5">
          סדר סופי (1 = ראשון, 4 = אחרון)
          {orderLocked && <span className="text-[10px] text-gray-400">🔒 נעול</span>}
        </p>
        <div className="space-y-1.5">
          {teams.map((team, teamIdx) => {
            const pos = group.order.indexOf(teamIdx);
            return (
              <div key={team.code} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-xl">{getFlag(team.code)}</span>
                <span className="flex-1 text-sm font-medium">{team.name_he}</span>
                <span className="text-xs text-gray-400" dir="ltr">{team.code}</span>
                <select
                  className={`rounded-lg border border-gray-300 px-2 py-1 text-sm ${orderLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`}
                  value={pos >= 0 ? pos + 1 : 1}
                  disabled={orderLocked}
                  onChange={(e) => onOrderChange(teamIdx, parseInt(e.target.value) - 1)}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-600 font-medium mb-2">תוצאות המשחקים (6 משחקים)</p>
        <div className="space-y-1.5">
          {GROUP_MATCH_PAIRS.map(([i, j], matchIdx) => {
            const th = teams[i];
            const ta = teams[j];
            const s = group.scores[matchIdx] || { home: null, away: null };
            const ls = locked.scores[matchIdx] || { home: null, away: null };
            const homeLocked = ls.home !== null && ls.home !== undefined;
            const awayLocked = ls.away !== null && ls.away !== undefined;
            return (
              <div key={matchIdx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-gray-200">
                <span className="flex-1 text-end text-sm font-medium">
                  {getFlag(th?.code || "")} {th?.name_he || "?"}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={s.home ?? ""}
                  disabled={homeLocked}
                  onChange={(e) => onScoreChange(matchIdx, "home", e.target.value)}
                  placeholder={homeLocked ? "🔒" : "-"}
                  className={`w-14 text-center font-bold ${homeLocked ? "bg-gray-100" : ""}`}
                  dir="ltr"
                />
                <span className="text-gray-300">:</span>
                <Input
                  type="number"
                  min={0}
                  value={s.away ?? ""}
                  disabled={awayLocked}
                  onChange={(e) => onScoreChange(matchIdx, "away", e.target.value)}
                  placeholder={awayLocked ? "🔒" : "-"}
                  className={`w-14 text-center font-bold ${awayLocked ? "bg-gray-100" : ""}`}
                  dir="ltr"
                />
                <span className="flex-1 text-sm font-medium">
                  {ta?.name_he || "?"} {getFlag(ta?.code || "")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
