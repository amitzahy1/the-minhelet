import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ users: [], error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ users: [], error: "Missing config" });

  const supabase = createClient(url, serviceKey);

  // Load all brackets (service role bypasses RLS)
  const { data: brackets } = await supabase
    .from("user_brackets")
    .select("user_id, group_predictions, knockout_tree, champion, profiles(display_name)")
    .eq("league_id", "default");

  // Load all special bets
  const { data: specials } = await supabase
    .from("special_bets")
    .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under")
    .eq("league_id", "default");

  // Load user emails
  const { data: authData } = await supabase.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users || []) {
    emailMap[u.id] = u.email || "";
  }

  const results = [];

  for (const b of brackets || []) {
    const profile = b.profiles as unknown as { display_name: string } | null;
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
    }
    if (b.champion) specialsFilled++;

    const totalItems = 12 + 31 + 25;
    const filledItems = completedGroups + knockoutFilled + specialsFilled;
    const totalPct = Math.round((filledItems / totalItems) * 100);

    results.push({ name, email, groups: completedGroups, knockout: knockoutFilled, specials: specialsFilled, totalPct });
  }

  results.sort((a, b) => a.totalPct - b.totalPct);
  return NextResponse.json({ users: results });
}
