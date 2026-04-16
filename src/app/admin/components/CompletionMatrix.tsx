"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserCompletion {
  name: string;
  email: string;
  groups: number;       // 0-12 completed groups
  knockout: number;     // 0-31 matches with winner
  specials: number;     // count of filled special bet fields
  totalPct: number;     // 0-100% overall completion
}

const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

export function CompletionMatrix() {
  const [users, setUsers] = useState<UserCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompletion();
  }, []);

  async function loadCompletion() {
    const supabase = createClient();

    // Load all brackets
    const { data: brackets } = await supabase
      .from("user_brackets")
      .select("user_id, group_predictions, knockout_tree, champion, profiles(display_name, id)")
      .eq("league_id", "default");

    // Load all special bets
    const { data: specials } = await supabase
      .from("special_bets")
      .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under")
      .eq("league_id", "default");

    // Load user emails from admin API
    let emailMap: Record<string, string> = {};
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        for (const u of data.users) {
          emailMap[u.id] = u.email || "";
        }
      }
    } catch { /* ignore */ }

    const results: UserCompletion[] = [];

    for (const b of brackets || []) {
      const profile = b.profiles as unknown as { display_name: string; id: string } | null;
      const name = profile?.display_name || "ללא שם";
      const email = emailMap[b.user_id] || "";

      // Count completed groups (6 scores each)
      const gp = (b.group_predictions || {}) as Record<string, { scores: { home: number | null; away: number | null }[] }>;
      let completedGroups = 0;
      for (const letter of GROUP_LETTERS) {
        const group = gp[letter];
        if (group?.scores) {
          const filled = group.scores.filter((s: { home: number | null; away: number | null }) => s.home !== null && s.away !== null).length;
          if (filled === 6) completedGroups++;
        }
      }

      // Count knockout matches with winner
      const ko = (b.knockout_tree || {}) as Record<string, { winner: string | null }>;
      const knockoutFilled = Object.values(ko).filter(m => m?.winner).length;

      // Count filled special bets
      const sb = specials?.find(s => s.user_id === b.user_id);
      let specialsFilled = 0;
      if (sb) {
        const fields = [sb.top_scorer_player, sb.top_assists_player, sb.best_attack_team,
          sb.most_prolific_group, sb.driest_group, sb.dirtiest_team, sb.matchup_pick, sb.penalties_over_under];
        specialsFilled = fields.filter(Boolean).length;
        // Champion comes from bracket, count it if present
        if (b.champion) specialsFilled++;
      }

      const totalItems = 12 + 31 + 25; // groups + knockout + specials
      const filledItems = completedGroups + knockoutFilled + specialsFilled;
      const totalPct = Math.round((filledItems / totalItems) * 100);

      results.push({ name, email, groups: completedGroups, knockout: knockoutFilled, specials: specialsFilled, totalPct });
    }

    // Sort: lowest completion first (who needs reminding)
    results.sort((a, b) => a.totalPct - b.totalPct);
    setUsers(results);
    setLoading(false);
  }

  const check = (done: boolean) => (
    <span className={`text-base font-bold ${done ? "text-green-600" : "text-red-400"}`}>
      {done ? "✓" : "✗"}
    </span>
  );

  const pctColor = (pct: number) =>
    pct === 100 ? "text-green-700 bg-green-100" :
    pct >= 50 ? "text-amber-700 bg-amber-100" :
    "text-red-700 bg-red-100";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">מטריצת השלמה</h3>
        <p className="text-sm text-gray-500">מי מילא מה — סטטוס לכל מהמר</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-6">טוען נתונים...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-center py-6">אין נתונים עדיין — אף אחד לא התחיל למלא</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-bold">
                <th className="py-3 px-3 text-start sticky right-0 bg-gray-50 z-10">שם</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">בתים<br/><span className="text-gray-400 font-normal">/12</span></th>
                <th className="py-3 px-2 text-center whitespace-nowrap">נוקאאוט<br/><span className="text-gray-400 font-normal">/31</span></th>
                <th className="py-3 px-2 text-center whitespace-nowrap">מיוחדים<br/><span className="text-gray-400 font-normal">/25</span></th>
                <th className="py-3 px-3 text-center">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-3 sticky right-0 bg-white z-10">
                    <p className="font-bold text-gray-900">{u.name}</p>
                    {u.email && <p className="text-[11px] text-gray-400" dir="ltr">{u.email}</p>}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {check(u.groups === 12)}
                      {u.groups < 12 && <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{u.groups}/12</span>}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {check(u.knockout === 31)}
                      {u.knockout < 31 && <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{u.knockout}/31</span>}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {check(u.specials >= 25)}
                      {u.specials < 25 && <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{u.specials}/25</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${pctColor(u.totalPct)}`} style={{ fontFamily: "var(--font-inter)" }}>
                      {u.totalPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
