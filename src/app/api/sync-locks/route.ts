import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { computePredictionLockRows, type LockSyncMatch } from "@/lib/scoring/compute-prediction-locks";

/**
 * GET/POST /api/sync-locks — refresh the server-authoritative prediction locks.
 *
 * Pulls the full schedule from /api/matches (same source + team mapping + demo
 * overlay the UI uses) and the best-thirds override, computes the per-match-day
 * (group) and per-slot (knockout) lock instants via compute-prediction-locks,
 * and upserts them into `prediction_locks` with the service role. The save RPCs
 * read this table and fail closed, so once this has run the locks are enforced
 * independently of the live feed.
 *
 * Idempotent. If the feed returns nothing (outage) it NO-OPS — it never wipes
 * the last-good rows. Runs on a cron (every 3h) and from the admin panel.
 */
async function handler() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: "Missing Supabase config" }, { status: 500 });
  }

  // Reach our own /api/matches (+ best-thirds) — same data the bracket uses.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "";
  if (!host) return NextResponse.json({ success: false, error: "No host header" }, { status: 500 });
  const origin = `${proto}://${host}`;

  let matches: LockSyncMatch[] = [];
  let thirdsOverride: string[] | null = null;
  try {
    const [m, t] = await Promise.all([
      fetch(`${origin}/api/matches`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${origin}/api/best-thirds`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ override: null })),
    ]);
    matches = (m.matches as LockSyncMatch[]) || [];
    const ov = t?.override;
    thirdsOverride = Array.isArray(ov) && ov.length === 8 ? ov : null;
  } catch (e) {
    return NextResponse.json({ success: false, error: `fetch schedule failed: ${String(e)}` }, { status: 502 });
  }

  // Feed unavailable → do NOT wipe existing locks; leave the last-good rows.
  if (!matches.length) {
    return NextResponse.json({ success: true, skipped: "no matches from feed", upserted: 0 });
  }

  const stamped = new Date().toISOString();
  const rows = computePredictionLockRows(matches, thirdsOverride).map((r) => ({ ...r, updated_at: stamped }));

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from("prediction_locks")
    .upsert(rows, { onConflict: "scope,lock_key" })
    .select("scope");
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    upserted: data?.length ?? 0,
    groups: rows.filter((r) => r.scope === "group").length,
    ko: rows.filter((r) => r.scope === "ko").length,
  });
}

export async function GET() {
  return handler();
}
export async function POST() {
  return handler();
}
