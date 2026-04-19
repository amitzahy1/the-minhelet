import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

const LOCK_DEADLINE = new Date("2026-04-18T17:00:00Z");

/**
 * Returns all bets data (brackets, special bets, advancements) after lock.
 * Uses service role to bypass RLS so all league members' data is visible.
 * Before lock, returns 403.
 */
export async function GET() {
  // Only allow after lock
  if (new Date() < LOCK_DEADLINE) {
    return NextResponse.json({ error: "Bets are not locked yet" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  // Verify the user is authenticated
  const headersList = await headers();
  const cookie = headersList.get("cookie") || "";
  const { createServerClient } = await import("@supabase/ssr");
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookie.split(";").map(c => {
          const [name, ...rest] = c.trim().split("=");
          return { name, value: rest.join("=") };
        });
      },
      setAll() {},
    },
  });

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role to bypass RLS
  const supabase = createServiceClient(url, serviceKey);

  // Get the user's league
  const { data: membership } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const leagueId = membership?.league_id;
  if (!leagueId) {
    return NextResponse.json({ error: "No league found" }, { status: 404 });
  }

  // Fetch all data for this league
  const [
    { data: brackets },
    { data: specialBets },
    { data: advancements },
  ] = await Promise.all([
    supabase
      .from("user_brackets")
      .select("user_id, group_predictions, knockout_tree, champion, locked_at, profiles(display_name)")
      .eq("league_id", leagueId),
    supabase
      .from("special_bets")
      .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under, profiles(display_name)")
      .eq("league_id", leagueId),
    supabase
      .from("advancement_picks")
      .select("user_id, group_qualifiers, advance_to_qf, advance_to_sf, advance_to_final, winner, profiles(display_name)")
      .eq("league_id", leagueId),
  ]);

  return NextResponse.json({
    currentUserId: user.id,
    brackets: brackets || [],
    specialBets: specialBets || [],
    advancements: advancements || [],
  });
}
