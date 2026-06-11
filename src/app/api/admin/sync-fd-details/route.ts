// ============================================================================
// /api/admin/sync-fd-details
//
// Auto-fetches venue + referees from Football-Data.org for matches whose
// details we don't already have. Designed to be called by Vercel cron daily.
//
// Strategy: only sync matches scheduled within ?windowHours (default 72)
// that don't already have a venue OR a referee list, plus any match in
// "IN_PLAY" or "LIVE" status. Football-Data populates these ~24-48h before
// kickoff, so a 72h window catches every upcoming match without burning
// through the 10/min rate limit. Throttled 7s between calls — at most
// ~10-15 matches per invocation, well within Vercel's 5-minute timeout.
//
// Auth: admin cookie OR service-role bearer (for the cron).
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { logAdminAction } from "@/lib/audit";
import * as fs from "fs";
import * as path from "path";

const BASE = "https://api.football-data.org/v4";

interface DetailEntry {
  venue: string | null;
  referees: { name: string; role: string; nationality: string | null }[];
  stage: string | null;
  status: string | null;
}
interface DetailsFile {
  syncedAt: string;
  matches: Record<string, DetailEntry>;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status?: string;
  stage?: string;
}

interface FdReferee { name: string; type?: string; nationality?: string }
interface FdDetail {
  venue?: string | null;
  status?: string;
  stage?: string;
  referees?: FdReferee[];
}

async function isAuthorized(req: Request): Promise<{ ok: boolean; who: string }> {
  // Vercel cron jobs hit the route with an x-vercel-cron header (or signed
  // signature). They do NOT automatically include an Authorization bearer
  // unless the CRON_SECRET env var is set. Accept any of:
  //   - admin session cookie (manual trigger from /admin)
  //   - Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}  (scripts)
  //   - Authorization: Bearer ${CRON_SECRET}                (Vercel cron)
  //   - x-vercel-cron header set                            (Vercel cron, fallback)
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token && (token === process.env.SUPABASE_SERVICE_ROLE_KEY || token === process.env.CRON_SECRET)) {
      return { ok: true, who: "bearer" };
    }
  }
  if (req.headers.get("x-vercel-cron")) {
    return { ok: true, who: "vercel-cron" };
  }
  const adminEmail = await verifyAdmin();
  if (adminEmail) return { ok: true, who: adminEmail };
  return { ok: false, who: "" };
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return (await r.json()) as T;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function POST(req: Request) {
  const auth = await isAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return NextResponse.json({ error: "No FOOTBALL_DATA_TOKEN" }, { status: 500 });

  const url = new URL(req.url);
  const windowHours = Number(url.searchParams.get("windowHours") || "72");
  const maxMatches = Number(url.searchParams.get("max") || "15");
  const throttleMs = Number(url.searchParams.get("throttleMs") || "7000");
  const force = url.searchParams.get("force") === "1";

  const headers = { "X-Auth-Token": token };

  // Load existing details file (read-only path during build; we write to a
  // Supabase Storage bucket instead so Vercel deployments don't fight the FS).
  const detailsPath = path.join(process.cwd(), "src/lib/tournament/fd-match-details.json");
  let existing: DetailsFile = { syncedAt: new Date(0).toISOString(), matches: {} };
  try { existing = JSON.parse(fs.readFileSync(detailsPath, "utf8")); } catch { /* fall back to empty */ }

  // 1. Pull match list, decide which IDs we still need.
  const list = await fetchJson<{ matches?: FdMatch[] }>(
    `${BASE}/competitions/WC/matches?season=2026`,
    headers,
  );
  const nowMs = Date.now();
  const windowEnd = nowMs + windowHours * 3600_000;
  const candidates = (list.matches || []).filter((m) => {
    const t = Date.parse(m.utcDate);
    const inWindow = t >= nowMs - 6 * 3600_000 && t <= windowEnd;
    const live = m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "LIVE";
    return inWindow || live;
  });

  const needSync = candidates.filter((m) => {
    if (force) return true;
    const e = existing.matches?.[String(m.id)];
    if (!e) return true;
    return !e.venue && (e.referees?.length ?? 0) === 0;
  });

  // 2. Persist to Supabase Storage so a serverless function can write it.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    : null;

  const updates: Record<string, DetailEntry> = {};
  let fetched = 0;
  let venueAdds = 0;
  let refereeAdds = 0;
  let timeBudgetExceeded = false;
  const started = Date.now();
  const HARD_LIMIT_MS = 240_000; // stay well under Vercel's 5-min serverless cap

  for (const m of needSync.slice(0, maxMatches)) {
    if (Date.now() - started > HARD_LIMIT_MS) { timeBudgetExceeded = true; break; }
    try {
      const d = await fetchJson<FdDetail>(`${BASE}/matches/${m.id}`, headers);
      const entry: DetailEntry = {
        venue: d.venue ?? null,
        status: d.status ?? m.status ?? null,
        stage: d.stage ?? m.stage ?? null,
        referees: (d.referees || []).map((r) => ({
          name: r.name,
          role: r.type || "REFEREE",
          nationality: r.nationality || null,
        })),
      };
      updates[String(m.id)] = entry;
      if (entry.venue) venueAdds++;
      if (entry.referees.length > 0) refereeAdds++;
      fetched++;
    } catch (e) {
      // ignore single failures; cron will retry tomorrow
      void e;
    }
    await sleep(throttleMs);
  }

  // Merge into existing details and persist to Storage.
  const merged: DetailsFile = {
    syncedAt: new Date().toISOString(),
    matches: { ...existing.matches, ...updates },
  };

  let storageWrote = false;
  if (supabase) {
    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
    const { error } = await supabase.storage
      .from("backups")
      .upload("fd-match-details-latest.json", blob, { contentType: "application/json", upsert: true });
    if (!error) storageWrote = true;
  }

  await logAdminAction(auth.who, "sync_fd_details", {
    fetched,
    venueAdds,
    refereeAdds,
    candidates: candidates.length,
    needSync: needSync.length,
    timeBudgetExceeded,
    storageWrote,
  });

  return NextResponse.json({
    ok: true,
    fetched,
    venueAdds,
    refereeAdds,
    candidates: candidates.length,
    needSync: needSync.length,
    timeBudgetExceeded,
    storageWrote,
    syncedAt: merged.syncedAt,
  });
}

export async function GET(req: Request) {
  // Vercel cron hits routes with GET — run the sync for cron/bearer callers.
  // Without this the 4-daily crons 403'd and the details sync never ran.
  const auth = await isAuthorized(req);
  if (auth.ok && (auth.who === "vercel-cron" || auth.who === "bearer")) {
    return POST(req);
  }

  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  return NextResponse.json({
    hint: "POST this endpoint. Optional query params: windowHours (default 72), max (default 15), force=1 to refetch, throttleMs (default 7000).",
  });
}
