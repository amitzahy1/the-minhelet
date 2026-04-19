import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

/**
 * POST /api/admin/fill-bets
 *
 * Admin-only endpoint to fill missing bets for a user who didn't complete
 * their bets before the lock deadline. Uses service role to bypass RLS.
 *
 * CRITICAL: Only fills NULL/empty fields. Cannot override existing non-null data.
 *
 * Body: {
 *   userId: string,
 *   specials?: {
 *     top_scorer_player?: string,
 *     top_scorer_team?: string,
 *     top_assists_player?: string,
 *     top_assists_team?: string,
 *     best_attack_team?: string,
 *     most_prolific_group?: string,
 *     driest_group?: string,
 *     dirtiest_team?: string,
 *     matchup_pick?: string,
 *     penalties_over_under?: string,
 *   },
 *   advancement?: {
 *     advance_to_qf?: string[],
 *     advance_to_sf?: string[],
 *     advance_to_final?: string[],
 *     winner?: string,
 *   }
 * }
 */

// Fields that can be filled on special_bets
const SPECIAL_FIELDS = [
  "top_scorer_player",
  "top_scorer_team",
  "top_assists_player",
  "top_assists_team",
  "best_attack_team",
  "most_prolific_group",
  "driest_group",
  "dirtiest_team",
  "matchup_pick",
  "penalties_over_under",
] as const;

// Fields that can be filled on advancement_picks
const ADVANCEMENT_FIELDS = [
  "advance_to_qf",
  "advance_to_sf",
  "advance_to_final",
  "winner",
] as const;

type SpecialField = (typeof SPECIAL_FIELDS)[number];
type AdvancementField = (typeof ADVANCEMENT_FIELDS)[number];

/** Check if a value is null, undefined, empty string, or empty array */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.filter(Boolean).length === 0) return true;
  return false;
}

export async function POST(request: Request) {
  // 1. Admin auth
  const adminEmail = await verifyAdmin();
  if (!adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // 2. Validate env
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing server config" }, { status: 500 });
  }

  // 3. Parse body
  let body: {
    userId?: string;
    specials?: Partial<Record<SpecialField, string>>;
    advancement?: Partial<Record<AdvancementField, string | string[]>>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, specials, advancement } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (!specials && !advancement) {
    return NextResponse.json({ error: "At least one of specials or advancement is required" }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey);

  // 4. Verify the user exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 5. Get the user's league (first league membership)
  const { data: membership } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "User is not a member of any league" }, { status: 404 });
  }

  const leagueId = membership.league_id;

  const updated: Record<string, unknown> = {};
  const skipped: Record<string, string> = {};
  const errors: string[] = [];

  // ── Handle special bets ─────────────────────────────────────────────
  if (specials) {
    // Load existing special_bets row
    const { data: existing } = await supabase
      .from("special_bets")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .single();

    const fieldsToUpdate: Record<string, unknown> = {};

    for (const field of SPECIAL_FIELDS) {
      if (!(field in specials)) continue;

      const requestedValue = specials[field];
      const existingValue = existing?.[field];

      if (!isEmpty(existingValue)) {
        skipped[`specials.${field}`] = `already has value: ${existingValue}`;
        continue;
      }

      if (requestedValue !== undefined && requestedValue !== null) {
        fieldsToUpdate[field] = requestedValue;
        updated[`specials.${field}`] = requestedValue;
      }
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      if (existing) {
        // Update existing row
        const { error } = await supabase
          .from("special_bets")
          .update(fieldsToUpdate)
          .eq("user_id", userId)
          .eq("league_id", leagueId);

        if (error) {
          errors.push(`special_bets update: ${error.message}`);
        }
      } else {
        // Insert new row
        const { error } = await supabase
          .from("special_bets")
          .insert({
            user_id: userId,
            league_id: leagueId,
            ...fieldsToUpdate,
          });

        if (error) {
          errors.push(`special_bets insert: ${error.message}`);
        }
      }
    }
  }

  // ── Handle advancement picks ────────────────────────────────────────
  if (advancement) {
    // Load existing advancement_picks row
    const { data: existing } = await supabase
      .from("advancement_picks")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .single();

    const fieldsToUpdate: Record<string, unknown> = {};

    for (const field of ADVANCEMENT_FIELDS) {
      if (!(field in advancement)) continue;

      const requestedValue = advancement[field];
      const existingValue = existing?.[field];

      if (!isEmpty(existingValue)) {
        skipped[`advancement.${field}`] = `already has value: ${JSON.stringify(existingValue)}`;
        continue;
      }

      if (requestedValue !== undefined && requestedValue !== null) {
        fieldsToUpdate[field] = requestedValue;
        updated[`advancement.${field}`] = requestedValue;
      }
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      if (existing) {
        // Update existing row
        const { error } = await supabase
          .from("advancement_picks")
          .update(fieldsToUpdate)
          .eq("user_id", userId)
          .eq("league_id", leagueId);

        if (error) {
          errors.push(`advancement_picks update: ${error.message}`);
        }
      } else {
        // Insert new row
        const { error } = await supabase
          .from("advancement_picks")
          .insert({
            user_id: userId,
            league_id: leagueId,
            group_qualifiers: {},
            advance_to_qf: [],
            advance_to_sf: [],
            advance_to_final: [],
            winner: "",
            ...fieldsToUpdate,
          });

        if (error) {
          errors.push(`advancement_picks insert: ${error.message}`);
        }
      }
    }
  }

  // 6. Return summary
  return NextResponse.json({
    success: errors.length === 0,
    user: profile.display_name,
    leagueId,
    admin: adminEmail,
    updated,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
