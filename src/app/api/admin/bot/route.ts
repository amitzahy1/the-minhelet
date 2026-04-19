import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { generateBotPrediction } from "@/lib/bot-predictions";

/**
 * /api/admin/bot
 *
 * GET  → status of the bot user (exists? has bets?)
 * POST → create bot (if missing), regenerate all predictions, save to DB.
 *        Overwrites existing bot bets (bot is a synthetic account we own).
 */

const BOT_EMAIL = "bot@wc2026.local";
const BOT_DISPLAY_NAME = "🤖 בוט";

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

async function findOrCreateBotUser(supabase: SupabaseClient): Promise<{ id: string; created: boolean } | null> {
  // First: look up by email
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const found = existingUsers?.users?.find((u) => u.email === BOT_EMAIL);
  if (found) {
    // Make sure profile exists and has correct display_name
    await supabase
      .from("profiles")
      .upsert(
        { id: found.id, display_name: BOT_DISPLAY_NAME },
        { onConflict: "id" }
      );
    return { id: found.id, created: false };
  }

  // Create new auth user
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: BOT_EMAIL,
    password: `bot-${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { full_name: BOT_DISPLAY_NAME },
  });
  if (error || !created.user) {
    console.error("Failed to create bot user:", error);
    return null;
  }

  // Profile is auto-created via trigger, but ensure display_name is correct
  await supabase
    .from("profiles")
    .upsert(
      { id: created.user.id, display_name: BOT_DISPLAY_NAME },
      { onConflict: "id" }
    );

  return { id: created.user.id, created: true };
}

async function ensureLeagueMembership(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existing?.league_id) return existing.league_id;

  const { data: league } = await supabase.from("leagues").select("id").limit(1).maybeSingle();
  if (!league?.id) return null;

  await supabase.from("league_members").insert({ league_id: league.id, user_id: userId });
  return league.id;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const bot = authUsers?.users?.find((u) => u.email === BOT_EMAIL);
  if (!bot) return NextResponse.json({ exists: false });

  const { data: bracket } = await supabase
    .from("user_brackets")
    .select("user_id, updated_at")
    .eq("user_id", bot.id)
    .maybeSingle();

  return NextResponse.json({
    exists: true,
    userId: bot.id,
    email: bot.email,
    hasBets: !!bracket,
    updatedAt: bracket?.updated_at ?? null,
  });
}

// ---------------------------------------------------------------------------
// POST  (create + fill)
// ---------------------------------------------------------------------------

export async function POST() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  // 1. Ensure bot user + profile exists
  const botUser = await findOrCreateBotUser(supabase);
  if (!botUser) return NextResponse.json({ error: "Failed to create bot user" }, { status: 500 });

  // 2. League membership
  const leagueId = await ensureLeagueMembership(supabase, botUser.id);
  if (!leagueId) return NextResponse.json({ error: "No league found" }, { status: 404 });

  // 3. Generate predictions
  const pred = generateBotPrediction();

  const now = new Date().toISOString();

  // 4. Save to user_brackets (upsert — bot's bets can be regenerated)
  const { error: bracketError } = await supabase
    .from("user_brackets")
    .upsert(
      {
        user_id: botUser.id,
        league_id: leagueId,
        group_predictions: pred.group_predictions,
        third_place_qualifiers: pred.third_place_qualifiers,
        knockout_tree: pred.knockout_tree,
        champion: pred.champion,
        updated_at: now,
      },
      { onConflict: "user_id,league_id" }
    );

  if (bracketError) return NextResponse.json({ error: `bracket: ${bracketError.message}` }, { status: 500 });

  // 5. Save advancement_picks
  const { error: advError } = await supabase
    .from("advancement_picks")
    .upsert(
      {
        user_id: botUser.id,
        league_id: leagueId,
        group_qualifiers: pred.advancement.group_qualifiers,
        advance_to_qf: pred.advancement.advance_to_qf,
        advance_to_sf: pred.advancement.advance_to_sf,
        advance_to_final: pred.advancement.advance_to_final,
        winner: pred.advancement.winner,
      },
      { onConflict: "user_id,league_id" }
    );

  if (advError) return NextResponse.json({ error: `advancement: ${advError.message}` }, { status: 500 });

  // 6. Save special_bets
  const { error: specialError } = await supabase
    .from("special_bets")
    .upsert(
      {
        user_id: botUser.id,
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

  if (specialError) return NextResponse.json({ error: `special: ${specialError.message}` }, { status: 500 });

  // 7. Audit log
  await supabase.from("admin_audit_log").insert({
    admin_email: adminEmail,
    target_user_id: botUser.id,
    table_name: "user_brackets",
    field_name: "bot_generate",
    old_value: null,
    new_value: { champion: pred.champion, rationale_count: pred.rationale.length },
    note: `Bot auto-filled by ${adminEmail}`,
  });

  return NextResponse.json({
    success: true,
    botUserId: botUser.id,
    created: botUser.created,
    leagueId,
    champion: pred.champion,
    rationale: pred.rationale,
  });
}
