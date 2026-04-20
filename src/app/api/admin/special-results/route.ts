import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

/**
 * /api/admin/special-results
 *   GET  → current tournament_actuals row (or null)
 *   POST → upsert actuals for the current tournament, audit-logged
 */

const SPECIAL_FIELDS = [
  "top_scorer_player", "top_scorer_team", "top_scorer_goals",
  "top_assists_player", "top_assists_team", "top_assists_count",
  "best_attack_team", "best_attack_goals",
  "dirtiest_team", "dirtiest_team_cards",
  "most_prolific_group", "most_prolific_goals",
  "driest_group", "driest_group_goals",
  "matchup_result_1", "matchup_result_2", "matchup_result_3",
  "total_penalties", "penalties_over_under",
  "champion",
] as const;

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

async function getCurrentTournamentId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const tournamentId = await getCurrentTournamentId(supabase);
  if (!tournamentId) return NextResponse.json({ tournamentId: null, actuals: null });

  const { data } = await supabase
    .from("tournament_actuals")
    .select("*")
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  return NextResponse.json({ tournamentId, actuals: data ?? null });
}

export async function POST(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const tournamentId = await getCurrentTournamentId(supabase);
  if (!tournamentId) return NextResponse.json({ error: "No active tournament" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Load existing to compute diff for the audit log.
  const { data: existing } = await supabase
    .from("tournament_actuals")
    .select("*")
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  const updates: Record<string, unknown> = { tournament_id: tournamentId };
  const changed: string[] = [];
  for (const f of SPECIAL_FIELDS) {
    if (!(f in body)) continue;
    const incoming = body[f] ?? null;
    updates[f] = incoming;
    if (JSON.stringify(existing?.[f] ?? null) !== JSON.stringify(incoming)) {
      changed.push(f);
    }
  }
  updates["entered_by"] = adminEmail;
  updates["updated_at"] = new Date().toISOString();

  if (changed.length === 0) {
    return NextResponse.json({ success: true, changed: 0, message: "אין שינויים" });
  }

  const { error } = await supabase
    .from("tournament_actuals")
    .upsert(updates, { onConflict: "tournament_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Single aggregate audit entry for the tournament-level change (target_user_id
  // is nullable after migration 007 for tournament-wide events).
  const { error: auditErr } = await supabase.from("admin_audit_log").insert({
    admin_email: adminEmail,
    target_user_id: null,
    table_name: "tournament_actuals",
    field_name: "special_results_bulk",
    old_value: existing ?? null,
    new_value: updates,
    note: `Updated ${changed.length} actual fields: ${changed.join(", ")}`,
  });
  if (auditErr) console.error("Audit log failed:", auditErr.message);

  return NextResponse.json({
    success: true,
    tournamentId,
    changed: changed.length,
    changedFields: changed,
  });
}
