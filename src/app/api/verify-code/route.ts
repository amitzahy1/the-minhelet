import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// League codes — stored server-side, never sent to client
const VALID_CODES = (process.env.LEAGUE_CODES || "minhelet26").split(",");

export async function POST(request: Request) {
  try {
    // Rate limit: max 10 attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!rateLimit(ip, 10, 60000)) {
      return NextResponse.json({ valid: false, error: "יותר מדי ניסיונות — נסו שוב בעוד דקה" }, { status: 429 });
    }

    const { code } = await request.json();

    if (!code || typeof code !== "string" || code.length > 50) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // Only allow alphanumeric + basic chars
    const sanitized = code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const isValid = VALID_CODES.includes(sanitized);
    return NextResponse.json({ valid: isValid });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
