"use client";

// ============================================================================
// NavProgressBar — top-of-page progress strip that animates in on every
// route change and fades out when the destination has rendered. Gives mobile
// users immediate feedback that "yes, something is happening" instead of
// the apparent 2-second freeze when they tap a nav icon.
// ============================================================================

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Every pathname/search change: kick off a fresh animation.
    setActive(true);
    setWidth(8);
    const t1 = setTimeout(() => setWidth(30), 50);
    const t2 = setTimeout(() => setWidth(60), 200);
    const t3 = setTimeout(() => setWidth(85), 600);
    const t4 = setTimeout(() => setWidth(98), 1200);
    // After 1.5s assume the page has rendered; complete the bar and fade.
    const t5 = setTimeout(() => setWidth(100), 1500);
    const t6 = setTimeout(() => setActive(false), 1900);
    return () => { [t1, t2, t3, t4, t5, t6].forEach(clearTimeout); };
  }, [pathname, search]);

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[60] pointer-events-none transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!active}
    >
      <div
        className="h-0.5 bg-gradient-to-l from-blue-500 via-indigo-500 to-purple-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-[width] ease-out"
        style={{ width: `${width}%`, transitionDuration: width >= 100 ? "200ms" : "400ms" }}
      />
    </div>
  );
}
