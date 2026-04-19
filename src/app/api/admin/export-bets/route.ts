import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Missing config" });

  const supabase = createClient(url, serviceKey);

  // Load all data in parallel
  const [
    { data: profiles },
    { data: brackets },
    { data: specials },
    { data: advancements },
    { data: authData },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("user_brackets").select("user_id, group_predictions, knockout_tree, champion"),
    supabase.from("special_bets").select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under"),
    supabase.from("advancement_picks").select("user_id, group_qualifiers, advance_to_qf, advance_to_sf, advance_to_final, winner"),
    supabase.auth.admin.listUsers(),
  ]);

  const emailMap: Record<string, string> = {};
  for (const u of authData?.users || []) {
    emailMap[u.id] = u.email || "";
  }

  // Build CSV
  const lines: string[] = [];
  lines.push("user_name,email,category,item,value");

  for (const profile of profiles || []) {
    const name = (profile.display_name || "ללא שם").replace(/,/g, " ");
    const email = emailMap[profile.id] || "";
    const b = brackets?.find(br => br.user_id === profile.id);
    const sb = specials?.find(s => s.user_id === profile.id);
    const adv = advancements?.find(a => a.user_id === profile.id);

    // Group predictions
    if (b?.group_predictions) {
      const gp = b.group_predictions as Record<string, { scores: { home: number | null; away: number | null }[] }>;
      for (const letter of GROUP_LETTERS) {
        const group = gp[letter];
        if (group?.scores) {
          group.scores.forEach((s: { home: number | null; away: number | null }, i: number) => {
            if (s.home !== null && s.away !== null) {
              lines.push(`${name},${email},groups,group_${letter}_match_${i + 1},${s.home}-${s.away}`);
            }
          });
        }
      }
    }

    // Knockout predictions
    if (b?.knockout_tree) {
      const ko = b.knockout_tree as Record<string, { winner: string | null; score1?: number | null; score2?: number | null }>;
      for (const [matchKey, match] of Object.entries(ko)) {
        if (match?.winner) {
          const score = (match.score1 != null && match.score2 != null) ? ` (${match.score1}-${match.score2})` : "";
          lines.push(`${name},${email},knockout,${matchKey},${match.winner}${score}`);
        }
      }
    }

    // Special bets
    if (sb) {
      if (sb.top_scorer_player) lines.push(`${name},${email},special,top_scorer,${sb.top_scorer_player}`);
      if (sb.top_assists_player) lines.push(`${name},${email},special,top_assists,${sb.top_assists_player}`);
      if (sb.best_attack_team) lines.push(`${name},${email},special,best_attack,${sb.best_attack_team}`);
      if (sb.most_prolific_group) lines.push(`${name},${email},special,prolific_group,${sb.most_prolific_group}`);
      if (sb.driest_group) lines.push(`${name},${email},special,driest_group,${sb.driest_group}`);
      if (sb.dirtiest_team) lines.push(`${name},${email},special,dirtiest_team,${sb.dirtiest_team}`);
      if (sb.matchup_pick) {
        const matchups = sb.matchup_pick.split(",");
        matchups.forEach((pick: string, i: number) => {
          if (pick) lines.push(`${name},${email},special,matchup_${i + 1},${pick}`);
        });
      }
      if (sb.penalties_over_under) lines.push(`${name},${email},special,penalties_over_under,${sb.penalties_over_under}`);
    }

    // Advancement picks
    if (adv) {
      // Group qualifiers
      const gq = (adv.group_qualifiers || {}) as Record<string, string[]>;
      for (const [groupId, teams] of Object.entries(gq)) {
        if (teams?.length) {
          lines.push(`${name},${email},advancement,group_${groupId}_qualifiers,${teams.join(" > ")}`);
        }
      }
      // QF / SF / Final / Winner
      const qf = (adv.advance_to_qf as string[]) || [];
      if (qf.length) lines.push(`${name},${email},advancement,advance_to_qf,${qf.join(" | ")}`);
      const sf = (adv.advance_to_sf as string[]) || [];
      if (sf.length) lines.push(`${name},${email},advancement,advance_to_sf,${sf.join(" | ")}`);
      const fin = (adv.advance_to_final as string[]) || [];
      if (fin.length) lines.push(`${name},${email},advancement,advance_to_final,${fin.join(" | ")}`);
      if (adv.winner) lines.push(`${name},${email},advancement,winner,${adv.winner}`);
    }

    // Champion from bracket (same as advancement winner but kept for completeness)
    if (b?.champion) lines.push(`${name},${email},advancement,champion,${b.champion}`);
  }

  const csv = "\uFEFF" + lines.join("\n"); // BOM for Hebrew in Excel
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wc2026-all-bets-${date}.csv"`,
    },
  });
}
