import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { seedBot, BOT_EMAIL } from "@/lib/bot-seed";

/**
 * /api/admin/bot
 *
 * GET  → status of the bot user (exists? has bets?)
 * POST → create bot (if missing), regenerate all predictions, save to DB.
 *        Overwrites existing bot bets (bot is a synthetic account we own).
 *
 * The create/generate/persist logic lives in src/lib/bot-seed.ts so the
 * scripts/seed-bot.ts CLI shares exactly the same path.
 */

function getAdminClient(): SupabaseClient | null {
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

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const bot = authUsers?.users?.find((u) => u.email === BOT_EMAIL);
  if (!bot) return NextResponse.json({ exists: false });

  const { data: bracket } = await supabase
    .from("user_brackets")
    .select("user_id, updated_at")
    .eq("user_id", bot.id)
    .maybeSingle();

  return NextResponse.json({
    exists: true,
    userId: bot.id,
    email: bot.email,
    hasBets: !!bracket,
    updatedAt: bracket?.updated_at ?? null,
  });
}

export async function POST() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let result;
  try {
    result = await seedBot(supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "No league found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  await supabase.from("admin_audit_log").insert({
    admin_email: adminEmail,
    target_user_id: result.botUserId,
    table_name: "user_brackets",
    field_name: "bot_generate",
    old_value: null,
    new_value: { champion: result.champion, rationale_count: result.rationale.length },
    note: `Bot auto-filled by ${adminEmail}`,
  });

  return NextResponse.json({ success: true, ...result });
}
