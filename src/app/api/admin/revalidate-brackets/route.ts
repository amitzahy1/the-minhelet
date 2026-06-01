// ============================================================================
// /api/admin/revalidate-brackets
//
// Read-only blast-radius report for the FIFA Annex C thirds fix. For every user
// it runs the SAME pure re-validator the client uses on hydrate (revalidateTree1)
// against their stored SIMULATION tree (knockout_tree) + group predictions, and
// reports which users have picks that reference a 3rd-place team no longer in its
// slot. It does NOT write anything — the actual clear happens automatically,
// per-user, the next time each user loads the app (silent auto-clear on hydrate).
// Use this to see who is affected and ping them to re-pick before the lock.
//
// Tree 2 (knockout_tree_live) is intentionally untouched: its matchups come from
// real results, not our computation.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { revalidateTree1 } from "@/lib/tournament/revalidate-bracket";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

const EMPTY_ADVANCEMENT = {
  winner: "", finalist1: "", finalist2: "",
  semifinalists: ["", "", "", ""], quarterfinalists: ["", "", "", "", "", "", "", ""],
};

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { data, error } = await supabase
    .from("user_brackets")
    .select("user_id, group_predictions, knockout_tree, profiles(display_name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const affected: { userId: string; name: string; invalidSlots: string[]; clearedTeams: string[] }[] = [];
  let totalPicksCleared = 0;

  for (const row of data ?? []) {
    const groups = (row.group_predictions ?? {}) as Record<string, { order: number[]; scores: { home: number | null; away: number | null }[] }>;
    const knockout = (row.knockout_tree ?? {}) as Record<string, { score1: number | null; score2: number | null; winner: string | null }>;
    if (!Object.keys(knockout).length) continue;

    const res = revalidateTree1(groups, knockout, { ...EMPTY_ADVANCEMENT });
    if (res.changed) {
      const prof = row.profiles as { display_name?: string } | { display_name?: string }[] | null;
      const name = (Array.isArray(prof) ? prof[0]?.display_name : prof?.display_name) || row.user_id;
      affected.push({ userId: row.user_id, name, invalidSlots: res.invalidSlots, clearedTeams: res.clearedTeams });
      totalPicksCleared += res.invalidSlots.length;
    }
  }

  return NextResponse.json({
    totalUsers: data?.length ?? 0,
    affectedCount: affected.length,
    totalPicksCleared,
    affected,
    note: "Read-only. Each affected user's invalid picks are cleared automatically on their next app load (silent auto-clear on hydrate).",
  });
}
