import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import {
  resolveKnockoutTree,
  findKickoffForSlot,
  KO_SLOT_KEYS,
  type KoSlotKey,
  type ScheduleMatch,
} from "@/lib/scoring/knockout-resolver";
import type { FinishedMatch } from "@/lib/results-hits";

const LOCK_DEADLINE = new Date("2026-06-10T14:00:00Z");

interface RawMatch {
  id: number; date: string; homeTla: string; awayTla: string;
  group?: string; stage?: string; status?: string;
  homeGoals?: number | null; awayGoals?: number | null;
  homePenalties?: number | null; awayPenalties?: number | null;
}

/**
 * Redact OTHER users' Tree-2 (real-data) picks for matches that haven't kicked
 * off yet — they stay secret until the match actually starts (revealed at the
 * kickoff time, even though the pick locked 1h earlier). The viewer's own picks
 * are never redacted. Scoring/recompute use the un-redacted data (service role),
 * so this is display-only. On any failure we hide ALL others' live picks (safe
 * default). `origin` is used to reach /api/matches server-side.
 */
async function redactLiveKnockout(
  brackets: Array<Record<string, unknown>>,
  currentUserId: string,
  origin: string,
): Promise<void> {
  let matches: RawMatch[] = [];
  try {
    const res = await fetch(`${origin}/api/matches`, { cache: "no-store" });
    const json = await res.json();
    matches = (json.matches as RawMatch[]) || [];
  } catch {
    matches = [];
  }
  const scored: FinishedMatch[] = matches
    .filter((m) => m.homeGoals != null && m.awayGoals != null)
    .map((m) => ({
      id: m.id, date: m.date, homeTla: m.homeTla, awayTla: m.awayTla,
      group: m.group ?? "", stage: m.stage ?? "",
      homeGoals: m.homeGoals as number, awayGoals: m.awayGoals as number,
      homePenalties: m.homePenalties ?? null, awayPenalties: m.awayPenalties ?? null,
    }));
  const schedule: ScheduleMatch[] = matches.map((m) => ({ homeTla: m.homeTla, awayTla: m.awayTla, date: m.date, status: m.status ?? null }));
  const tree = resolveKnockoutTree(scored, null);
  const now = Date.now();
  // Third-place teams (so third_place picks can also be gated on its kickoff).
  const thirdMatch = matches.find((m) => m.stage === "THIRD_PLACE" || m.stage === "THIRD");
  const thirdTeams = thirdMatch ? { team1: thirdMatch.homeTla, team2: thirdMatch.awayTla } : null;

  // Which slots are revealed (their match has kicked off)?
  const revealed = new Set<string>();
  for (const key of [...KO_SLOT_KEYS, "third_place"] as (KoSlotKey | "third_place")[]) {
    const ko = findKickoffForSlot(key, tree, schedule, thirdTeams);
    if (ko && new Date(ko.date).getTime() <= now) revealed.add(key);
  }

  for (const b of brackets) {
    if (b.user_id === currentUserId) continue;
    const live = (b.knockout_tree_live || {}) as Record<string, unknown>;
    const kept: Record<string, unknown> = {};
    for (const k of Object.keys(live)) if (revealed.has(k)) kept[k] = live[k];
    b.knockout_tree_live = kept;
  }
}

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
      .select("user_id, group_predictions, knockout_tree, knockout_tree_live, champion, locked_at, profiles(display_name)")
      .eq("league_id", leagueId),
    supabase
      .from("special_bets")
      .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under, profiles(display_name)")
      .eq("league_id", leagueId),
    supabase
      .from("advancement_picks")
      // select("*") so a not-yet-migrated advance_to_r16 column can't break the query
      .select("*, profiles(display_name)")
      .eq("league_id", leagueId),
  ]);

  // Hide other users' not-yet-kicked-off Tree-2 picks (display-only redaction).
  const proto = headersList.get("x-forwarded-proto") || "https";
  const host = headersList.get("host") || "";
  const bracketsList = (brackets || []) as Array<Record<string, unknown>>;
  if (host) {
    await redactLiveKnockout(bracketsList, user.id, `${proto}://${host}`);
  }

  return NextResponse.json({
    currentUserId: user.id,
    brackets: bracketsList,
    specialBets: specialBets || [],
    advancements: advancements || [],
  });
}
