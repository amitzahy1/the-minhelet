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
// Types mirroring the DB / zustand store
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

// Knockout slot layout — the keys used by the zustand store
const KO_STAGES: Array<{ stage: string; label: string; keys: string[] }> = [
  {
    stage: "r32",
    label: "שמינית (R32)",
    keys: [
      "r32l_0", "r32l_1", "r32l_2", "r32l_3", "r32l_4", "r32l_5", "r32l_6", "r32l_7",
      "r32r_0", "r32r_1", "r32r_2", "r32r_3", "r32r_4", "r32r_5", "r32r_6", "r32r_7",
    ],
  },
  {
    stage: "r16",
    label: "רבע (R16)",
    keys: ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3"],
  },
  {
    stage: "qf",
    label: "רבע גמר (QF)",
    keys: ["qfl_0", "qfl_1", "qfr_0", "qfr_1"],
  },
  {
    stage: "sf",
    label: "חצי גמר (SF)",
    keys: ["sfl_0", "sfr_0"],
  },
  {
    stage: "final",
    label: "גמר",
    keys: ["final"],
  },
];

const ALL_TEAM_CODES = ALL_TEAMS.map((t) => t.code).sort();

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
  return {
    group_predictions,
    third_place_qualifiers: [],
    knockout_tree: {},
    champion: null,
  };
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

// ---------------------------------------------------------------------------

