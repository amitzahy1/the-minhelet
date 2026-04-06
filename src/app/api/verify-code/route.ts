import { NextResponse } from "next/server";

// League codes — stored server-side, never sent to client
const VALID_CODES = [
  "minhelet26",
  // Add more codes here if needed
];

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const isValid = VALID_CODES.includes(code.trim().toLowerCase());
    return NextResponse.json({ valid: isValid });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
