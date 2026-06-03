import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { computePredictionLockRows } from "@/lib/scoring/compute-prediction-locks";

const LOCK_DEADLINE = new Date("2026-06-10T14:00:00Z");

interface RawMatch {
  id: number; date: string; homeTla: string; awayTla: string;
  group?: string; stage?: string; status?: string;
  homeGoals?: number | null; awayGoals?: number | null;
  homePenalties?: number | null; awayPenalties?: number | null;
}

/**
 * Redact OTHER users' Tree-2 (real-data) knockout picks for slots that have NOT
 * LOCKED yet. A slot locks 60 min before its kickoff; once locked the pick is
 * frozen, so revealing it can't help a rival — it's shown from the lock instant
 * on (matching the rule "a pick is shown only once that match's bet is locked").
 * The viewer's own picks are never redacted. `revealedSlots` is the set of slot
 * keys whose lock instant has already passed; any key not in it is dropped. On
 * any failure the caller passes an empty set → ALL others' live picks hidden
 * (safe default). Display-only: scoring/recompute use the un-redacted data.
 */
function redactLiveKnockout(
  brackets: Array<Record<string, unknown>>,
  currentUserId: string,
  revealedSlots: Set<string>,
): void {
  for (const b of brackets) {
    if (b.user_id === currentUserId) continue;
    const live = (b.knockout_tree_live || {}) as Record<string, unknown>;
    const kept: Record<string, unknown> = {};
    for (const k of Object.keys(live)) if (revealedSlots.has(k)) kept[k] = live[k];
    b.knockout_tree_live = kept;
  }
}

/**
 * Redact OTHER users' GROUP-STAGE score predictions for match-days that have NOT
 * LOCKED yet. Group scores stay editable per match-day (the whole day locks 30
 * min before its first kickoff); until then an upcoming score must stay secret —
 * otherwise a bettor could copy a rival's injury-informed last-minute pick. Once
 * a day locks, every score in it is frozen, so it's revealed from that instant.
 * The frozen `order` (the qualification bet) is NOT redacted — it's meant to be
 * visible post global lock. `revealedPairs` maps group letter → the set of pair
 * indices whose match-day has locked; anything else is nulled. Empty map
 * (failure) → every score hidden (safe). Display-only: scoring/recompute use the
 * un-redacted service-role data above.
 */
function redactLiveGroupScores(
  brackets: Array<Record<string, unknown>>,
  currentUserId: string,
  revealedPairs: Record<string, Set<number>>,
): void {
  for (const b of brackets) {
    if (b.user_id === currentUserId) continue;
    const gp = (b.group_predictions || {}) as Record<
      string,
      { order?: number[]; scores?: Array<{ home: number | null; away: number | null }> }
    >;
    for (const [letter, g] of Object.entries(gp)) {
      if (!g || !Array.isArray(g.scores)) continue;
      const revealed = revealedPairs[letter] ?? new Set<number>();
      g.scores = g.scores.map((s, idx) =>
        revealed.has(idx) ? s : { home: null, away: null },
      );
    }
    b.group_predictions = gp;
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

  // Hide other users' not-yet-LOCKED predictions (display-only redaction): a
  // group score is revealed only once its match-day has locked (30 min before
  // the day's first kickoff) and a Tree-2 knockout pick only once its slot has
  // locked (60 min before kickoff) — the instant the bet freezes, matching the
  // rule "a score is shown only when that match's bet is locked". Reuses the
  // exact lock computation the save RPCs enforce, so reveal, save-gating, and
  // scoring never disagree. Scoring/recompute use the un-redacted data above.
  const proto = headersList.get("x-forwarded-proto") || "https";
  const host = headersList.get("host") || "";
  const bracketsList = (brackets || []) as Array<Record<string, unknown>>;
  if (host) {
    let rawMatches: RawMatch[] = [];
    try {
      const res = await fetch(`${proto}://${host}/api/matches`, { cache: "no-store" });
      rawMatches = ((await res.json()).matches as RawMatch[]) || [];
    } catch {
      rawMatches = [];
    }
    // A prediction is revealed once its lock instant has passed. On any failure
    // (no schedule) the sets stay empty → every live pick/score hidden (safe).
    const nowMs = Date.now();
    const revealedPairs: Record<string, Set<number>> = {};
    const revealedSlots = new Set<string>();
    for (const r of computePredictionLockRows(rawMatches)) {
      if (Date.parse(r.lock_at) > nowMs) continue;
      if (r.scope === "group") {
        const [letter, idxStr] = r.lock_key.split(":");
        const idx = Number(idxStr);
        if (!letter || Number.isNaN(idx)) continue;
        if (!revealedPairs[letter]) revealedPairs[letter] = new Set<number>();
        revealedPairs[letter].add(idx);
      } else {
        revealedSlots.add(r.lock_key);
      }
    }
    redactLiveKnockout(bracketsList, user.id, revealedSlots);
    redactLiveGroupScores(bracketsList, user.id, revealedPairs);
  }

  return NextResponse.json({
    currentUserId: user.id,
    brackets: bracketsList,
    specialBets: specialBets || [],
    advancements: advancements || [],
  });
}
