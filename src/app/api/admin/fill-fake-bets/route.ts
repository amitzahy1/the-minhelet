import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { generateFakePrediction, seedFromString } from "@/lib/fake-bet-generator";

/**
 * POST /api/admin/fill-fake-bets
 *
 * Fills plausible fake bets for every registered user who currently has
 * NO bets (no user_brackets row yet). Per-user seed is derived from the
 * user id so the same user always gets the same picks. Does NOT touch
 * users who already have bets.
 *
 * Useful for the demo to preview the UI with ~15 bettors instead of 3.
 */

const BOT_EMAIL = "bot@wc2026.local";

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

async function resolveLeagueId(supabase: SupabaseClient): Promise<string | null> {
  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .limit(1)
    .maybeSingle();
  return league?.id ?? null;
}

export async function POST(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  // Optional query: ?overwrite=true to overwrite existing bets. Default: only fill empties.
  const { searchParams } = new URL(request.url);
  const overwrite = searchParams.get("overwrite") === "true";

  const leagueId = await resolveLeagueId(supabase);
  if (!leagueId) return NextResponse.json({ error: "No league" }, { status: 404 });

  // All profiles
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name");
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Existing brackets (so we know who already has bets)
  const { data: brackets } = await supabase
    .from("user_brackets")
    .select("user_id")
    .eq("league_id", leagueId);
  const existingUserIds = new Set((brackets || []).map((b) => b.user_id));

  // Exclude the bot — it has its own generator + button
  const { data: authData } = await supabase.auth.admin.listUsers();
  const botId = (authData?.users || []).find((u) => u.email === BOT_EMAIL)?.id;

  const candidates = (profiles || []).filter((p) => {
    if (!p.id) return false;
    if (p.id === botId) return false;
    if (!overwrite && existingUserIds.has(p.id)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      success: true,
      filled: 0,
      message: overwrite ? "לא נמצאו משתמשים" : "לכל המשתמשים יש כבר הימורים",
    });
  }

  const now = new Date().toISOString();
  let filledBrackets = 0;
  let filledAdvancement = 0;
  let filledSpecials = 0;
  const errors: string[] = [];

  for (const profile of candidates) {
    // Ensure league membership
    await supabase
      .from("league_members")
      .upsert({ league_id: leagueId, user_id: profile.id }, { onConflict: "league_id,user_id" });

    const seed = seedFromString(profile.id);
    const pred = generateFakePrediction(seed);

    // user_brackets
    const { error: bErr } = await supabase.from("user_brackets").upsert(
      {
        user_id: profile.id,
        league_id: leagueId,
        group_predictions: pred.group_predictions,
        third_place_qualifiers: pred.third_place_qualifiers,
        knockout_tree: pred.knockout_tree,
        champion: pred.champion,
        updated_at: now,
      },
      { onConflict: "user_id,league_id" }
    );
    if (bErr) { errors.push(`brackets ${profile.display_name}: ${bErr.message}`); continue; }
    filledBrackets++;

    // advancement_picks
    const { error: aErr } = await supabase.from("advancement_picks").upsert(
      {
        user_id: profile.id,
        league_id: leagueId,
        group_qualifiers: pred.advancement.group_qualifiers,
        advance_to_qf: pred.advancement.advance_to_qf,
        advance_to_sf: pred.advancement.advance_to_sf,
        advance_to_final: pred.advancement.advance_to_final,
        winner: pred.advancement.winner,
      },
      { onConflict: "user_id,league_id" }
    );
    if (aErr) errors.push(`advancement ${profile.display_name}: ${aErr.message}`);
    else filledAdvancement++;

    // special_bets (omit the aux top_scorer_team / top_assists_team cols)
    const { error: sErr } = await supabase.from("special_bets").upsert(
      {
        user_id: profile.id,
        league_id: leagueId,
        top_scorer_player: pred.special.top_scorer_player,
        top_assists_player: pred.special.top_assists_player,
        best_attack_team: pred.special.best_attack_team,
        most_prolific_group: pred.special.most_prolific_group,
        driest_group: pred.special.driest_group,
        dirtiest_team: pred.special.dirtiest_team,
        matchup_pick: pred.special.matchup_pick,
        penalties_over_under: pred.special.penalties_over_under,
      },
      { onConflict: "user_id,league_id" }
    );
    if (sErr) errors.push(`specials ${profile.display_name}: ${sErr.message}`);
    else filledSpecials++;

    // audit
    await supabase.from("admin_audit_log").insert({
      admin_email: adminEmail,
      target_user_id: profile.id,
      table_name: "user_brackets",
      field_name: "fake_fill",
      old_value: null,
      new_value: { seed, champion: pred.champion },
      note: `Fake bets auto-generated by ${adminEmail}${overwrite ? " (overwrite)" : ""}`,
    });
  }

  // silence unused-var lint
  void request;

  return NextResponse.json({
    success: errors.length === 0,
    filled: filledBrackets,
    filledAdvancement,
    filledSpecials,
    totalCandidates: candidates.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
