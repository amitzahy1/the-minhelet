import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/best-thirds
 * Public — returns the admin-entered override (if any) for the 8 group letters
 * whose 3rd-placed teams advance to R32. When `override` is null, callers
 * should compute the ranking live from match results.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ override: null });
  }

  const supabase = createClient(url, serviceKey);

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_current", true)
    .single();

  if (!tournament) return NextResponse.json({ override: null });

  const { data } = await supabase
    .from("tournament_actuals")
    .select("best_thirds_override")
    .eq("tournament_id", tournament.id)
    .maybeSingle();

  return NextResponse.json({ override: data?.best_thirds_override ?? null });
}