export function UserBetsEditor() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");

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
      const b: BracketRow = emptyBracket();
      if (data.bracket) {
        b.group_predictions = { ...b.group_predictions, ...(data.bracket.group_predictions || {}) };
        for (const g of GROUP_LETTERS) {
          if (!b.group_predictions[g]) b.group_predictions[g] = emptyGroup();
          if (!Array.isArray(b.group_predictions[g].scores) || b.group_predictions[g].scores.length !== 6) {
            b.group_predictions[g].scores = emptyGroup().scores;
          }
        }
        b.third_place_qualifiers = data.bracket.third_place_qualifiers || [];
        b.knockout_tree = data.bracket.knockout_tree || {};
        b.champion = data.bracket.champion ?? null;
      }
      setBracket(b);

      // Advancement
      const a: AdvancementRow = emptyAdvancement();
      if (data.advancement) {
        a.group_qualifiers = data.advancement.group_qualifiers || {};
        a.advance_to_qf = padArr(data.advancement.advance_to_qf, 8);
        a.advance_to_sf = padArr(data.advancement.advance_to_sf, 4);
        a.advance_to_final = padArr(data.advancement.advance_to_final, 2);
        a.winner = data.advancement.winner || "";
      }
      setAdvancement(a);

      // Special
      const s: SpecialRow = emptySpecial();
      if (data.special) {
        for (const k of Object.keys(emptySpecial()) as (keyof SpecialRow)[]) {
          s[k] = data.special[k] ?? "";
        }
      }
      setSpecial(s);

      setDirty({ bracket: false, advancement: false, special: false });
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setLoading(false);
  }

  function padArr(arr: unknown, n: number): string[] {
    const a = Array.isArray(arr) ? (arr as string[]) : [];
    return Array.from({ length: n }, (_, i) => a[i] ?? "");
  }

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
        group_qualifiers: advancement.group_qualifiers,
        advance_to_qf: advancement.advance_to_qf.filter(Boolean),
        advance_to_sf: advancement.advance_to_sf.filter(Boolean),
        advance_to_final: advancement.advance_to_final.filter(Boolean),
        winner: advancement.winner,
      };
    }
    if (dirty.special) {
      body.special = {
        ...special,
        // empty strings → null so the DB stays clean
        ...Object.fromEntries(
          Object.entries(special).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
        ),
      };
    }

    try {
      const res = await fetch("/api/admin/user-bets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage(
          "שגיאה: " + (data.errors?.join(" | ") || data.error || res.statusText)
        );
      } else {
        const c = data.changes || {};
        setMessage(
          `נשמר ✓ (בתים: ${c.bracket}, עולות: ${c.advancement}, מיוחדים: ${c.special})`
        );
        setDirty({ bracket: false, advancement: false, special: false });
      }
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 5000);
  }

  // ------- Bracket mutators ------------------------------------------------
  function updateGroupOrder(letter: string, teamIdx: number, newPos: number) {
    setBracket((prev) => {
      const group = prev.group_predictions[letter] ?? emptyGroup();
      const order = [...group.order];
      // Swap: find current position of teamIdx
      const currentPos = order.indexOf(teamIdx);
      if (currentPos === -1 || currentPos === newPos) return prev;
      const other = order[newPos];
      order[newPos] = teamIdx;
      order[currentPos] = other;
      return {
        ...prev,
        group_predictions: {
          ...prev.group_predictions,
          [letter]: { ...group, order },
        },
      };
    });
    setDirty((d) => ({ ...d, bracket: true }));
  }

  function updateGroupScore(
    letter: string,
    matchIdx: number,
    side: "home" | "away",
    value: string
  ) {
    const v = value === "" ? null : Math.max(0, parseInt(value) || 0);
    setBracket((prev) => {
      const group = prev.group_predictions[letter] ?? emptyGroup();
      const scores = group.scores.map((s, i) => (i === matchIdx ? { ...s, [side]: v } : s));
      return {
        ...prev,
        group_predictions: {
          ...prev.group_predictions,
          [letter]: { ...group, scores },
        },
      };
    });
    setDirty((d) => ({ ...d, bracket: true }));
  }

  function updateKnockout(key: string, patch: Partial<KnockoutMatchState>) {
    setBracket((prev) => {
      const existing = prev.knockout_tree[key] || { score1: null, score2: null, winner: null };
      return {
        ...prev,
        knockout_tree: { ...prev.knockout_tree, [key]: { ...existing, ...patch } },
      };
    });
    setDirty((d) => ({ ...d, bracket: true }));
  }

  function updateChampion(code: string) {
    setBracket((prev) => ({ ...prev, champion: code || null }));
    setDirty((d) => ({ ...d, bracket: true }));
  }

  // ------- Advancement mutators -------------------------------------------
  function setAdvArr(key: "advance_to_qf" | "advance_to_sf" | "advance_to_final", idx: number, value: string) {
    setAdvancement((prev) => {
      const arr = [...prev[key]];
      arr[idx] = value;
      return { ...prev, [key]: arr };
    });
    setDirty((d) => ({ ...d, advancement: true }));
  }

  function setAdvWinner(v: string) {
    setAdvancement((prev) => ({ ...prev, winner: v }));
    setDirty((d) => ({ ...d, advancement: true }));
  }

  // ------- Special mutator ------------------------------------------------
  function setSpecialField<K extends keyof SpecialRow>(k: K, v: string) {
    setSpecial((prev) => ({ ...prev, [k]: v }));
    setDirty((d) => ({ ...d, special: true }));
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
          <CardTitle className="text-base">עריכת הימורי משתמש (גובר על נעילה)</CardTitle>
        </CardHeader>
        <CardContent>
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

            <Button onClick={save} disabled={!anyDirty || saving}>
              {saving ? "שומר..." : "שמור שינויים"}
            </Button>

            {selectedUserId && !loading && (
              <Button variant="outline" size="sm" onClick={() => loadUserBets(selectedUserId)}>
                טען מחדש
              </Button>
            )}

            <div className="ms-auto flex items-center gap-1.5 text-xs text-gray-500">
              {dirty.bracket && <Badge variant="outline" className="text-amber-700 border-amber-300">בתים/נוקאאוט</Badge>}
              {dirty.advancement && <Badge variant="outline" className="text-amber-700 border-amber-300">עולות</Badge>}
              {dirty.special && <Badge variant="outline" className="text-amber-700 border-amber-300">מיוחדים</Badge>}
            </div>
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

      {loading && (
        <p className="text-center text-gray-400 py-6">טוען הימורים...</p>
      )}

      {!loading && selectedUser && (
        <Tabs defaultValue="groups" dir="rtl">
          <TabsList>
            <TabsTrigger value="groups">בתים</TabsTrigger>
            <TabsTrigger value="knockout">נוקאאוט</TabsTrigger>
            <TabsTrigger value="special">מיוחדים</TabsTrigger>
            <TabsTrigger value="advancement">עולות</TabsTrigger>
          </TabsList>

          {/* =============== GROUPS =============== */}
          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">
                    בתים — {selectedUser.name}
                  </CardTitle>
                  <div className="flex gap-1 flex-wrap">
                    {GROUP_LETTERS.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGroupLetter(g)}
                        className={`w-8 h-8 rounded text-sm font-bold ${
                          groupLetter === g
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <GroupEditor
                  letter={groupLetter}
                  group={bracket.group_predictions[groupLetter] || emptyGroup()}
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
                        const m = bracket.knockout_tree[k] || {
                          score1: null,
                          score2: null,
                          winner: null,
                        };
                        return (
                          <div
                            key={k}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200"
                          >
                            <span
                              className="text-xs text-gray-500 w-20 shrink-0"
                              style={{ fontFamily: "var(--font-inter)" }}
                            >
                              {k}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              value={m.score1 ?? ""}
                              onChange={(e) =>
                                updateKnockout(k, {
                                  score1:
                                    e.target.value === ""
                                      ? null
                                      : Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              placeholder="-"
                              className="w-14 text-center font-bold"
                              dir="ltr"
                            />
                            <span className="text-gray-300">:</span>
                            <Input
                              type="number"
                              min={0}
                              value={m.score2 ?? ""}
                              onChange={(e) =>
                                updateKnockout(k, {
                                  score2:
                                    e.target.value === ""
                                      ? null
                                      : Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              placeholder="-"
                              className="w-14 text-center font-bold"
                              dir="ltr"
                            />
                            <span className="text-xs text-gray-500 ms-2">מנצח:</span>
                            <TeamCodeInput
                              value={m.winner || ""}
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
                  <TeamCodeInput
                    value={bracket.champion || ""}
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
                  <Field label="מלך שערים — שחקן">
                    <Input
                      value={special.top_scorer_player || ""}
                      onChange={(e) => setSpecialField("top_scorer_player", e.target.value)}
                    />
                  </Field>
                  <Field label="מלך שערים — נבחרת">
                    <TeamCodeInput
                      value={special.top_scorer_team || ""}
                      onChange={(v) => setSpecialField("top_scorer_team", v)}
                    />
                  </Field>
                  <Field label="מלך בישולים — שחקן">
                    <Input
                      value={special.top_assists_player || ""}
                      onChange={(e) => setSpecialField("top_assists_player", e.target.value)}
                    />
                  </Field>
                  <Field label="מלך בישולים — נבחרת">
                    <TeamCodeInput
                      value={special.top_assists_team || ""}
                      onChange={(v) => setSpecialField("top_assists_team", v)}
                    />
                  </Field>
                  <Field label="התקפה טובה ביותר">
                    <TeamCodeInput
                      value={special.best_attack_team || ""}
                      onChange={(v) => setSpecialField("best_attack_team", v)}
                    />
                  </Field>
                  <Field label="בית פורה">
                    <GroupInput
                      value={special.most_prolific_group || ""}
                      onChange={(v) => setSpecialField("most_prolific_group", v)}
                    />
                  </Field>
                  <Field label="בית יבש">
                    <GroupInput
                      value={special.driest_group || ""}
                      onChange={(v) => setSpecialField("driest_group", v)}
                    />
                  </Field>
                  <Field label="כסחנית">
                    <TeamCodeInput
                      value={special.dirtiest_team || ""}
                      onChange={(v) => setSpecialField("dirtiest_team", v)}
                    />
                  </Field>
                  <Field label="מאצ׳אפים (פסיקים, למשל: 1,X,2)">
                    <Input
                      value={special.matchup_pick || ""}
                      onChange={(e) => setSpecialField("matchup_pick", e.target.value)}
                      dir="ltr"
                    />
                  </Field>
                  <Field label="פנדלים OVER/UNDER">
                    <select
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white w-full"
                      value={special.penalties_over_under || ""}
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
                  onChange={(i, v) => setAdvArr("advance_to_qf", i, v)}
                />
                <ArrayEditor
                  label="עולות לחצי גמר (SF) — 4 נבחרות"
                  values={advancement.advance_to_sf}
                  onChange={(i, v) => setAdvArr("advance_to_sf", i, v)}
                />
                <ArrayEditor
                  label="עולות לגמר — 2 נבחרות"
                  values={advancement.advance_to_final}
                  onChange={(i, v) => setAdvArr("advance_to_final", i, v)}
                />
                <Field label="אלופת העולם">
                  <TeamCodeInput value={advancement.winner} onChange={(v) => setAdvWinner(v)} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-600 font-medium">{label}</label>
      {children}
    </div>
  );
}

function TeamCodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const code = value.toUpperCase();
  const team = ALL_TEAMS.find((t) => t.code === code);
  return (
    <div className="flex items-center gap-2 w-full">
      <Input
        list="wc-team-codes"
        value={code}
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 3))}
        placeholder="TLA"
        className="w-24 text-center font-bold uppercase"
        dir="ltr"
      />
      {team && (
        <span className="text-sm text-gray-600">
          {getFlag(team.code)} {team.name_he}
        </span>
      )}
      <datalist id="wc-team-codes">
        {ALL_TEAM_CODES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}

function GroupInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white w-full"
      value={value}
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
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (idx: number, value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-gray-600 font-medium mb-2">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {values.map((v, i) => (
          <TeamCodeInput key={i} value={v} onChange={(val) => onChange(i, val)} />
        ))}
      </div>
    </div>
  );
}

function GroupEditor({
  letter,
  group,
  onOrderChange,
  onScoreChange,
}: {
  letter: string;
  group: GroupState;
  onOrderChange: (teamIdx: number, newPos: number) => void;
  onScoreChange: (matchIdx: number, side: "home" | "away", value: string) => void;
}) {
  const teams = GROUPS[letter] || [];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-600 font-medium mb-2">סדר סופי (1 = ראשון, 4 = אחרון)</p>
        <div className="space-y-1.5">
          {teams.map((team, teamIdx) => {
            const pos = group.order.indexOf(teamIdx);
            return (
              <div
                key={team.code}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200"
              >
                <span className="text-xl">{getFlag(team.code)}</span>
                <span className="flex-1 text-sm font-medium">{team.name_he}</span>
                <span className="text-xs text-gray-400" dir="ltr">{team.code}</span>
                <select
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white"
                  value={pos >= 0 ? pos + 1 : 1}
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
            return (
              <div
                key={matchIdx}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-gray-200"
              >
                <span className="flex-1 text-end text-sm font-medium">
                  {getFlag(th?.code || "")} {th?.name_he || "?"}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={s.home ?? ""}
                  onChange={(e) => onScoreChange(matchIdx, "home", e.target.value)}
                  placeholder="-"
                  className="w-14 text-center font-bold"
                  dir="ltr"
                />
                <span className="text-gray-300">:</span>
                <Input
                  type="number"
                  min={0}
                  value={s.away ?? ""}
                  onChange={(e) => onScoreChange(matchIdx, "away", e.target.value)}
                  placeholder="-"
                  className="w-14 text-center font-bold"
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
