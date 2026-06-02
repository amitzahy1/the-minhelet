"use client";

// ============================================================================
// VersionWatcher — detects when a newer version has been deployed and offers a
// one-tap reload. Critical for the standalone iOS PWA (no service worker): iOS
// caches the app shell and never revalidates on its own, so users get "stuck" on
// an old version. We check the deployed build id (/api/version, no-store):
//   • on mount
//   • on `visibilitychange` → visible — fires when the user RE-OPENS the
//     home-screen app, which is exactly when iOS would otherwise show stale UI
//   • on window focus
//   • every 2 minutes while open
// On mismatch we show a small banner; tapping it does a full reload, which (with
// the must-revalidate document header) fetches the fresh HTML + new asset hashes.
// ============================================================================

import { useEffect, useState } from "react";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID || "";

export function VersionWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // Don't nag in local dev (HMR rebuilds change the id constantly).
    if (!CURRENT || CURRENT.startsWith("dev-")) return;
    let alive = true;
    let done = false;

    const check = async () => {
      if (done || !alive) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (alive && buildId && buildId !== "unknown" && buildId !== CURRENT) {
          done = true;
          setStale(true);
        }
      } catch {
        /* offline / transient — try again on the next trigger */
      }
    };

    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const id = setInterval(check, 120_000);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      clearInterval(id);
    };
  }, []);

  if (!stale) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 inset-x-0 z-[120] flex justify-center px-4 pointer-events-none" dir="rtl">
      <button
        onClick={() => window.location.reload()}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-blue-600 text-white font-bold text-sm px-5 py-3 shadow-xl ring-2 ring-white hover:bg-blue-700 transition-colors animate-pulse"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        גרסה חדשה זמינה — הקש לרענון
      </button>
    </div>
  );
}
