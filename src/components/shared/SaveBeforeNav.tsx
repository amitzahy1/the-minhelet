"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { flushPendingSave } from "@/stores/betting-store";
import { useSaveStatus } from "@/stores/save-status-store";

/**
 * Save-BEFORE-navigate guard. When the user clicks an internal link while a bet
 * change is still unsaved (status pending/saving), we hold the navigation,
 * flush the save first — the SaveIndicator shows "שומר… → ✓ נשמר" during the
 * hold — and only then push the new route. So a pick can never be left behind
 * by a fast page switch within the betting flow.
 *
 * Safety: a 1.5s cap means we never trap the user on a slow network (the pick is
 * already in localStorage and retries on the next flush). Only plain left-clicks
 * on same-origin links to a different path are held; modified clicks, new-tab,
 * downloads and same-page hashes pass straight through. Back/forward and
 * programmatic navigation remain covered by <SaveFlushOnNav/> (a no-op once this
 * has already saved).
 */
export function SaveBeforeNav() {
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page / in-page hash

      // Only hold navigation when there's actually something to save.
      const status = useSaveStatus.getState().status;
      if (status !== "pending" && status !== "saving") return;

      e.preventDefault();
      const target = url.pathname + url.search + url.hash;
      // Save first (indicator animates), but never trap the user: navigate as
      // soon as the save resolves OR after 1.5s, whichever comes first.
      Promise.race([
        flushPendingSave(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]).finally(() => router.push(target));
    };

    document.addEventListener("click", onClick, true); // capture: run before Link's own handler
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
