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

  // Load ALL profiles so every registered user appears (even without bets)
  const { data: allProfiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name");

  if (pErr) {
    return NextResponse.json({ users: [], error: `profiles: ${pErr.message}` });
  }

  // Load all brackets (service role bypasses RLS)
  const { data: brackets } = await supabase
    .from("user_brackets")
    .select("user_id, league_id, group_predictions, knockout_tree, champion");

  // Load all special bets
  const { data: specials } = await supabase
    .from("special_bets")
    .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under");

  // Load all advancement picks
  const { data: advancements } = await supabase
    .from("advancement_picks")
    .select("user_id, group_qualifiers, advance_to_qf, advance_to_sf, advance_to_final, winner");

  // Load user emails
  const { data: authData } = await supabase.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users || []) {
    emailMap[u.id] = u.email || "";
  }

  const results = [];

  for (const profile of allProfiles || []) {
    const name = profile.display_name || "ללא שם";
    const email = emailMap[profile.id] || "";

    // Find this user's data
    const b = brackets?.find(br => br.user_id === profile.id);
    const sb = specials?.find(s => s.user_id === profile.id);
    const adv = advancements?.find(a => a.user_id === profile.id);

    // Count completed groups (6 scores each)
    let completedGroups = 0;
    if (b) {
      const gp = (b.group_predictions || {}) as Record<string, { scores: { home: number | null; away: number | null }[] }>;
      for (const letter of GROUP_LETTERS) {
        const group = gp[letter];
        if (group?.scores) {
          const filled = group.scores.filter((s: { home: number | null; away: number | null }) => s.home !== null && s.away !== null).length;
          if (filled === 6) completedGroups++;
        }
      }
    }

    // Count knockout matches with winner
    let knockoutFilled = 0;
    if (b) {
      const ko = (b.knockout_tree || {}) as Record<string, { winner: string | null }>;
      knockoutFilled = Object.values(ko).filter(m => m?.winner).length;
    }

    // Count filled special bets + advancement picks (total expected: 25)
    // special_bets: 7 fields + matchup_pick split into 3 + penalties = 10
    // advancement_picks: advanceToQF(8) + advanceToSF(4) + advanceToFinal(2) + winner(1) = 15
    let specialsFilled = 0;
    if (sb) {
      if (sb.top_scorer_player) specialsFilled++;
      if (sb.top_assists_player) specialsFilled++;
      if (sb.best_attack_team) specialsFilled++;
      if (sb.most_prolific_group) specialsFilled++;
      if (sb.driest_group) specialsFilled++;
      if (sb.dirtiest_team) specialsFilled++;
      if (sb.matchup_pick) {
        specialsFilled += sb.matchup_pick.split(",").filter(Boolean).length; // up to 3
      }
      if (sb.penalties_over_under) specialsFilled++;
    }
    if (adv) {
      specialsFilled += ((adv.advance_to_qf as string[]) || []).filter(Boolean).length;   // up to 8
      specialsFilled += ((adv.advance_to_sf as string[]) || []).filter(Boolean).length;    // up to 4
      specialsFilled += ((adv.advance_to_final as string[]) || []).filter(Boolean).length; // up to 2
      if (adv.winner) specialsFilled++; // 1
    }

    const totalItems = 12 + 31 + 25;
    const filledItems = completedGroups + knockoutFilled + specialsFilled;
    const totalPct = Math.round((filledItems / totalItems) * 100);

    results.push({ name, email, groups: completedGroups, knockout: knockoutFilled, specials: specialsFilled, totalPct });
  }

  results.sort((a, b) => a.totalPct - b.totalPct);
  return NextResponse.json({ users: results });
}
