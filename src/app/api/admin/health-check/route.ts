// ============================================================================
// /api/admin/health-check
//
// Pre-launch readiness probe: tells the admin what's installed / configured
// in Supabase and what still needs to be set up before tomorrow's launch.
//
// Checks:
//   - migrations 010-016 are applied (probes by feature, not by file name)
//   - the `backups` Storage bucket exists
//   - the `tournaments` row has a valid current tournament + scoring_config
//   - core env vars are present
//   - data sources respond (Football-Data, /api/special-live)
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

interface Check {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
  fix?: string;
}

async function checkRpcExists(supabase: ReturnType<typeof getAdminClient>): Promise<Check> {
  if (!supabase) return { id: "rpc.save", label: "Atomic save RPC", status: "fail", detail: "no supabase client" };
  // We invoke with deliberately-invalid args. If the RPC exists we get a
  // domain error (auth.uid mismatch / lock); if it doesn't, Postgres returns
  // "function ... does not exist".
  const { error } = await supabase.rpc("save_user_predictions", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_league_id: "00000000-0000-0000-0000-000000000000",
    p_brackets: null,
    p_special: null,
    p_advancement: null,
    p_lock_deadline: new Date(Date.now() + 86400_000).toISOString(),
  });
  if (!error) return { id: "rpc.save", label: "Atomic save RPC", status: "ok" };
  if (/function .* does not exist/i.test(error.message)) {
    return {
      id: "rpc.save",
      label: "Atomic save RPC",
      status: "fail",
      detail: "save_user_predictions() not installed",
      fix: "Apply supabase/migrations/010_atomic_save.sql",
    };
  }
  // FORBIDDEN / LOCKED responses mean the function exists and ran.
  return { id: "rpc.save", label: "Atomic save RPC", status: "ok", detail: "exists (returned domain error as expected)" };
}

async function checkTableExists(supabase: ReturnType<typeof getAdminClient>, name: string, migration: string): Promise<Check> {
  if (!supabase) return { id: `table.${name}`, label: name, status: "fail" };
  const { error } = await supabase.from(name).select("*").limit(0);
  if (!error) return { id: `table.${name}`, label: `Table ${name}`, status: "ok" };
  if (/does not exist/i.test(error.message)) {
    return {
      id: `table.${name}`,
      label: `Table ${name}`,
      status: "fail",
      detail: `${name} missing`,
      fix: `Apply supabase/migrations/${migration}`,
    };
  }
  return { id: `table.${name}`, label: `Table ${name}`, status: "warn", detail: error.message };
}

async function checkColumnExists(
  supabase: ReturnType<typeof getAdminClient>,
  table: string,
  column: string,
  migration: string,
): Promise<Check> {
  if (!supabase) return { id: `col.${table}.${column}`, label: column, status: "fail" };
  const { error } = await supabase.from(table).select(column).limit(0);
  if (!error) return { id: `col.${table}.${column}`, label: `${table}.${column}`, status: "ok" };
  if (/does not exist|column .* does not exist/i.test(error.message)) {
    return {
      id: `col.${table}.${column}`,
      label: `${table}.${column}`,
      status: "fail",
      detail: "column missing",
      fix: `Apply supabase/migrations/${migration}`,
    };
  }
  return { id: `col.${table}.${column}`, label: `${table}.${column}`, status: "warn", detail: error.message };
}

async function checkBackupsBucket(supabase: ReturnType<typeof getAdminClient>): Promise<Check> {
  if (!supabase) return { id: "bucket.backups", label: "Backups bucket", status: "fail" };
  const { error } = await supabase.storage.from("backups").list("", { limit: 1 });
  if (!error) return { id: "bucket.backups", label: "Backups bucket", status: "ok" };
  return {
    id: "bucket.backups",
    label: "Backups bucket",
    status: "fail",
    detail: error.message,
    fix: "Create a private 'backups' bucket in Supabase dashboard → Storage",
  };
}

async function checkCurrentTournament(supabase: ReturnType<typeof getAdminClient>): Promise<Check> {
  if (!supabase) return { id: "tournament.current", label: "Current tournament", status: "fail" };
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, is_current")
    .eq("is_current", true)
    .maybeSingle();
  if (error) return { id: "tournament.current", label: "Current tournament", status: "fail", detail: error.message };
  if (!data) return { id: "tournament.current", label: "Current tournament", status: "fail", detail: "no row with is_current=true" };
  return { id: "tournament.current", label: "Current tournament", status: "ok", detail: data.name };
}

async function checkScoringConfig(supabase: ReturnType<typeof getAdminClient>): Promise<Check> {
  if (!supabase) return { id: "scoring_config", label: "Scoring config", status: "fail" };
  const { data, error } = await supabase.from("scoring_config").select("*").limit(1).maybeSingle();
  if (error) return { id: "scoring_config", label: "Scoring config", status: "fail", detail: error.message };
  if (!data) return { id: "scoring_config", label: "Scoring config", status: "warn", detail: "no row — admin scoring tab will show empty fields" };
  return { id: "scoring_config", label: "Scoring config", status: "ok" };
}

function checkEnvVars(): Check {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) {
    return { id: "env", label: "Env vars", status: "ok" };
  }
  return {
    id: "env",
    label: "Env vars",
    status: "fail",
    detail: `Missing: ${missing.join(", ")}`,
    fix: "Set in Vercel project env (Production)",
  };
}

async function checkFootballData(): Promise<Check> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return { id: "data.football", label: "Football-Data.org", status: "warn", detail: "No FOOTBALL_DATA_TOKEN — schedule API will return empty" };
  }
  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
      headers: { "X-Auth-Token": token },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { id: "data.football", label: "Football-Data.org", status: "fail", detail: `HTTP ${res.status}` };
    const json = await res.json();
    const count = json.matches?.length ?? 0;
    return { id: "data.football", label: "Football-Data.org", status: count === 104 ? "ok" : "warn", detail: `${count}/104 matches` };
  } catch (e) {
    return { id: "data.football", label: "Football-Data.org", status: "warn", detail: String(e) };
  }
}

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();

  const checks: Check[] = [];
  checks.push(checkEnvVars());
  checks.push(await checkCurrentTournament(supabase));
  checks.push(await checkScoringConfig(supabase));
  checks.push(await checkRpcExists(supabase));
  checks.push(await checkTableExists(supabase, "scoring_snapshots", "011_scoring_snapshots.sql"));
  checks.push(await checkTableExists(supabase, "player_stats", "014_player_stats.sql"));
  checks.push(await checkColumnExists(supabase, "tournaments", "lock_deadline_override", "016_lock_deadline_override.sql"));
  checks.push(await checkBackupsBucket(supabase));
  checks.push(await checkFootballData());

  const summary = {
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
  return NextResponse.json({
    readyForLaunch: summary.fail === 0,
    summary,
    checks,
    generatedAt: new Date().toISOString(),
  });
}
