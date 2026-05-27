// ============================================================================
// /api/admin/player-stats
//
// Admin-only patch for the `player_stats` table — used when the
// Football-Data.org feed lags (which it does in the free tier, sometimes by
// 24h). Patching here propagates to the live tentative special-bets scoring
// immediately. Each row keys on player_name.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { logAdminAction } from "@/lib/audit";

interface PlayerStatRow {
  player_name: string;
  team_code?: string | null;
  goals?: number;
  assists?: number;
  minutes?: number;
  yellow_cards?: number;
  red_cards?: number;
}

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
    .from("player_stats")
    .select("*")
    .order("goals", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stats: data || [] });
}

export async function POST(req: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const body = await req.json().catch(() => null) as { stats?: PlayerStatRow[] } | null;
  if (!body?.stats || !Array.isArray(body.stats)) {
    return NextResponse.json({ error: "stats[] is required" }, { status: 400 });
  }

  const rows = body.stats.map((s) => ({
    player_name: s.player_name,
    team_code: s.team_code ?? null,
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    minutes: s.minutes ?? 0,
    yellow_cards: s.yellow_cards ?? 0,
    red_cards: s.red_cards ?? 0,
    source: adminEmail,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("player_stats")
    .upsert(rows, { onConflict: "player_name" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(adminEmail, "player_stats_upsert", { rows: rows.length });
  return NextResponse.json({ ok: true, updated: rows.length });
}

export async function DELETE(req: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const url = new URL(req.url);
  const player = url.searchParams.get("player");
  if (!player) return NextResponse.json({ error: "player query param required" }, { status: 400 });

  const { error } = await supabase.from("player_stats").delete().eq("player_name", player);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction(adminEmail, "player_stats_delete", { player });
  return NextResponse.json({ ok: true });
}
