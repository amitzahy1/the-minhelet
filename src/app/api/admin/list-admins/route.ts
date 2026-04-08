import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ admins: [], error: "Unauthorized" }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ admins: [] });

  try {
    const supabase = createClient(url, serviceKey);
    const { data, error } = await supabase.from("admins").select("email, role, display_name, created_at");
    if (error) return NextResponse.json({ admins: [], error: error.message });
    return NextResponse.json({ admins: data || [] });
  } catch (e) {
    return NextResponse.json({ admins: [], error: String(e) });
  }
}
