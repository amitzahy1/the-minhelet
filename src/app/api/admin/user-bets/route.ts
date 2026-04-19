import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

/**
 * /api/admin/user-bets
 *   GET  ?userId=X  → load that user's bracket / advancement / special rows
 *   PATCH           → FILL-EMPTY-ONLY. Existing non-empty values are NEVER
 *                     overwritten. Deep-merged per-leaf for JSONB blobs.
 *                     Every applied change is logged to admin_audit_log.
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

const BRACKET_SCALAR_FIELDS = ["champion"] as const;
const ADVANCEMENT_SCALAR_FIELDS = ["winner"] as const;
// scalar fields — simple fill-empty-only
const SPECIAL_SCALAR_FIELDS = [
  "top_scorer_player",
  "top_scorer_team",
  "top_assists_player",
  "top_assists_team",
  "best_attack_team",
  "most_prolific_group",
  "driest_group",
  "dirtiest_team",
  "penalties_over_under",
] as const;
// matchup_pick is stored as "1,X,2" — fill-empty-only PER SLOT, not globally.

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
    .maybeSingle();
  if (membership?.league_id) return membership.league_id;

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .limit(1)
    .maybeSingle();
  return league?.id ?? null;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value)) return value.filter((v) => !isEmpty(v)).length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

function jsonEquals(a: Json, b: Json): boolean {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return a === b;
  }
}

// ---------------------------------------------------------------------------
// Group predictions merge: leaf-level fill-empty-only.
// Structure: { [letter: string]: { order: number[], scores: Array<{home, away}> } }
// A match score leaf is "empty" when the scalar is null/undefined. Existing
// non-null scores are preserved.
// The `order` array: we treat it as locked if ANY score in that group is
// already filled — otherwise admins can set it.
// ---------------------------------------------------------------------------

type GroupScore = { home: number | null; away: number | null };
type GroupState = { order: number[]; scores: GroupScore[] };

function mergeGroupPredictions(
  existing: Record<string, GroupState> | null | undefined,
  incoming: Record<string, GroupState>
): { merged: Record<string, GroupState>; applied: string[] } {
  const applied: string[] = [];
  const merged: Record<string, GroupState> = {};
  const letters = new Set([...(existing ? Object.keys(existing) : []), ...Object.keys(incoming)]);

  for (const letter of letters) {
    const ex = existing?.[letter];
    const inc = incoming[letter];
    const base: GroupState = ex ?? { order: [0, 1, 2, 3], scores: [] };

    if (!inc) {
      merged[letter] = base;
      continue;
    }

    // Scores: per-leaf fill-empty-only
    const exScores = base.scores || [];
    const incScores = inc.scores || [];
    const newScores: GroupScore[] = [];
    const len = Math.max(exScores.length, incScores.length, 6);
    let anyExistingScore = false;
    for (let i = 0; i < len; i++) {
      const ex = exScores[i] ?? { home: null, away: null };
      const incomingS = incScores[i] ?? { home: null, away: null };
      if (ex.home !== null || ex.away !== null) anyExistingScore = true;
      const home =
        ex.home !== null && ex.home !== undefined ? ex.home :
        incomingS.home !== null && incomingS.home !== undefined ? incomingS.home : null;
      const away =
        ex.away !== null && ex.away !== undefined ? ex.away :
        incomingS.away !== null && incomingS.away !== undefined ? incomingS.away : null;
      if (home !== (ex.home ?? null)) applied.push(`group_predictions.${letter}.scores[${i}].home`);
      if (away !== (ex.away ?? null)) applied.push(`group_predictions.${letter}.scores[${i}].away`);
      newScores.push({ home, away });
    }

    // Order: only overwrite if no existing scores AND admin supplied a non-default order
    let newOrder = base.order || [0, 1, 2, 3];
    const isDefaultExisting =
      Array.isArray(newOrder) && newOrder.length === 4 &&
      newOrder[0] === 0 && newOrder[1] === 1 && newOrder[2] === 2 && newOrder[3] === 3;
    if (!anyExistingScore && isDefaultExisting && Array.isArray(inc.order) && inc.order.length === 4) {
      if (!jsonEquals(newOrder, inc.order)) {
        newOrder = inc.order;
        applied.push(`group_predictions.${letter}.order`);
      }
    }

    merged[letter] = { order: newOrder, scores: newScores };
  }

  return { merged, applied };
}

// ---------------------------------------------------------------------------
// Knockout tree merge: per-match per-field fill-empty-only
// Structure: { [matchKey: string]: { score1, score2, winner } }
// ---------------------------------------------------------------------------

type KOState = { score1: number | null; score2: number | null; winner: string | null };

function mergeKnockoutTree(
  existing: Record<string, KOState> | null | undefined,
  incoming: Record<string, KOState>
): { merged: Record<string, KOState>; applied: string[] } {
  const applied: string[] = [];
  const merged: Record<string, KOState> = { ...(existing || {}) };
  for (const key of Object.keys(incoming)) {
    const ex = merged[key] || { score1: null, score2: null, winner: null };
    const inc = incoming[key] || { score1: null, score2: null, winner: null };
    const nextState = { ...ex };
    (["score1", "score2"] as const).forEach((f) => {
      if ((ex[f] === null || ex[f] === undefined) && inc[f] !== null && inc[f] !== undefined) {
        nextState[f] = inc[f];
        applied.push(`knockout_tree.${key}.${f}`);
      }
    });
    if (isEmpty(ex.winner) && !isEmpty(inc.winner)) {
      nextState.winner = inc.winner;
      applied.push(`knockout_tree.${key}.winner`);
    }
    merged[key] = nextState;
  }
  return { merged, applied };
}

// ---------------------------------------------------------------------------
// Advancement arrays merge: each slot fill-empty-only
// ---------------------------------------------------------------------------

function mergeStringArray(
  existing: string[] | null | undefined,
  incoming: string[] | null | undefined,
  size: number,
  basePath: string
): { merged: string[]; applied: string[] } {
  const applied: string[] = [];
  const ex = Array.isArray(existing) ? existing : [];
  const inc = Array.isArray(incoming) ? incoming : [];
  const merged: string[] = [];
  for (let i = 0; i < size; i++) {
    const e = ex[i] ?? "";
    const c = inc[i] ?? "";
    if (isEmpty(e) && !isEmpty(c)) {
      merged.push(c);
      applied.push(`${basePath}[${i}]`);
    } else {
      merged.push(e);
    }
  }
  return { merged, applied };
}

// ---------------------------------------------------------------------------
// Audit helper
// ---------------------------------------------------------------------------

async function writeAudit(
  supabase: SupabaseClient,
  adminEmail: string,
  userId: string,
  tableName: string,
  paths: string[],
  note: string | undefined,
  oldSnapshot: Record<string, unknown> | null,
  newSnapshot: Record<string, unknown>
) {
  if (paths.length === 0) return 0;
  const entries = paths.map((p) => ({
    admin_email: adminEmail,
    target_user_id: userId,
    table_name: tableName,
    field_name: p,
    old_value: oldSnapshot ?? null,
    new_value: newSnapshot,
    note: note ?? null,
  }));
  const { error } = await supabase.from("admin_audit_log").insert(entries);
  if (error) console.error("audit log insert failed:", error.message);
  return entries.length;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

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
    supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle(),
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

// ---------------------------------------------------------------------------
// PATCH (fill-empty-only)
// ---------------------------------------------------------------------------

type PatchBody = {
  userId?: string;
  bracket?: {
    group_predictions?: Record<string, GroupState>;
    knockout_tree?: Record<string, KOState>;
    third_place_qualifiers?: string[];
    champion?: string | null;
  };
  advancement?: {
    group_qualifiers?: Record<string, string[]>;
    advance_to_qf?: string[];
    advance_to_sf?: string[];
    advance_to_final?: string[];
    winner?: string;
  };
  special?: Record<string, string | null>;
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

  const errors: string[] = [];
  const applied = { bracket: [] as string[], advancement: [] as string[], special: [] as string[] };
  const skipped: string[] = [];

  // -------- user_brackets --------
  if (bracket) {
    const { data: existing } = await supabase
      .from("user_brackets")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .maybeSingle();

    const updates: Record<string, unknown> = {};

    // group_predictions
    if (bracket.group_predictions) {
      const { merged, applied: groupApplied } = mergeGroupPredictions(
        existing?.group_predictions,
        bracket.group_predictions
      );
      if (groupApplied.length > 0) updates["group_predictions"] = merged;
      applied.bracket.push(...groupApplied);
    }

    // knockout_tree
    if (bracket.knockout_tree) {
      const { merged, applied: koApplied } = mergeKnockoutTree(
        existing?.knockout_tree,
        bracket.knockout_tree
      );
      if (koApplied.length > 0) updates["knockout_tree"] = merged;
      applied.bracket.push(...koApplied);
    }

    // third_place_qualifiers (simple array fill)
    if (bracket.third_place_qualifiers) {
      const exArr = (existing?.third_place_qualifiers as string[]) || [];
      if (isEmpty(exArr) && !isEmpty(bracket.third_place_qualifiers)) {
        updates["third_place_qualifiers"] = bracket.third_place_qualifiers;
        applied.bracket.push("third_place_qualifiers");
      } else if (!isEmpty(exArr)) {
        skipped.push("third_place_qualifiers");
      }
    }

    // champion (scalar)
    for (const f of BRACKET_SCALAR_FIELDS) {
      if (!(f in bracket)) continue;
      const existingVal = existing?.[f];
      const incomingVal = (bracket as Record<string, unknown>)[f];
      if (isEmpty(existingVal) && !isEmpty(incomingVal)) {
        updates[f] = incomingVal;
        applied.bracket.push(f);
      } else if (!isEmpty(existingVal)) {
        skipped.push(f);
      }
    }

    if (Object.keys(updates).length > 0) {
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

      if (errors.length === 0 && applied.bracket.length > 0) {
        await writeAudit(supabase, adminEmail, userId, "user_brackets", applied.bracket, note, existing, updates);
      }
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
    const sizes: Record<string, number> = {
      advance_to_qf: 8,
      advance_to_sf: 4,
      advance_to_final: 2,
    };

    for (const arrField of ["advance_to_qf", "advance_to_sf", "advance_to_final"] as const) {
      if (!advancement[arrField]) continue;
      const { merged, applied: arrApplied } = mergeStringArray(
        existing?.[arrField] as string[],
        advancement[arrField] as string[],
        sizes[arrField],
        arrField
      );
      if (arrApplied.length > 0) {
        updates[arrField] = merged.filter(Boolean);
        applied.advancement.push(...arrApplied);
      } else if (Array.isArray(existing?.[arrField]) && (existing![arrField] as string[]).some((x) => !isEmpty(x))) {
        skipped.push(arrField);
      }
    }

    for (const f of ADVANCEMENT_SCALAR_FIELDS) {
      if (!(f in advancement)) continue;
      const existingVal = existing?.[f];
      const incomingVal = (advancement as Record<string, unknown>)[f];
      if (isEmpty(existingVal) && !isEmpty(incomingVal)) {
        updates[f] = incomingVal;
        applied.advancement.push(f);
      } else if (!isEmpty(existingVal)) {
        skipped.push(f);
      }
    }

    if (Object.keys(updates).length > 0) {
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

      if (errors.length === 0 && applied.advancement.length > 0) {
        await writeAudit(supabase, adminEmail, userId, "advancement_picks", applied.advancement, note, existing, updates);
      }
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

    for (const f of SPECIAL_SCALAR_FIELDS) {
      if (!(f in special)) continue;
      const existingVal = existing?.[f];
      const incomingVal = special[f];
      if (isEmpty(existingVal) && !isEmpty(incomingVal)) {
        updates[f] = incomingVal;
        applied.special.push(f);
      } else if (!isEmpty(existingVal)) {
        skipped.push(f);
      }
    }

    // matchup_pick: per-slot fill-empty-only. Storage format is "1,X,2".
    if ("matchup_pick" in special) {
      const existingStr = (existing?.matchup_pick as string | null | undefined) ?? "";
      const incomingStr = (special.matchup_pick as string | null | undefined) ?? "";
      const ep = existingStr.split(",");
      const ip = incomingStr.split(",");
      const merged = [0, 1, 2].map((i) => {
        const e = (ep[i] ?? "").trim();
        const inc = (ip[i] ?? "").trim();
        return isEmpty(e) ? inc : e;
      });
      for (let i = 0; i < 3; i++) {
        const before = (ep[i] ?? "").trim();
        const after = merged[i];
        if (before !== after && !isEmpty(after)) {
          applied.special.push(`matchup_pick[${i}]`);
        } else if (!isEmpty(before) && before !== (ip[i] ?? "").trim() && !isEmpty((ip[i] ?? "").trim())) {
          skipped.push(`matchup_pick[${i}]`);
        }
      }
      // Only update if any slot actually changed
      const finalStr = merged.every(isEmpty) ? null : merged.join(",");
      if (finalStr !== (existingStr || null)) {
        updates["matchup_pick"] = finalStr;
      }
    }

    if (Object.keys(updates).length > 0) {
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

      if (errors.length === 0 && applied.special.length > 0) {
        await writeAudit(supabase, adminEmail, userId, "special_bets", applied.special, note, existing, updates);
      }
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    admin: adminEmail,
    userId,
    leagueId,
    applied: {
      bracket: applied.bracket.length,
      advancement: applied.advancement.length,
      special: applied.special.length,
    },
    appliedFields: applied,
    skippedFields: skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// ---------------------------------------------------------------------------
// DELETE — reset a user's bets entirely (all three tables)
// Destructive; use only when the user's bets are corrupted and must be
// re-entered. Logged to admin_audit_log with a summary of what was wiped.
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const note = searchParams.get("note") ?? "";
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  // Snapshot what's about to be deleted (so it's recoverable via audit log)
  const [{ data: bracket }, { data: adv }, { data: special }] = await Promise.all([
    supabase.from("user_brackets").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("advancement_picks").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("special_bets").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const [bRes, aRes, sRes] = await Promise.all([
    supabase.from("user_brackets").delete().eq("user_id", userId),
    supabase.from("advancement_picks").delete().eq("user_id", userId),
    supabase.from("special_bets").delete().eq("user_id", userId),
  ]);

  const errors: string[] = [];
  if (bRes.error) errors.push(`brackets: ${bRes.error.message}`);
  if (aRes.error) errors.push(`advancement: ${aRes.error.message}`);
  if (sRes.error) errors.push(`special: ${sRes.error.message}`);

  // Audit: one entry per table actually cleared
  const audits = [];
  if (bracket) audits.push({
    admin_email: adminEmail, target_user_id: userId, table_name: "user_brackets",
    field_name: "__reset__", old_value: bracket, new_value: null, note: note || "Admin reset",
  });
  if (adv) audits.push({
    admin_email: adminEmail, target_user_id: userId, table_name: "advancement_picks",
    field_name: "__reset__", old_value: adv, new_value: null, note: note || "Admin reset",
  });
  if (special) audits.push({
    admin_email: adminEmail, target_user_id: userId, table_name: "special_bets",
    field_name: "__reset__", old_value: special, new_value: null, note: note || "Admin reset",
  });
  if (audits.length > 0) {
    await supabase.from("admin_audit_log").insert(audits);
  }

  return NextResponse.json({
    success: errors.length === 0,
    admin: adminEmail,
    userId,
    wiped: {
      bracket: !!bracket,
      advancement: !!adv,
      special: !!special,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}
