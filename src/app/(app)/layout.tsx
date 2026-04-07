"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useBettingStore } from "@/stores/betting-store";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DeadlineCountdown } from "@/components/shared/DeadlineCountdown";

const Icons = {
  bets: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9 15l3 3 3-3"/></svg>,
  leaderboard: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  compare: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 3v18M3 12h18"/></svg>,
  rules: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  live: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>,
  squads: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

// Sub-pages under "הימורי משתמש"
const BETTING_PAGES = [
  { href: "/groups", label: "שלב הבתים", step: 1 },
  { href: "/knockout", label: "עץ טורניר", step: 2 },
  { href: "/special-bets", label: "הימורים מיוחדים", step: 3 },
];

const NAV_ITEMS = [
  { href: "/standings", label: "דירוג", iconKey: "leaderboard" as const },
  { href: "/compare", label: "השוואה", iconKey: "compare" as const },
  { href: "/what-if", label: "מה אם?", iconKey: "compare" as const },
  { href: "/schedule", label: "לו״ז", iconKey: "live" as const },
  { href: "/live", label: "לייב", iconKey: "live" as const },
  { href: "/squads", label: "נבחרות", iconKey: "squads" as const },
  { href: "/rules", label: "חוקים", iconKey: "rules" as const },
];

// ============================================================================
// Onboarding Wizard — multi-page tutorial
// ============================================================================
function OnboardingWizard({ onDismiss, onStart }: { onDismiss: () => void; onStart: () => void }) {
  const [page, setPage] = useState(0);
  const isLast = page === 2;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[85vh] flex flex-col">

        {/* Header — clean, white */}
        <div className="px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="w-12 h-12 rounded-full shadow-md" />
              <span className="font-black text-lg text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>The Minhelet</span>
            </div>
            <span className="text-sm text-gray-400 font-bold" style={{ fontFamily: "var(--font-inter)" }}>{page + 1}/3</span>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className={`h-1.5 rounded-full flex-1 transition-all ${i <= page ? "bg-blue-600" : "bg-gray-200"}`}></div>
            ))}
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {page === 0 && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <h2 className="text-2xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>ברוכים הבאים!</h2>
                <p className="text-base text-gray-500 mt-1">מונדיאל 2026 — 48 נבחרות, 104 משחקים</p>
              </div>
              <p className="text-base text-gray-700 leading-relaxed">
                לפניכם 3 משימות שצריך להשלים <strong>לפני שהטורניר מתחיל</strong>. כל ההימורים ננעלים ב-10 ביוני.
              </p>
              <div className="space-y-3">
                {[
                  { step: "1", title: "שלב הבתים", desc: "הזינו תוצאות ל-72 משחקים בבתים", color: "bg-blue-50 border-blue-200 text-blue-700" },
                  { step: "2", title: "עץ הנוק-אאוט", desc: "תוצאות מהשמינית ועד הגמר", color: "bg-amber-50 border-amber-200 text-amber-700" },
                  { step: "3", title: "הימורים מיוחדים", desc: "מי זוכה, עולות, מלך שערים ועוד", color: "bg-purple-50 border-purple-200 text-purple-700" },
                ].map(s => (
                  <div key={s.step} className={`flex items-center gap-3 rounded-xl border p-3 ${s.color}`}>
                    <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-black shadow-sm">{s.step}</span>
                    <div>
                      <p className="font-bold text-sm">{s.title}</p>
                      <p className="text-xs opacity-80">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>שלב הבתים</h2>
              <p className="text-base text-gray-600 leading-relaxed">
                בכל אחד מ-12 הבתים יש 4 נבחרות שמשחקות אחת נגד השנייה (6 משחקים בכל בית).
              </p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                <p className="font-bold text-gray-800">מה עושים:</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="flex gap-2"><span className="font-black text-blue-600">①</span> הזינו <strong>תוצאה מדויקת</strong> לכל 6 המשחקים בכל בית</p>
                  <p className="flex gap-2"><span className="font-black text-blue-600">②</span> הטבלה מתעדכנת <strong>אוטומטית</strong> לפי התוצאות שהזנתם</p>
                  <p className="flex gap-2"><span className="font-black text-blue-600">③</span> המערכת מחשבת נקודות, הפרש שערים ושוברי שוויון לפי FIFA</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                2 המובילות מכל בית + 8 מקומות שלישיים עולות לשלב הנוק-אאוט.
              </p>
            </div>
          )}

          {page === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>הימורים מיוחדים + בראקט</h2>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="font-bold text-gray-800 mb-2">הימורים מיוחדים:</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  בחרו מי <strong>זוכה</strong> בטורניר, מי עולה ל<strong>גמר</strong>, <strong>חצי</strong> ו<strong>רבע</strong>.
                  בנוסף: מלך שערים, מלך בישולים, כסחנית, מאצ׳אפים ועוד.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="font-bold text-gray-800 mb-2">עץ הנוק-אאוט:</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  הנבחרות שהעליתם מהבתים מופיעות <strong>אוטומטית</strong> בשמינית.
                  הזינו תוצאה ובחרו מי עולה בכל משחק — עד הגמר.
                  אם תיקו, בחרו מי מנצחת בפנדלים.
                </p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center">
                <p className="text-sm text-amber-800 font-bold">ניקוד מלא ושוברי שוויון — בדף ״חוקים״ בתפריט</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          {page > 0 ? (
            <button onClick={() => setPage(page - 1)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">→ הקודם</button>
          ) : (
            <button onClick={onDismiss} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600">דלג</button>
          )}
          {isLast ? (
            <button onClick={onStart} className="px-8 py-3 rounded-xl bg-gray-900 text-white font-bold shadow-md hover:bg-gray-800 transition-colors">
              בואו נתחיל!
            </button>
          ) : (
            <button onClick={() => setPage(page + 1)} className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 transition-colors">
              הבא ←
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBetsMenu, setShowBetsMenu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    useBettingStore.persist.rehydrate();
    // Ensure light mode
    document.documentElement.classList.remove("dark");
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "");
        setUserEmail(user.email || "");
        // Show onboarding on first visit
        const seen = localStorage.getItem("wc2026-onboarding-seen");
        if (!seen) setShowOnboarding(true);
      }
    });
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("wc2026-onboarding-seen", "true");
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const totalFilled = useBettingStore((s) => s.getTotalFilledMatches());
  const totalPossible = 72 + 31;
  const initial = userName ? userName[0].toUpperCase() : userEmail ? userEmail[0].toUpperCase() : "?";
  const isBettingPage = BETTING_PAGES.some(p => pathname === p.href);

  return (
    <div className="min-h-screen pb-20 sm:pb-0 bg-[#F8F9FB]" style={{ fontFamily: "var(--font-assistant), sans-serif" }} dir="rtl">

      {/* === ONBOARDING WIZARD (multi-step) === */}
      {showOnboarding && <OnboardingWizard onDismiss={dismissOnboarding} onStart={() => { dismissOnboarding(); router.push("/groups"); }} />}

      {/* === DESKTOP NAV === */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 lg:h-20 px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="The Minhelet" className="w-14 h-14 lg:w-20 lg:h-20 rounded-full object-cover shadow-lg" />
            <div className="flex flex-col">
              <span className="font-bold text-base lg:text-xl text-gray-900 leading-tight tracking-tight" style={{ fontFamily: "var(--font-secular)" }}>THE MINHELET</span>
              <span className="text-xs lg:text-sm text-gray-400 tracking-wide font-medium" style={{ fontFamily: "var(--font-inter)" }}>WORLD CUP 2026</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {/* הימורי משתמש — dropdown */}
            <div className="relative">
              <button onClick={() => setShowBetsMenu(!showBetsMenu)}
                className={`flex items-center gap-2 px-3 lg:px-5 py-2 lg:py-3 rounded-xl text-sm lg:text-base font-bold transition-all ${
                  isBettingPage ? "bg-gradient-to-l from-blue-600 to-indigo-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-100"
                }`}>
                {Icons.bets(isBettingPage)}
                <span className="hidden lg:inline">הימורי משתמש</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ms-0.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showBetsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBetsMenu(false)}></div>
                  <div className="absolute top-full mt-2 start-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-56">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-400 font-bold">3 שלבים להשלמת ההימורים</p>
                    </div>
                    {BETTING_PAGES.map(p => (
                      <Link key={p.href} href={p.href}
                        onClick={() => setShowBetsMenu(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                          pathname === p.href ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                        }`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          pathname === p.href ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                        }`}>{p.step}</span>
                        {p.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Regular nav items */}
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2 px-3 lg:px-5 py-2 lg:py-3 rounded-xl text-sm lg:text-base font-bold transition-all ${
                    isActive ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}>
                  {Icons[item.iconKey](isActive)}
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="relative">
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="hidden lg:block text-end">
                <p className="text-sm font-bold text-gray-900 leading-tight">{userName || "משתמש"}</p>
                <p className="text-xs text-gray-400">{userEmail}</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-sm lg:text-base font-bold text-white shadow-md">
                {initial}
              </div>
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                <div className="absolute top-full mt-2 end-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-56">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{userName}</p>
                    <p className="text-xs text-gray-400">{userEmail}</p>
                  </div>
                  <Link href="/admin" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setShowUserMenu(false)}>ניהול מערכת</Link>
                  <Link href="/admin-guide" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setShowUserMenu(false)}>מדריך למנהלים</Link>
                  <button onClick={handleLogout} className="block w-full text-start px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium border-t border-gray-100">התנתקות</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* === MOBILE TOP BAR === */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm sm:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="The Minhelet" className="w-10 h-10 rounded-full object-cover shadow-sm" />
            <span className="font-bold text-sm text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>THE MINHELET</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold" style={{ fontFamily: "var(--font-inter)" }}></span>
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                {initial}
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                  <div className="absolute top-full mt-2 end-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-52">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-400">{userEmail}</p>
                    </div>
                    <Link href="/admin" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setShowUserMenu(false)}>ניהול</Link>
                    <button onClick={handleLogout} className="block w-full text-start px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium">התנתקות</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* === BETTING PAGES SUB-NAV (shown on groups/knockout/special-bets) === */}
      {isBettingPage && (
        <div className="bg-gradient-to-l from-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-3">
            <div className="flex items-center gap-0 sm:gap-1 flex-1">
              {BETTING_PAGES.map((p, i) => {
                const isActive = pathname === p.href;
                const currentIdx = BETTING_PAGES.findIndex(bp => bp.href === pathname);
                const isPast = i < currentIdx;
                return (
                  <div key={p.href} className="flex items-center flex-1">
                    <Link href={p.href}
                      className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold w-full justify-center transition-all ${
                        isActive
                          ? "bg-white text-blue-700 shadow-md border border-blue-200"
                          : isPast
                          ? "text-green-600 hover:bg-white/50"
                          : "text-gray-500 hover:bg-white/50"
                      }`}>
                      <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shrink-0 ${
                        isActive ? "bg-blue-600 text-white" :
                        isPast ? "bg-green-500 text-white" :
                        "bg-gray-300 text-white"
                      }`}>{isPast ? "✓" : p.step}</span>
                      <span className="truncate">{p.label}</span>
                    </Link>
                    {i < BETTING_PAGES.length - 1 && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 shrink-0 mx-0.5 hidden sm:block"><path d="M9 18l6-6-6-6"/></svg>
                    )}
                  </div>
                );
              })}
            </div>
            <DeadlineCountdown />
          </div>
        </div>
      )}

      <main><ErrorBoundary>{children}</ErrorBoundary></main>

      {/* === FLOATING HELP BUTTON === */}
      <button
        onClick={() => { localStorage.removeItem("wc2026-onboarding-seen"); setShowOnboarding(true); }}
        className="fixed bottom-20 sm:bottom-6 start-4 sm:start-6 z-40 w-11 h-11 rounded-full bg-white border-2 border-gray-200 text-gray-500 shadow-lg hover:shadow-xl hover:scale-110 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center"
        title="עזרה — איך להמר?"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <path d="M12 17h.01"/>
        </svg>
      </button>

      {/* === MOBILE BOTTOM NAV === */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center h-16 z-50 sm:hidden shadow-[0_-2px_8px_rgba(0,0,0,0.06)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {/* Betting pages grouped */}
        <Link href="/groups"
          className={`flex flex-col items-center gap-0.5 py-1 ${isBettingPage ? "text-blue-600" : "text-gray-400"}`}>
          {Icons.bets(isBettingPage)}
          <span className="text-[9px] font-bold">הימורים</span>
          {isBettingPage && <div className="w-1 h-1 rounded-full bg-blue-600"></div>}
        </Link>
        {[
          { href: "/standings", label: "דירוג", iconKey: "leaderboard" as const },
          { href: "/compare", label: "השוואה", iconKey: "compare" as const },
          { href: "/live", label: "לייב", iconKey: "live" as const },
          { href: "/schedule", label: "לו״ז", iconKey: "live" as const },
          { href: "/squads", label: "נבחרות", iconKey: "squads" as const },
        ].map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 py-1 ${isActive ? "text-gray-900" : "text-gray-400"}`}>
              {Icons[item.iconKey](isActive)}
              <span className="text-[9px] font-bold">{item.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-gray-900"></div>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
