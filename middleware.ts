import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Skip all auth middleware until Supabase is configured
  if (!supabaseUrl || supabaseUrl.includes("your-project")) {
    return NextResponse.next();
  }

  // Once Supabase is configured, use the full auth middleware
  const { updateSession } = await import("@/lib/supabase/middleware");
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|flags/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
