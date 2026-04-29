// ============================================================================
// WC2026 — Admin Audit Log Helper
// Writes actions to admin_audit_log table (service role only).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function logAdminAction(
  adminEmail: string,
  action: string,
  payload?: unknown,
  targetUserId?: string
): Promise<void> {
  try {
    const supabase = getServiceClient();
    if (!supabase) return;
    await supabase.from("admin_audit_log").insert({
      admin_email: adminEmail,
      target_user_id: targetUserId ?? null,
      table_name: "system",
      field_name: action,
      old_value: null,
      new_value: payload ?? null,
      note: action,
    });
  } catch {
    // Audit log failure must never break the primary action
  }
}
