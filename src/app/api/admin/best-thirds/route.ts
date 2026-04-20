import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

const GROUP_LETTERS = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);

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
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const tournamentId = await getCurrentTournamentId(supabase);
  if (!tournamentId) return NextResponse.json({ override: null });

  const { data, error } = await supabase
    .from("tournament_actuals")
    .select("best_thirds_override")
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ override: data?.best_thirds_override ?? null });
}

/**
 * POST /api/admin/best-thirds
 * Body: { groups: string[] | null }
 *   - null or empty array clears the override (revert to auto).
 *   - an array of exactly 8 group letters saves the manual override.
 */
export async function POST(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let body: { groups?: string[] | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.groups;
  let override: string[] | null = null;

  if (Array.isArray(raw) && raw.length > 0) {
    const normalized = raw.map((g) => String(g).toUpperCase().trim());
    const allValid = normalized.every((g) => GROUP_LETTERS.has(g));
    const unique = new Set(normalized).size === normalized.length;
    if (!allValid || !unique || normalized.length !== 8) {
      return NextResponse.json(
        { error: "groups must be exactly 8 unique group letters (A-L)" },
        { status: 400 },
      );
    }
    override = normalized.sort();
  }

  const tournamentId = await getCurrentTournamentId(supabase);
  if (!tournamentId) {
    return NextResponse.json({ error: "No active tournament" }, { status: 400 });
  }

  const { error } = await supabase
    .from("tournament_actuals")
    .upsert(
      {
        tournament_id: tournamentId,
        best_thirds_override: override,
        entered_by: adminEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tournament_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, override });
}
