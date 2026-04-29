"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useBettingStore } from "@/stores/betting-store";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DeadlineCountdown } from "@/components/shared/DeadlineCountdown";
import { SplashScreen } from "@/components/shared/SplashScreen";
import { SaveIndicator } from "@/components/shared/SaveIndicator";
import { ToastHost } from "@/components/shared/ToastHost";
import { ConflictResolutionModal } from "@/components/shared/ConflictResolutionModal";
import { useSharedData } from "@/hooks/useSharedData";
import { formatLockDeadline, isLocked } from "@/lib/constants";

const Icons = {
  bets: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9 15l3 3 3-3"/></svg>,
  leaderboard: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  compare: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 3v18M3 12h18"/></svg>,
  rules: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  live: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>,
  squads: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  schedule: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

// Betting steps
const BETTING_PAGES = [
  { href: "/groups", label: "שלב הבתים", step: 1 },
  { href: "/knockout", label: "עץ טורניר", step: 2 },
  { href: "/special-bets", label: "הימורים מיוחדים", step: 3 },
];

// Tracking/social pages
const TRACKING_ITEMS = [
  { href: "/standings", label: "ראשי", iconKey: "leaderboard" as const },
  { href: "/compare", label: "השוואה", iconKey: "compare" as const },
  { href: "/live", label: "לייב", iconKey: "live" as const },
  { href: "/schedule", label: "לו״ז", iconKey: "schedule" as const },
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
        <div className="px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>The Minhelet</h2>
                <p className="text-xs text-gray-400">מונדיאל 2026 — הימורי חברים</p>
              </div>
            </div>
            <button onClick={onDismiss} className="text-xs text-gray-400 hover:text-gray-600">דלג</button>
          </div>
          <div className="flex gap-1 mb-4">{[0,1,2].map(i => <div key={i} className={`h-1 flex-1 rounded-full ${i <= page ? "bg-blue-500" : "bg-gray-200"}`}></div>)}</div>
        </div>
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {page === 0 && (
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>3 שלבי הימורים</h3>
              <p className="text-base text-gray-600">לפני תחילת המונדיאל יש להשלים את שלושת השלבים:</p>
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold text-center leading-6">1</span>
                    <strong>שלב הבתים</strong>
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">72 משחקים</span>
                  </div>
                  <p className="text-sm text-gray-600 ps-8">תוצאה מדויקת לכל משחק · סדרו את הטבלה הצפויה</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold text-center leading-6">2</span>
                    <strong>עץ הנוק-אאוט</strong>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">31 משחקים</span>
                  </div>
                  <p className="text-sm text-gray-600 ps-8">מי עולה מהשמינית ועד הגמר</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold text-center leading-6">3</span>
                    <strong>הימורים מיוחדים</strong>
                    <span className="text-xs font-bold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5">25 הימורים</span>
                  </div>
                  <p className="text-sm text-gray-600 ps-8">זוכה, גמר, מלך שערים, בית פורה ועוד</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center bg-gray-50 rounded-lg py-2 border border-gray-100">סה״כ 128 הימורים · אפשר לחזור ולשנות עד הנעילה</p>
            </div>
          )}
          {page === 1 && (
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>ניקוד בקצרה</h3>
              <p className="text-base text-gray-600">משחקי בתים ונוקאאוט:</p>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs">
                    <tr>
                      <th className="py-2 ps-4 text-start font-semibold">שלב</th>
                      <th className="py-2 text-center font-semibold">תוצאה מדויקת</th>
                      <th className="py-2 pe-4 text-center font-semibold">כיוון נכון</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100"><td className="py-2 ps-4 font-bold">בתים</td><td className="text-center font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>3 נק׳</td><td className="py-2 pe-4 text-center font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>2 נק׳</td></tr>
                    <tr className="border-t border-gray-100"><td className="py-2 ps-4 font-bold">נוקאאוט</td><td className="text-center font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>3 נק׳</td><td className="py-2 pe-4 text-center font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>2 נק׳</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-3">הימורי עולות ומיוחדים:</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="bg-purple-50 rounded-lg py-1.5 px-2 border border-purple-100 flex items-center justify-between"><span>זוכה</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>12</span></div>
                <div className="bg-purple-50 rounded-lg py-1.5 px-2 border border-purple-100 flex items-center justify-between"><span>גמר</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>8</span></div>
                <div className="bg-purple-50 rounded-lg py-1.5 px-2 border border-purple-100 flex items-center justify-between"><span>חצי גמר</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>6</span></div>
                <div className="bg-purple-50 rounded-lg py-1.5 px-2 border border-purple-100 flex items-center justify-between"><span>רבע גמר</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>4</span></div>
                <div className="bg-amber-50 rounded-lg py-1.5 px-2 border border-amber-100 flex items-center justify-between"><span>מלך שערים</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>9</span></div>
                <div className="bg-amber-50 rounded-lg py-1.5 px-2 border border-amber-100 flex items-center justify-between"><span>מלך בישולים</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>7</span></div>
                <div className="bg-amber-50 rounded-lg py-1.5 px-2 border border-amber-100 flex items-center justify-between"><span>התקפה הכי טובה</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>6</span></div>
                <div className="bg-amber-50 rounded-lg py-1.5 px-2 border border-amber-100 flex items-center justify-between"><span>בית פורה / יבש</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>5</span></div>
                <div className="bg-amber-50 rounded-lg py-1.5 px-2 border border-amber-100 flex items-center justify-between"><span>נבחרת כסחנית</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>5</span></div>
                <div className="bg-amber-50 rounded-lg py-1.5 px-2 border border-amber-100 flex items-center justify-between"><span>מאצ׳אפ (כל אחד)</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>5</span></div>
                <div className="bg-amber-50 rounded-lg py-1.5 px-2 border border-amber-100 flex items-center justify-between col-span-2"><span>סה״כ פנדלים (אובר/אנדר 18.5)</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>5</span></div>
              </div>
            </div>
          )}
          {page === 2 && (
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>שמירה, נעילה ומעקב</h3>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 flex items-start gap-3">
                <span className="text-2xl">💾</span>
                <div>
                  <p className="font-bold text-blue-900">שמירה אוטומטית כל 5 הימורים</p>
                  <p className="text-sm text-blue-700 mt-0.5">בנוסף — כפתור "שמור" בתחתית כל דף לשליטה ידנית. לא יעלמו לך הימורים.</p>
                </div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200 flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="font-bold text-red-900">הנעילה: {formatLockDeadline()}</p>
                  <p className="text-sm text-red-700 mt-0.5">אחרי הנעילה — אי אפשר לשנות הימורים.</p>
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 flex items-start gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="font-bold text-green-900">אחרי הנעילה</p>
                  <p className="text-sm text-green-700 mt-0.5">טבלה חיה, מעקב בזמן אמת והשוואה בין מהמרים.</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex justify-between items-center shrink-0 border-t border-gray-100 pt-3">
          {page > 0 ? (
            <button onClick={() => setPage(page - 1)} className="text-sm text-gray-500 font-medium">→ חזרה</button>
          ) : <div />}
          {isLast ? (
            <button onClick={onStart} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors">
              יאללה, מתחילים!
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

// ============================================================================
// Circular SVG progress ring
// ============================================================================
function ProgressRing({ pct, size = 22, stroke = 2.5, color = "currentColor" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} opacity={0.2} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }} />
    </svg>
  );
}

// ============================================================================
// Locked celebration modal — shown once when the deadline passes
// ============================================================================
function LockedCelebrationModal({ onClose, groupsFilled, knockoutFilled, specialsFilled }: {
  onClose: () => void; groupsFilled: number; knockoutFilled: number; specialsFilled: number;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full text-center p-8 animate-[popIn_0.4s_ease-out]"
        style={{ animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="text-6xl mb-3">🔒</div>
        <h2 className="text-2xl font-black text-gray-900 mb-1" style={{ fontFamily: "var(--font-secular)" }}>הפנקס נחתם!</h2>
        <p className="text-gray-500 text-sm mb-5">ההימורים ננעלו — עכשיו רק נצפה</p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: "בתים", val: groupsFilled, total: 12 },
            { label: "נוק-אאוט", val: knockoutFilled, total: 31 },
            { label: "מיוחדים", val: specialsFilled, total: 25 },
          ].map(({ label, val, total }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className={`text-lg font-black ${val === total ? "text-green-600" : "text-gray-800"}`} style={{ fontFamily: "var(--font-inter)" }}>
                {val}/{total}
              </p>
              <p className="text-[10px] text-gray-500 font-bold">{label}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 transition-colors">
          לצפייה בטבלה ←
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Betting sub-nav — shows each stage as green once fully completed
// ============================================================================
function BettingSubNav({ pathname }: { pathname: string }) {
  const groupsFilled = useBettingStore((s) => s.getCompletedGroupsCount());
  const knockoutFilled = useBettingStore((s) => Object.keys(s.knockout).filter((k) => s.knockout[k]?.winner).length);
  const specialsFilled = useBettingStore((s) => {
    const sb = s.specialBets;
    let count = 0;
    if (sb.winner) count++;
    if (sb.finalist1) count++;
    if (sb.finalist2) count++;
    count += sb.quarterfinalists.filter(Boolean).length;
    count += sb.semifinalists.filter(Boolean).length;
    if (sb.topScorerPlayer) count++;
    if (sb.topAssistsPlayer) count++;
    if (sb.bestAttack) count++;
    if (sb.dirtiestTeam) count++;
    if (sb.prolificGroup) count++;
    if (sb.driestGroup) count++;
    count += sb.matchups.filter(Boolean).length;
    if (sb.penaltiesOverUnder) count++;
    return count;
  });

  const pcts: Record<string, number> = {
    "/groups": Math.round(groupsFilled / 12 * 100),
    "/knockout": Math.round(knockoutFilled / 31 * 100),
    "/special-bets": Math.round(specialsFilled / 25 * 100),
  };
  const completion: Record<string, boolean> = {
    "/groups": groupsFilled >= 12,
    "/knockout": knockoutFilled >= 31,
    "/special-bets": specialsFilled >= 25,
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-0 sm:gap-1 flex-1">
          {BETTING_PAGES.map((p, i) => {
            const isActive = pathname === p.href;
            const isComplete = completion[p.href];
            const pct = pcts[p.href];
            let wrapClass: string;
            let ringColor: string;
            let labelText: string;
            if (isComplete) {
              wrapClass = isActive
                ? "bg-green-100 text-green-800 border border-green-400 shadow-sm"
                : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100";
              ringColor = "#22c55e";
              labelText = "✓";
            } else if (isActive) {
              wrapClass = "bg-blue-50 text-blue-700 border border-blue-200";
              ringColor = "#2563eb";
              labelText = String(p.step);
            } else {
              wrapClass = "text-gray-400 hover:bg-gray-50 border border-transparent";
              ringColor = "#9ca3af";
              labelText = String(p.step);
            }
            return (
              <div key={p.href} className="flex items-center flex-1">
                <Link
                  href={p.href}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold w-full justify-center transition-all ${wrapClass}`}
                >
                  <span className="relative shrink-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                    <span className="absolute inset-0 flex items-center justify-center">
                      <ProgressRing pct={pct} size={22} stroke={2.5} color={ringColor} />
                    </span>
                    <span className="text-[10px] sm:text-xs font-black relative z-10">{labelText}</span>
                  </span>
                  <span className="truncate">{p.label}</span>
                </Link>
                {i < BETTING_PAGES.length - 1 && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 shrink-0 mx-0.5 hidden sm:block">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Progress Banner — shows on ALL pages
// ============================================================================
function ProgressBanner() {
  const groupsFilled = useBettingStore((s) => s.getCompletedGroupsCount());
  const knockoutFilled = useBettingStore((s) => Object.keys(s.knockout).filter(k => s.knockout[k]?.winner).length);
  const specialsFilled = useBettingStore((s) => {
    const sb = s.specialBets;
    let count = 0;
    if (sb.winner) count++;
    if (sb.finalist1) count++;
    if (sb.finalist2) count++;
    if (sb.topScorerPlayer) count++;
    if (sb.topAssistsPlayer) count++;
    if (sb.bestAttack) count++;
    if (sb.dirtiestTeam) count++;
    if (sb.prolificGroup) count++;
    if (sb.driestGroup) count++;
    return count;
  });

  const groupsDone = groupsFilled >= 12;
  const knockoutDone = knockoutFilled >= 16;
  const specialsDone = specialsFilled >= 7;
  const allDone = groupsDone && knockoutDone && specialsDone;

  // Check if tournament has started (June 11, 2026)
  const tournamentStarted = new Date() >= new Date("2026-06-11T00:00:00Z");
  // Check if pre-tournament lock passed (June 10, 2026 17:00 IST)
  const preLockPassed = new Date() >= new Date("2026-06-10T14:00:00Z");

  // During tournament: show different banner
  if (preLockPassed && tournamentStarted) {
    return (
      <div className="bg-gradient-to-l from-green-50 to-emerald-50/70 border-b border-green-200/60">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-3 text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></span>
          <span className="text-green-700 font-bold">הטורניר בעיצומו!</span>
          <Link href="/live" className="text-green-600 font-bold hover:underline ms-auto">צפו בלייב ←</Link>
        </div>
      </div>
    );
  }

  if (allDone) return null;

  return (
    <div className="bg-gradient-to-l from-blue-50 to-indigo-50/70 border-b border-blue-200/60">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-3 text-xs sm:text-sm">
        <span className="text-blue-600 font-bold shrink-0">השלימו:</span>
        <div className="flex items-center gap-2 sm:gap-3 flex-1 overflow-x-auto">
          <Link href="/groups" className={`flex items-center gap-1 shrink-0 font-bold ${groupsDone ? "text-green-600" : "text-blue-700 underline"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${groupsDone ? "bg-green-500 text-white" : "bg-blue-600 text-white"}`}>
              {groupsDone ? "✓" : "1"}
            </span>
            בתים {groupsFilled}/12
          </Link>
          <Link href="/knockout" className={`flex items-center gap-1 shrink-0 font-bold ${knockoutDone ? "text-green-600" : "text-gray-500"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${knockoutDone ? "bg-green-500 text-white" : "bg-gray-300 text-white"}`}>
              {knockoutDone ? "✓" : "2"}
            </span>
            נוק-אאוט
          </Link>
          <Link href="/special-bets" className={`flex items-center gap-1 shrink-0 font-bold ${specialsDone ? "text-green-600" : "text-gray-500"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${specialsDone ? "bg-green-500 text-white" : "bg-gray-300 text-white"}`}>
              {specialsDone ? "✓" : "3"}
            </span>
            מיוחדים
          </Link>
        </div>
        <DeadlineCountdown />
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
  const [authReady, setAuthReady] = useState(false);
  const [wasRecentVisit, setWasRecentVisit] = useState(false);
  const [showLockedCelebration, setShowLockedCelebration] = useState(false);
  const { loading: dataLoading } = useSharedData();

  const groupsFilled = useBettingStore((s) => s.getCompletedGroupsCount());
  const knockoutFilled = useBettingStore((s) => Object.keys(s.knockout).filter((k) => s.knockout[k]?.winner).length);
  const specialsFilled = useBettingStore((s) => s.getSpecialsFilledCount());
  const bettingOverallPct = Math.round((groupsFilled / 12 + knockoutFilled / 31 + specialsFilled / 25) / 3 * 100);

  const appReady = authReady && !dataLoading;

  useEffect(() => {
    try {
      const last = localStorage.getItem("wc_last_visited");
      if (last && Date.now() - Number(last) < 86400000) setWasRecentVisit(true);
      localStorage.setItem("wc_last_visited", String(Date.now()));
    } catch { /* ignore */ }
    useBettingStore.persist.rehydrate();
    document.documentElement.classList.remove("dark");
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "");
        setUserEmail(user.email || "");
        const seen = localStorage.getItem("wc2026-onboarding-seen");
        if (!seen) setShowOnboarding(true);
        // Server is source of truth — pull latest DB state and overwrite
        // whatever was restored from localStorage so admin resets /
        // cross-device edits are reflected immediately.
        await useBettingStore.getState().hydrateFromSupabase();
      }
      setAuthReady(true);
    });
  }, []);

  // Show locked celebration once when deadline passes
  useEffect(() => {
    if (!appReady) return;
    if (!isLocked()) return;
    try {
      if (!localStorage.getItem("wc_lock_celebrated")) {
        setShowLockedCelebration(true);
        localStorage.setItem("wc_lock_celebrated", "true");
      }
    } catch { /* ignore */ }
  }, [appReady]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("wc2026-onboarding-seen", "true");
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const initial = userName ? userName[0].toUpperCase() : userEmail ? userEmail[0].toUpperCase() : "?";
  const isBettingPage = BETTING_PAGES.some(p => pathname === p.href);
  const isTrackingPage = TRACKING_ITEMS.some(p => pathname === p.href);

  // Skip splash for returning users who visited within last 24h
  if (!appReady) {
    if (wasRecentVisit) {
      return (
        <div className="fixed inset-0 bg-[#F8F9FB] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      );
    }
    return <SplashScreen />;
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-0 bg-[#F8F9FB]" style={{ fontFamily: "var(--font-assistant), sans-serif" }} dir="rtl">

{showOnboarding && <OnboardingWizard onDismiss={dismissOnboarding} onStart={() => { dismissOnboarding(); router.push("/groups"); }} />}

      {showLockedCelebration && (
        <LockedCelebrationModal
          onClose={() => { setShowLockedCelebration(false); router.push("/standings"); }}
          groupsFilled={groupsFilled}
          knockoutFilled={knockoutFilled}
          specialsFilled={specialsFilled}
        />
      )}

      {/* ════════════════════════════════════════════ */}
      {/* DESKTOP HEADER                              */}
      {/* ════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 lg:h-16 px-4 lg:px-6">
          <Link href="/standings" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="The Minhelet" className="w-12 h-12 lg:w-14 lg:h-14 rounded-full object-cover shadow-lg" />
            <div className="flex flex-col">
              <span className="font-bold text-sm lg:text-lg text-gray-900 leading-tight" style={{ fontFamily: "var(--font-secular)" }}>THE MINHELET</span>
              <span className="text-[9px] lg:text-xs text-gray-400 font-medium" style={{ fontFamily: "var(--font-inter)" }}>WORLD CUP 2026</span>
            </div>
          </Link>

          <nav className="flex items-center gap-0.5 lg:gap-1">
            {/* BETTING — dropdown with blue accent */}
            <div className="relative">
              <button onClick={() => { setShowBetsMenu(!showBetsMenu); setShowUserMenu(false); }}
                className={`flex items-center gap-1.5 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${
                  isBettingPage ? "bg-gradient-to-l from-blue-600 to-indigo-600 text-white shadow-md" : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                }`}>
                {Icons.bets(isBettingPage)}
                <span>הימורים</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showBetsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBetsMenu(false)}></div>
                  <div className="absolute top-full mt-2 start-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-60">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-400 font-bold">3 שלבים להשלמת ההימורים</p>
                    </div>
                    {BETTING_PAGES.map(p => (
                      <Link key={p.href} href={p.href} onClick={() => setShowBetsMenu(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                          pathname === p.href ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                        }`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          pathname === p.href ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                        }`}>{p.step}</span>
                        {p.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* TRACKING — regular nav items */}
            {TRACKING_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${
                    isActive ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-100"
                  }`}>
                  {Icons[item.iconKey](isActive)}
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="relative shrink-0">
            <button onClick={() => { setShowUserMenu(!showUserMenu); setShowBetsMenu(false); }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="hidden lg:block text-end">
                <p className="text-sm font-bold text-gray-900 leading-tight">{userName || "משתמש"}</p>
                <p className="text-xs text-gray-400">{userEmail}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white shadow-md">
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

      {/* ════════════════════════════════════════════ */}
      {/* MOBILE TOP BAR                              */}
      {/* ════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm sm:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/standings" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-10 h-10 rounded-full object-cover shadow-sm" />
            <span className="font-bold text-sm text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>THE MINHELET</span>
          </Link>
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
      </header>

      {/* ════════════════════════════════════════════ */}
      {/* PERSISTENT PROGRESS BANNER (all pages)      */}
      {/* ════════════════════════════════════════════ */}
      <ProgressBanner />

      {/* ════════════════════════════════════════════ */}
      {/* BETTING SUB-NAV (only on betting pages)     */}
      {/* ════════════════════════════════════════════ */}
      {isBettingPage && <BettingSubNav pathname={pathname} />}

      {/* ════════════════════════════════════════════ */}
      {/* BREADCRUMB on tracking pages                */}
      {/* ════════════════════════════════════════════ */}
      {isTrackingPage && !isBettingPage && (
        <div className="bg-white border-b border-gray-100 sm:hidden">
          <div className="px-4 py-2">
            <Link href="/groups" className="text-xs text-blue-600 font-bold hover:underline">← חזור להימורים</Link>
          </div>
        </div>
      )}

      <main><ErrorBoundary>{children}</ErrorBoundary></main>

      {/* Pre-lock: floating save-status indicator (hidden by isLocked inside component) */}
      <SaveIndicator />
      <ToastHost />
      <ConflictResolutionModal />

      {/* Floating help */}
      <button
        onClick={() => { localStorage.removeItem("wc2026-onboarding-seen"); setShowOnboarding(true); }}
        className="fixed bottom-20 sm:bottom-6 start-4 sm:start-6 z-40 w-11 h-11 rounded-full bg-white border-2 border-gray-200 text-gray-500 shadow-lg hover:shadow-xl hover:scale-110 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center"
        title="עזרה"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <path d="M12 17h.01"/>
        </svg>
      </button>

      {/* ════════════════════════════════════════════ */}
      {/* MOBILE BOTTOM NAV — 6 tabs                  */}
      {/* JSX order = RTL visual: first item = RIGHT. */}
      {/* User wants "הימורים" on the LEFT edge → put it LAST. */}
      {/* ════════════════════════════════════════════ */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 sm:hidden shadow-[0_-2px_8px_rgba(0,0,0,0.06)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex justify-around items-center h-16">
          <Link href="/standings"
            className={`flex flex-col items-center gap-0.5 py-1 ${pathname === "/standings" ? "text-gray-900" : "text-gray-400"}`}>
            {Icons.leaderboard(pathname === "/standings")}
            <span className="text-[8px] font-bold">טבלה</span>
          </Link>
          <Link href="/compare"
            className={`flex flex-col items-center gap-0.5 py-1 ${pathname === "/compare" ? "text-gray-900" : "text-gray-400"}`}>
            {Icons.compare(pathname === "/compare")}
            <span className="text-[8px] font-bold">השוואה</span>
          </Link>
          <Link href="/live"
            className={`flex flex-col items-center gap-0.5 py-1 ${pathname === "/live" ? "text-gray-900" : "text-gray-400"}`}>
            {Icons.live(pathname === "/live")}
            <span className="text-[8px] font-bold">לייב</span>
          </Link>
          <Link href="/squads"
            className={`flex flex-col items-center gap-0.5 py-1 ${pathname === "/squads" ? "text-gray-900" : "text-gray-400"}`}>
            {Icons.squads(pathname === "/squads")}
            <span className="text-[8px] font-bold">נבחרות</span>
          </Link>
          <Link href="/schedule"
            className={`flex flex-col items-center gap-0.5 py-1 ${pathname === "/schedule" ? "text-gray-900" : "text-gray-400"}`}>
            {Icons.schedule(pathname === "/schedule")}
            <span className="text-[8px] font-bold">לו״ז</span>
          </Link>
          <Link href="/groups"
            className={`flex flex-col items-center gap-0.5 py-1 ${isBettingPage ? "text-blue-600" : "text-gray-400"}`}>
            <span className="relative w-5 h-5 flex items-center justify-center">
              <span className="absolute -inset-1">
                <ProgressRing pct={bettingOverallPct} size={28} stroke={2} color={isBettingPage ? "#2563eb" : "#9ca3af"} />
              </span>
              {Icons.bets(isBettingPage)}
            </span>
            <span className="text-[8px] font-bold">הימורים</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
