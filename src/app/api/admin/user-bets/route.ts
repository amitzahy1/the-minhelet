import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

/**
 * /api/admin/user-bets
 *   GET  ?userId=X  → load that user's bracket / advancement / special rows
 *   PATCH           → override any field(s). Writes via service role, logs every
 *                     changed field to admin_audit_log. Unlike /api/admin/fill-bets,
 *                     this IS allowed to overwrite existing values.
 *
 * PATCH body:
 *   {
 *     userId: string,
 *     bracket?: Partial<user_brackets row>,
 *     advancement?: Partial<advancement_picks row>,
 *     special?: Partial<special_bets row>,
 *     note?: string,
 *   }
 */

type Json = unknown;

const BRACKET_FIELDS = [
  "group_predictions",
  "third_place_qualifiers",
  "knockout_tree",
  "champion",
] as const;

const ADVANCEMENT_FIELDS = [
  "group_qualifiers",
  "advance_to_qf",
  "advance_to_sf",
  "advance_to_final",
  "winner",
] as const;

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

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

async function resolveLeagueId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: membership } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (membership?.league_id) return membership.league_id;

  // Fallback: first league in DB
  const { data: league } = await supabase.from("leagues").select("id").limit(1).single();
  return league?.id ?? null;
}

function jsonEquals(a: Json, b: Json): boolean {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return a === b;
  }
}

async function auditChanges(
  supabase: SupabaseClient,
  adminEmail: string,
  userId: string,
  tableName: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  fields: readonly string[],
  note?: string
) {
  const entries: Array<{
    admin_email: string;
    target_user_id: string;
    table_name: string;
    field_name: string;
    old_value: Json;
    new_value: Json;
    note: string | null;
  }> = [];

  for (const field of fields) {
    if (!(field in after)) continue;
    const oldVal = before?.[field] ?? null;
    const newVal = after[field];
    if (jsonEquals(oldVal, newVal)) continue;
    entries.push({
      admin_email: adminEmail,
      target_user_id: userId,
      table_name: tableName,
      field_name: field,
      old_value: oldVal as Json,
      new_value: newVal as Json,
      note: note ?? null,
    });
  }

  if (entries.length === 0) return 0;
  const { error } = await supabase.from("admin_audit_log").insert(entries);
  if (error) console.error("audit log insert failed:", error.message);
  return entries.length;
}

// ----------------------------------------------------------------------------
// GET
// ----------------------------------------------------------------------------

export async function GET(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const leagueId = await resolveLeagueId(supabase, userId);
  if (!leagueId) return NextResponse.json({ error: "No league found for user" }, { status: 404 });

  const [profileRes, bracketRes, advRes, specialRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("id", userId).single(),
    supabase.from("user_brackets").select("*").eq("user_id", userId).eq("league_id", leagueId).maybeSingle(),
    supabase.from("advancement_picks").select("*").eq("user_id", userId).eq("league_id", leagueId).maybeSingle(),
    supabase.from("special_bets").select("*").eq("user_id", userId).eq("league_id", leagueId).maybeSingle(),
  ]);

  return NextResponse.json({
    user: profileRes.data ?? { id: userId, display_name: null },
    league_id: leagueId,
    bracket: bracketRes.data ?? null,
    advancement: advRes.data ?? null,
    special: specialRes.data ?? null,
  });
}

// ----------------------------------------------------------------------------
// PATCH
// ----------------------------------------------------------------------------

type PatchBody = {
  userId?: string;
  bracket?: Record<string, unknown>;
  advancement?: Record<string, unknown>;
  special?: Record<string, unknown>;
  note?: string;
};

export async function PATCH(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, bracket, advancement, special, note } = body;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (!bracket && !advancement && !special) {
    return NextResponse.json({ error: "at least one of bracket/advancement/special required" }, { status: 400 });
  }

  const leagueId = await resolveLeagueId(supabase, userId);
  if (!leagueId) return NextResponse.json({ error: "No league found for user" }, { status: 404 });

  const changes = { bracket: 0, advancement: 0, special: 0 };
  const errors: string[] = [];

  // -------- user_brackets --------
  if (bracket) {
    const { data: existing } = await supabase
      .from("user_brackets")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .maybeSingle();

    const updates: Record<string, unknown> = {};
    for (const f of BRACKET_FIELDS) if (f in bracket) updates[f] = bracket[f];
    updates["updated_at"] = new Date().toISOString();

    if (existing) {
      const { error } = await supabase
        .from("user_brackets")
        .update(updates)
        .eq("user_id", userId)
        .eq("league_id", leagueId);
      if (error) errors.push(`user_brackets: ${error.message}`);
    } else {
      const { error } = await supabase.from("user_brackets").insert({
        user_id: userId,
        league_id: leagueId,
        group_predictions: {},
        third_place_qualifiers: [],
        knockout_tree: {},
        champion: null,
        ...updates,
      });
      if (error) errors.push(`user_brackets insert: ${error.message}`);
    }

    if (errors.length === 0) {
      changes.bracket = await auditChanges(
        supabase,
        adminEmail,
        userId,
        "user_brackets",
        existing,
        updates,
        BRACKET_FIELDS,
        note
      );
    }
  }

  // -------- advancement_picks --------
  if (advancement) {
    const { data: existing } = await supabase
      .from("advancement_picks")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .maybeSingle();

    const updates: Record<string, unknown> = {};
    for (const f of ADVANCEMENT_FIELDS) if (f in advancement) updates[f] = advancement[f];

    if (existing) {
      const { error } = await supabase
        .from("advancement_picks")
        .update(updates)
        .eq("user_id", userId)
        .eq("league_id", leagueId);
      if (error) errors.push(`advancement_picks: ${error.message}`);
    } else {
      const { error } = await supabase.from("advancement_picks").insert({
        user_id: userId,
        league_id: leagueId,
        group_qualifiers: {},
        advance_to_qf: [],
        advance_to_sf: [],
        advance_to_final: [],
        winner: "",
        ...updates,
      });
      if (error) errors.push(`advancement_picks insert: ${error.message}`);
    }

    if (errors.length === 0) {
      changes.advancement = await auditChanges(
        supabase,
        adminEmail,
        userId,
        "advancement_picks",
        existing,
        updates,
        ADVANCEMENT_FIELDS,
        note
      );
    }
  }

  // -------- special_bets --------
  if (special) {
    const { data: existing } = await supabase
      .from("special_bets")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .maybeSingle();

    const updates: Record<string, unknown> = {};
    for (const f of SPECIAL_FIELDS) if (f in special) updates[f] = special[f];

    if (existing) {
      const { error } = await supabase
        .from("special_bets")
        .update(updates)
        .eq("user_id", userId)
        .eq("league_id", leagueId);
      if (error) errors.push(`special_bets: ${error.message}`);
    } else {
      const { error } = await supabase.from("special_bets").insert({
        user_id: userId,
        league_id: leagueId,
        ...updates,
      });
      if (error) errors.push(`special_bets insert: ${error.message}`);
    }

    if (errors.length === 0) {
      changes.special = await auditChanges(
        supabase,
        adminEmail,
        userId,
        "special_bets",
        existing,
        updates,
        SPECIAL_FIELDS,
        note
      );
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    admin: adminEmail,
    userId,
    leagueId,
    changes,
    errors: errors.length > 0 ? errors : undefined,
  });
}
