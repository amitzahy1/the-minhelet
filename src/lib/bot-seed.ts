// ============================================================================
// WC2026 — Bot seeding (shared by /api/admin/bot and scripts/seed-bot.ts)
//
// Creates/locates the synthetic "🤖 בוט" account, ensures league membership,
// generates a full prediction (bot-predictions.ts) and upserts it to all three
// bet tables. Overwrites only the bot's own bets — safe to re-run.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBotPrediction } from "./bot-predictions";

export const BOT_EMAIL = "bot@wc2026.local";
export const BOT_DISPLAY_NAME = "🤖 בוט";

export async function findOrCreateBotUser(
  supabase: SupabaseClient,
): Promise<{ id: string; created: boolean } | null> {
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const found = existingUsers?.users?.find((u) => u.email === BOT_EMAIL);
  if (found) {
    await supabase.from("profiles").upsert({ id: found.id, display_name: BOT_DISPLAY_NAME }, { onConflict: "id" });
    return { id: found.id, created: false };
  }

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
  await supabase.from("profiles").upsert({ id: created.user.id, display_name: BOT_DISPLAY_NAME }, { onConflict: "id" });
  return { id: created.user.id, created: true };
}

export async function ensureLeagueMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
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

export interface BotSeedResult {
  botUserId: string;
  created: boolean;
  leagueId: string;
  champion: string;
  rationale: string[];
}

/** Full seed: ensure user + league, generate predictions, upsert all 3 tables. */
export async function seedBot(supabase: SupabaseClient): Promise<BotSeedResult> {
  const botUser = await findOrCreateBotUser(supabase);
  if (!botUser) throw new Error("Failed to create bot user");

  const leagueId = await ensureLeagueMembership(supabase, botUser.id);
  if (!leagueId) throw new Error("No league found");

  const pred = generateBotPrediction();

  const { error: bracketError } = await supabase.from("user_brackets").upsert(
    {
      user_id: botUser.id,
      league_id: leagueId,
      group_predictions: pred.group_predictions,
      third_place_qualifiers: pred.third_place_qualifiers,
      knockout_tree: pred.knockout_tree,
      champion: pred.champion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,league_id" },
  );
  if (bracketError) throw new Error(`bracket: ${bracketError.message}`);

  const { error: advError } = await supabase.from("advancement_picks").upsert(
    {
      user_id: botUser.id,
      league_id: leagueId,
      group_qualifiers: pred.advancement.group_qualifiers,
      advance_to_qf: pred.advancement.advance_to_qf,
      advance_to_sf: pred.advancement.advance_to_sf,
      advance_to_final: pred.advancement.advance_to_final,
      winner: pred.advancement.winner,
    },
    { onConflict: "user_id,league_id" },
  );
  if (advError) throw new Error(`advancement: ${advError.message}`);

  const { error: specialError } = await supabase.from("special_bets").upsert(
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
    { onConflict: "user_id,league_id" },
  );
  if (specialError) throw new Error(`special: ${specialError.message}`);

  return { botUserId: botUser.id, created: botUser.created, leagueId, champion: pred.champion, rationale: pred.rationale };
}
