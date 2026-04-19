import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

/**
 * /api/admin/results
 *   GET  → list all rows from demo_match_results
 *   POST → bulk upsert one or more results
 *
 * Body for POST:
 *   { results: Array<{ match_id, stage, home_team, away_team, home_goals?, away_goals?,
 *                      home_penalties?, away_penalties?, status?, scheduled_at?, group_id? }> }
 *
 * match_id is the external Football-Data.org id as a string, or any stable id
 * you want to use. We sidestep the matches.id FK to teams.
 */

type Result = {
  match_id: string;
  stage: string;
  group_id?: string | null;
  home_team: string;
  away_team: string;
  home_goals?: number | null;
  away_goals?: number | null;
  home_penalties?: number | null;
  away_penalties?: number | null;
  status?: string;
  scheduled_at?: string | null;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const { data, error } = await supabase
    .from("demo_match_results")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data || [] });
}

export async function POST(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let body: { results?: Result[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results = body.results;
  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "results array is required" }, { status: 400 });
  }

  const rows = results.map((r) => {
    // Group may arrive as "GROUP_A", "Group A", or plain "A" — DB column is CHAR(1).
    let g: string | null = null;
    if (r.group_id) {
      const m = r.group_id.toString().match(/([A-L])/i);
      g = m ? m[1].toUpperCase() : null;
    }
    return {
    match_id: String(r.match_id),
    stage: r.stage,
    group_id: g,
    home_team: r.home_team,
    away_team: r.away_team,
    home_goals: r.home_goals ?? null,
    away_goals: r.away_goals ?? null,
    home_penalties: r.home_penalties ?? null,
    away_penalties: r.away_penalties ?? null,
    status: r.status ?? "FINISHED",
    scheduled_at: r.scheduled_at ?? null,
    entered_by: adminEmail,
    updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase
    .from("demo_match_results")
    .upsert(rows, { onConflict: "match_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, upserted: data?.length ?? 0, results: data });
}

export async function DELETE(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("match_id");
  if (!matchId) return NextResponse.json({ error: "match_id is required" }, { status: 400 });

  const { error } = await supabase.from("demo_match_results").delete().eq("match_id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
