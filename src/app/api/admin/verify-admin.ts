import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

/**
 * Verify the requesting user is an admin.
 * Reads the auth cookie from the request headers.
 * Returns the admin email if valid, null otherwise.
 */
export async function verifyAdmin(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) return null;

  try {
    // Get the user's session from cookies
    const headersList = await headers();
    const cookie = headersList.get("cookie") || "";

    // Create a client with the anon key to read the user's session
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookie.split(";").map(c => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll() {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;

    // Check if user is in admins table using service role
    const adminClient = createClient(url, serviceKey);
    const { data: admin } = await adminClient
      .from("admins")
      .select("email")
      .eq("email", user.email)
      .single();

    return admin ? user.email : null;
  } catch {
    return null;
  }
}
