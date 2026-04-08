import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ users: [], error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ users: [], error: "Missing Supabase config" });
  }

  try {
    const supabase = createClient(url, serviceKey);
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ users: [], error: error.message });
    }

    const users = (data.users || []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "",
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      provider: u.app_metadata?.provider || "email",
    }));

    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json({ users: [], error: String(e) });
  }
}
