// ============================================================================
// /api/version — returns the build id of the CURRENTLY DEPLOYED server.
//
// The client bundle has its own build id baked in (NEXT_PUBLIC_BUILD_ID). When a
// new version is deployed, this endpoint returns the new id while an old (cached)
// client still reports the old one → the client shows a "refresh" prompt. This is
// the update path for the standalone iOS PWA, which has no service worker and
// otherwise caches the app shell indefinitely. Never cached (no-store).
// ============================================================================

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown" },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
