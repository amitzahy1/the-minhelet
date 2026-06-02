"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { flushPendingSave } from "@/stores/betting-store";

/**
 * Flush any pending (debounced) bet-save the moment the route changes, so a
 * pick made on one betting page is persisted to Supabase BEFORE the user lands
 * on the next page — instead of waiting out the debounce window. The betting
 * store + its debounce timer are module-level (they survive client-side
 * navigation), so flushing here saves the just-edited state reliably.
 *
 * Mounted once in the (app) layout. Renders nothing.
 */
export function SaveFlushOnNav() {
  const pathname = usePathname();
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname;
      void flushPendingSave();
    }
  }, [pathname]);

  return null;
}
