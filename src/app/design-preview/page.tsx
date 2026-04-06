"use client";

import { useState } from "react";
import { GroupsPage } from "./pages/groups-page";
import { BracketPage } from "./pages/bracket-page";
import { LeaderboardPage } from "./pages/leaderboard-page";
import { LivePage } from "./pages/live-page";
import { SquadsPage } from "./pages/squads-page";
import { SpecialBetsPage } from "./pages/special-bets-page";

type Page = "groups" | "bracket" | "special-bets" | "squads" | "leaderboard" | "live";

// SVG icons — clean, professional, no emojis
const Icons = {
  groups: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  bracket: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v4M18 3v4M6 17v4M18 17v4M6 7h4v4H6zM14 7h4v4h-4zM10 9h4M6 13v4h4v-4M14 13v4h4v-4M10 15h4" />
    </svg>
  ),
  specialBets: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  squads: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  leaderboard: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  live: (active: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
    </svg>
  ),
};

const PAGES: { key: Page; label: string; iconKey: keyof typeof Icons }[] = [
  { key: "groups", label: "שלב הבתים", iconKey: "groups" },
  { key: "special-bets", label: "הימורים מיוחדים", iconKey: "specialBets" },
  { key: "bracket", label: "עץ טורניר", iconKey: "bracket" },
  { key: "leaderboard", label: "דירוג", iconKey: "leaderboard" },
  { key: "live", label: "לייב", iconKey: "live" },
  { key: "squads", label: "נבחרות", iconKey: "squads" },
];

export default function DesignPreviewPage() {
  const [activePage, setActivePage] = useState<Page>("groups");

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FB", fontFamily: "var(--font-assistant), sans-serif" }} dir="rtl">
      {/* Desktop top nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-20 px-6">
          {/* Logo + Title */}
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="The Minhelet" className="w-18 h-18 rounded-full object-cover shadow-md" />
            <div className="flex flex-col">
              <span className="font-bold text-xl text-gray-900 leading-tight tracking-tight" style={{ fontFamily: "var(--font-secular), sans-serif" }}>THE MINHELET</span>
              <span className="text-sm text-gray-400 tracking-wide font-medium" style={{ fontFamily: "var(--font-inter), sans-serif" }}>FIFA WORLD CUP 2026 · USA</span>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1.5">
            {PAGES.map((p) => {
              const isActive = activePage === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setActivePage(p.key)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold transition-all ${
                    isActive
                      ? "bg-gray-900 text-white shadow-md"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  {Icons[p.iconKey](isActive)}
                  <span className="hidden lg:inline">{p.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-base font-bold text-white shadow-md">
            א
          </div>
        </div>
      </header>

      {/* Page content */}
      <main>
        {activePage === "groups" && <GroupsPage />}
        {activePage === "bracket" && <BracketPage />}
        {activePage === "leaderboard" && <LeaderboardPage />}
        {activePage === "live" && <LivePage />}
        {activePage === "squads" && <SquadsPage />}
        {activePage === "special-bets" && <SpecialBetsPage />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center h-18 z-50 sm:hidden shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        {PAGES.map((p) => {
          const isActive = activePage === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setActivePage(p.key)}
              className={`flex flex-col items-center gap-1 py-1.5 ${
                isActive ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {Icons[p.iconKey](isActive)}
              <span className="text-[10px] font-bold">{p.label}</span>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-gray-900"></div>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
