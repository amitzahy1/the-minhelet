"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useBettingStore } from "@/stores/betting-store";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DeadlineCountdown } from "@/components/shared/DeadlineCountdown";
import { SaveIndicator } from "@/components/shared/SaveIndicator";
import { SaveFlushOnNav } from "@/components/shared/SaveFlushOnNav";
import { SaveBeforeNav } from "@/components/shared/SaveBeforeNav";
import { ToastHost } from "@/components/shared/ToastHost";
import { ConflictResolutionModal } from "@/components/shared/ConflictResolutionModal";
import { VersionWatcher } from "@/components/shared/VersionWatcher";
import { NavProgressBar } from "@/components/shared/NavProgressBar";
import { Suspense } from "react";
import { useSharedData } from "@/hooks/useSharedData";
import { useScoring } from "@/hooks/useScoring";
import { useRealKnockoutStatus } from "@/hooks/useRealKnockoutStatus";
import { formatLockDeadline, isLocked } from "@/lib/constants";
import { getTeamNameHe } from "@/lib/flags";
import { toIsraelTimeShort } from "@/lib/timezone";

const Icons = {
  bets: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9 15l3 3 3-3"/></svg>,
  leaderboard: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  compare: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 3v18M3 12h18"/></svg>,
  rules: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  live: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>,
  squads: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  schedule: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  bracket: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
};

// Betting steps
const BETTING_PAGES = [
  { href: "/groups", label: "שלב הבתים", step: 1 },
  { href: "/knockout", label: "עץ סימולציה", step: 2 },
  { href: "/special-bets", label: "הימורים מיוחדים", step: 3 },
];

// Tracking/social pages — order: ראשי → לו״ז → השוואה → לייב (then squads/rules).
// Desktop renders this array in RTL visual order; the mobile bottom nav below
// is hardcoded the same way.
const TRACKING_ITEMS = [
  { href: "/standings", label: "ראשי", iconKey: "leaderboard" as const },
  { href: "/schedule", label: "לו״ז", iconKey: "schedule" as const },
  { href: "/compare", label: "השוואה", iconKey: "compare" as const },
  { href: "/live", label: "לייב", iconKey: "live" as const },
  { href: "/squads", label: "נבחרות", iconKey: "squads" as const },
  { href: "/rules", label: "חוקים", iconKey: "rules" as const },
];

// ============================================================================
// Onboarding Wizard — multi-page tutorial
// ============================================================================
function OnboardingWizard({ onDismiss, onStart }: { onDismiss: () => void; onStart: () => void }) {
  const [page, setPage] = useState(0);
  const isLast = page === 3;
  const scoring = useScoring();
  const adv = scoring.advancement;
  const sp = scoring.specials;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[88vh] flex flex-col">
        <div className="px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>The Minhelet</h2>
                <p className="text-xs text-gray-400">מונדיאל 2026 · הימורי חברים</p>
              </div>
            </div>
            <button onClick={onDismiss} className="text-xs text-gray-400 hover:text-gray-600">דלג</button>
          </div>
          <div className="flex gap-1 mb-1">{[0,1,2,3].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= page ? "bg-blue-500" : "bg-gray-200"}`}></div>)}</div>
          <p className="text-[11px] text-gray-400 font-medium mb-2">שלב {page + 1} מתוך 4</p>
        </div>
        <div className="px-6 pb-6 overflow-y-auto flex-1">

          {/* ============================================================ */}
          {/* SCREEN 1 — Welcome + 3 betting stages                         */}
          {/* ============================================================ */}
          {page === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight" style={{ fontFamily: "var(--font-secular)" }}>ברוכים הבאים</h3>
                <p className="text-sm text-gray-500 mt-1">48 נבחרות · 12 בתים · 32 משחקי נוקאאוט</p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                להשלמת ההרשמה — שלושה שלבי הימורים. אפשר לחזור ולערוך כל הימור עד הנעילה — ותוצאות המשחקים נשארות פתוחות עד חצי שעה לפני כל משחק.
              </p>
              <div className="space-y-2.5">
                <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black" style={{ fontFamily: "var(--font-inter)" }}>1</span>
                    <strong className="text-sm">שלב הבתים</strong>
                    <span className="ms-auto text-[11px] font-bold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5" style={{ fontFamily: "var(--font-inter)" }}>72 משחקים</span>
                  </div>
                  <p className="text-[13px] text-gray-600 leading-snug ps-8">תוצאה מדויקת לכל משחק · הטבלה הצפויה מחושבת אוטומטית</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black" style={{ fontFamily: "var(--font-inter)" }}>2</span>
                    <strong className="text-sm">עץ סימולציה</strong>
                    <span className="ms-auto text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5" style={{ fontFamily: "var(--font-inter)" }}>31 משחקים</span>
                  </div>
                  <p className="text-[13px] text-gray-600 leading-snug ps-8">בוחרים מי עולה בכל שלב ומי האלופה — סימולציה לבחירת העולות (ללא תוצאות).</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3.5 border border-purple-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black" style={{ fontFamily: "var(--font-inter)" }}>3</span>
                    <strong className="text-sm">הימורים מיוחדים</strong>
                    <span className="ms-auto text-[11px] font-bold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5" style={{ fontFamily: "var(--font-inter)" }}>24 הימורים</span>
                  </div>
                  <p className="text-[13px] text-gray-600 leading-snug ps-8">אלוף, מלך שערים, בית פורה, מאצ׳אפים ועוד</p>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🟢</span>
                  <strong className="text-sm">עץ נתוני אמת — במהלך הטורניר</strong>
                </div>
                <p className="text-[13px] text-gray-600 leading-snug ps-7">
                  בתום שלב הבתים נפתח עץ עם המשחקים <strong>האמיתיים</strong> (32 העולות, כולל 8 המקומות השלישיים הטובים). שם מנחשים תוצאה + מי עולה — וזהו העץ שנספר לניקוד תוצאות הנוק-אאוט. אין דד-ליין אחד: כל משחק ניתן לעדכון <strong>עד חצי שעה לפני שריקת הפתיחה</strong>.
                </p>
              </div>
              <p className="text-[11px] text-gray-500 text-center bg-gray-50 rounded-lg py-2 border border-gray-100">
                סה״כ <strong className="text-gray-700" style={{ fontFamily: "var(--font-inter)" }}>128</strong> הימורים · שמירה אוטומטית
              </p>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 2 — Scoring                                            */}
          {/* ============================================================ */}
          {page === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight" style={{ fontFamily: "var(--font-secular)" }}>איך זוכים נקודות</h3>
                <p className="text-sm text-gray-500 mt-1">סקירה קצרה של שיטת הניקוד</p>
              </div>

              {/* Match scoring */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1.5">ניקוד משחקים</p>
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-[11px]">
                      <tr>
                        <th className="py-2 ps-4 text-start font-semibold">שלב</th>
                        <th className="py-2 text-center font-semibold">תוצאה מדויקת</th>
                        <th className="py-2 pe-4 text-center font-semibold">כיוון נכון</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100">
                        <td className="py-1.5 ps-4 font-bold text-[13px]">בתים</td>
                        <td className="text-center font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>{scoring.toto.GROUP + scoring.exact.GROUP}</td>
                        <td className="py-1.5 pe-4 text-center font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{scoring.toto.GROUP}</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="py-1.5 ps-4 font-bold text-[13px]">נוקאאוט · עץ אמת</td>
                        <td className="text-center font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>{scoring.toto.R16 + scoring.exact.R16}</td>
                        <td className="py-1.5 pe-4 text-center font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{scoring.toto.R16}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 leading-snug">ניקוד תוצאות הנוק-אאוט מגיע מ<strong>עץ נתוני אמת</strong> בלבד. עץ הסימולציה משמש לבחירת העולות והאלופה (ניקוד עולות). הערכים בטבלה בסיסיים — חצי-הגמר והגמר שווים יותר (פירוט מלא בדף החוקים).</p>
              </div>

              {/* Advancement scoring */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1.5">ניקוד עולות וזוכה</p>
                <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                  <div className="bg-purple-50 rounded-lg py-1.5 px-2.5 border border-purple-100 flex items-center justify-between"><span className="text-gray-700">אלוף הטורניר</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>{adv.winner}</span></div>
                  <div className="bg-purple-50 rounded-lg py-1.5 px-2.5 border border-purple-100 flex items-center justify-between"><span className="text-gray-700">עולה לגמר</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>{adv.final}</span></div>
                  <div className="bg-purple-50 rounded-lg py-1.5 px-2.5 border border-purple-100 flex items-center justify-between"><span className="text-gray-700">עולה לחצי</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>{adv.sf}</span></div>
                  <div className="bg-purple-50 rounded-lg py-1.5 px-2.5 border border-purple-100 flex items-center justify-between"><span className="text-gray-700">עולה לרבע</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>{adv.qf}</span></div>
                  <div className="bg-purple-50 rounded-lg py-1.5 px-2.5 border border-purple-100 flex items-center justify-between"><span className="text-gray-700">עולה לשמינית</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>{adv.r16}</span></div>
                  <div className="bg-purple-50 rounded-lg py-1.5 px-2.5 border border-purple-100 flex items-center justify-between col-span-2"><span className="text-gray-700">עולה מבית · מדויק / חלקי</span><span className="font-black text-purple-700" style={{ fontFamily: "var(--font-inter)" }}>{adv.group_exact} / {adv.group_partial}</span></div>
                </div>
              </div>

              {/* Specials scoring */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1.5">ניקוד הימורים מיוחדים</p>
                <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                  <div className="bg-amber-50 rounded-lg py-1.5 px-2.5 border border-amber-100 flex items-center justify-between"><span className="text-gray-700">מלך שערים</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>{sp.top_scorer_exact}</span></div>
                  <div className="bg-amber-50 rounded-lg py-1.5 px-2.5 border border-amber-100 flex items-center justify-between"><span className="text-gray-700">מלך בישולים</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>{sp.top_assists_exact}</span></div>
                  <div className="bg-amber-50 rounded-lg py-1.5 px-2.5 border border-amber-100 flex items-center justify-between"><span className="text-gray-700">התקפה הכי טובה</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>{sp.best_attack}</span></div>
                  <div className="bg-amber-50 rounded-lg py-1.5 px-2.5 border border-amber-100 flex items-center justify-between"><span className="text-gray-700">בית פורה / יבש</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>{sp.prolific_group}</span></div>
                  <div className="bg-amber-50 rounded-lg py-1.5 px-2.5 border border-amber-100 flex items-center justify-between"><span className="text-gray-700">נבחרת כסחנית</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>{sp.dirtiest_team}</span></div>
                  <div className="bg-amber-50 rounded-lg py-1.5 px-2.5 border border-amber-100 flex items-center justify-between"><span className="text-gray-700">מאצ׳אפ נכון</span><span className="font-black text-amber-700" style={{ fontFamily: "var(--font-inter)" }}>{sp.matchup}</span></div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 text-center bg-gray-50 rounded-lg py-2 border border-gray-100">
                ניתן לעקוב אחר הניקוד שלך בדף הטבלה אחרי הנעילה
              </p>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 3 — Pages tour                                         */}
          {/* ============================================================ */}
          {page === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight" style={{ fontFamily: "var(--font-secular)" }}>הדפים שתפגוש כאן</h3>
                <p className="text-sm text-gray-500 mt-1">חוץ מההימורים — יש מה לראות</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-1.5 text-gray-700 mb-1">{Icons.leaderboard(true)}<span className="font-bold text-sm">טבלה</span></div>
                  <p className="text-[11px] text-gray-500 leading-snug">דירוג חי + מעקב הניקוד שלך</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-1.5 text-gray-700 mb-1">{Icons.compare(true)}<span className="font-bold text-sm">השוואה</span></div>
                  <p className="text-[11px] text-gray-500 leading-snug">heatmap בין כל המהמרים</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-1.5 text-gray-700 mb-1">{Icons.live(true)}<span className="font-bold text-sm">לייב</span></div>
                  <p className="text-[11px] text-gray-500 leading-snug">תוצאות אמת + עץ + מיוחדים</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-1.5 text-gray-700 mb-1">{Icons.squads(true)}<span className="font-bold text-sm">נבחרות</span></div>
                  <p className="text-[11px] text-gray-500 leading-snug">סגלים, שחקנים ומספרים</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-1.5 text-gray-700 mb-1">{Icons.schedule(true)}<span className="font-bold text-sm">לו״ז</span></div>
                  <p className="text-[11px] text-gray-500 leading-snug">לוח משחקים מסונן</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-1.5 text-gray-700 mb-1">{Icons.rules(true)}<span className="font-bold text-sm">חוקים</span></div>
                  <p className="text-[11px] text-gray-500 leading-snug">הסבר מלא על שיטת הניקוד</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 text-center bg-gray-50 rounded-lg py-2 border border-gray-100">
                במובייל — תפריט תחתון. במחשב — סרגל למעלה.
              </p>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 4 — Lock + opening + after                             */}
          {/* ============================================================ */}
          {page === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight" style={{ fontFamily: "var(--font-secular)" }}>הנעילה ופתיחת הטורניר</h3>
                <p className="text-sm text-gray-500 mt-1">מה צפוי בשבועות הקרובים</p>
              </div>

              {/* Two key dates */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-3 text-center">
                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-0.5" style={{ fontFamily: "var(--font-inter)" }}>נעילת הימורים</p>
                  <p className="text-base font-black text-red-900 leading-tight" style={{ fontFamily: "var(--font-inter)" }}>10.06.2026</p>
                  <p className="text-[11px] text-red-700">17:00 שעון ישראל</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-3 text-center">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5" style={{ fontFamily: "var(--font-inter)" }}>פתיחת הטורניר</p>
                  <p className="text-base font-black text-emerald-900 leading-tight" style={{ fontFamily: "var(--font-inter)" }}>11.06.2026</p>
                  <p className="text-[11px] text-emerald-700">משחק הפתיחה</p>
                </div>
              </div>

              {/* Three-step timeline */}
              <div className="space-y-2">
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">עד הנעילה</p>
                    <p className="text-[12px] text-gray-600 leading-snug">שמירה אוטומטית. אפשר לערוך כל הימור בכל זמן.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">ברגע הנעילה</p>
                    <p className="text-[12px] text-gray-600 leading-snug">בחירת העולות והאלופה (עץ הסימולציה) וההימורים המיוחדים — ננעלים. תוצאות המשחקים עדיין פתוחות לעריכה (ראו למטה).</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">תוצאות המשחקים — נעילה מתגלגלת</p>
                    <p className="text-[12px] text-gray-600 leading-snug">תוצאה מדויקת נשארת פתוחה עד חצי שעה לפני המשחק: בשלב הבתים — לפני המשחק הראשון של אותו יום; בעץ נתוני־האמת (משלב 32 הגדולות ומעלה) — לפני כל משחק.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">במהלך הטורניר</p>
                    <p className="text-[12px] text-gray-600 leading-snug">דירוג חי, השוואות בין מהמרים, מי עוד "חי" בעץ ותוצאות בזמן אמת.</p>
                  </div>
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
function ProgressRing({ pct, size = 22, stroke = 2.5, color = "currentColor", className }: {
  pct: number; size?: number; stroke?: number; color?: string; className?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} className={className}>
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
            { label: "מיוחדים", val: specialsFilled, total: 24 },
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
// "Group stage ended → fill עץ נתוני אמת" — one-time nudge modal
// ============================================================================
function KoLiveOpenModal({ onClose, onGo, openCount }: { onClose: () => void; onGo: () => void; openCount: number }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full text-center p-8"
        style={{ animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="text-6xl mb-3">🟢</div>
        <h2 className="text-2xl font-black text-gray-900 mb-1" style={{ fontFamily: "var(--font-secular)" }}>שלב הבתים נגמר!</h2>
        <p className="text-gray-600 text-sm mb-5 leading-relaxed">
          נקבעו 32 העולות האמיתיות. נפתח <strong>עץ נתוני אמת</strong> — נחשו תוצאות על המשחקים האמיתיים (כולל מי עולה).
          {openCount > 0 && <> כרגע פתוחים <strong>{openCount}</strong> משחקים להימור.</>} כל משחק ניתן לעדכון עד חצי שעה לפני שריקת הפתיחה.
        </p>
        <button onClick={onGo} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors mb-2">
          למילוי עץ נתוני אמת ←
        </button>
        <button onClick={onClose} className="w-full py-2 rounded-xl text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors">
          אחר כך
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Betting sub-nav — shows each stage as green once fully completed
// ============================================================================
function BettingSubNav({ pathname }: { pathname: string }) {
  const koStatus = useRealKnockoutStatus();
  const isLiveActive = pathname === "/knockout-live";
  const groupsFilled = useBettingStore((s) => s.getCompletedGroupsCount());
  const knockoutFilled = useBettingStore((s) => Object.keys(s.knockout).filter((k) => s.knockout[k]?.winner).length);
  const specialsFilled = useBettingStore((s) => {
    const sb = s.specialBets;
    let count = 0;
    if (sb.winner) count++;
    if (sb.finalist1) count++;
    if (sb.finalist2) count++;
    count += (sb.quarterfinalists ?? []).filter(Boolean).length;
    count += (sb.semifinalists ?? []).filter(Boolean).length;
    if (sb.topScorerPlayer) count++;
    if (sb.topAssistsPlayer) count++;
    if (sb.bestAttack) count++;
    if (sb.dirtiestTeam) count++;
    if (sb.prolificGroup) count++;
    if (sb.driestGroup) count++;
    count += (sb.matchups ?? []).filter(Boolean).length;
    return count;
  });

  const pcts: Record<string, number> = {
    "/groups": Math.round(groupsFilled / 12 * 100),
    "/knockout": Math.round(knockoutFilled / 31 * 100),
    "/special-bets": Math.round(specialsFilled / 24 * 100),
  };
  const completion: Record<string, boolean> = {
    "/groups": groupsFilled >= 12,
    "/knockout": knockoutFilled >= 31,
    "/special-bets": specialsFilled >= 24,
  };

  // The second tree ("עץ נתוני אמת", /knockout-live) opens once the group stage
  // ends. Desktop surfaces it in the הימורים dropdown; on mobile there was no
  // hint a second tree existed — so we render it as a distinct row below the
  // three stage tabs, making both trees visible.
  const liveOpen = koStatus.groupStageComplete && koStatus.openCount > 0;

  return (
    <div className="bg-gradient-to-l from-blue-600 to-indigo-600 sm:bg-white sm:bg-none border-y-2 border-blue-700/40 sm:border-y sm:border-x-0 sm:border-gray-200 shadow-md sm:shadow-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-1 flex-1">
          {BETTING_PAGES.map((p, i) => {
            const isActive = pathname === p.href;
            const isComplete = completion[p.href];
            const pct = pcts[p.href];
            // Mobile (default) classes — prominent on dark blue background
            // Desktop (sm:) classes — preserve existing subtle appearance
            // ProgressRing uses currentColor, so it inherits the text color of the active state.
            let mobileClass: string;
            let desktopClass: string;
            let labelText: string;
            if (isComplete) {
              mobileClass = isActive
                ? "bg-white text-green-700 ring-2 ring-white shadow-lg"
                : "bg-green-500 text-white border border-green-400 shadow-sm hover:bg-green-600";
              desktopClass = isActive
                ? "sm:bg-green-100 sm:text-green-800 sm:border sm:border-green-400 sm:shadow-sm sm:ring-0"
                : "sm:bg-green-50 sm:text-green-700 sm:border sm:border-green-200 sm:hover:bg-green-100";
              labelText = "✓";
            } else if (isActive) {
              mobileClass = "bg-white text-blue-700 shadow-lg";
              desktopClass = "sm:bg-blue-50 sm:text-blue-700 sm:border sm:border-blue-200 sm:shadow-none";
              labelText = String(p.step);
            } else {
              mobileClass = "bg-white/15 text-white/90 hover:bg-white/25 border border-white/20";
              desktopClass = "sm:bg-transparent sm:text-gray-400 sm:hover:bg-gray-50 sm:border sm:border-transparent";
              labelText = String(p.step);
            }
            return (
              <div key={p.href} className="flex items-center flex-1">
                <Link
                  href={p.href}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-sm font-bold w-full justify-center transition-all ${mobileClass} ${desktopClass}`}
                >
                  <span className="relative shrink-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                    {isComplete ? (
                      // Clean check badge (the old ProgressRing + "✓" read like a ⊘).
                      <span className={`w-5 h-5 sm:w-[22px] sm:h-[22px] rounded-full flex items-center justify-center ${isActive ? "bg-green-500 text-white" : "bg-white text-green-600"}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                    ) : (
                      <>
                        <span className="absolute inset-0 flex items-center justify-center">
                          <ProgressRing pct={pct} size={22} stroke={2.5} color="currentColor" />
                        </span>
                        <span className="text-[11px] sm:text-xs font-black relative z-10">{labelText}</span>
                      </>
                    )}
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

        {/* Mobile-only: the SECOND tree ("עץ נתוני אמת"). Desktop surfaces it in
            the הימורים dropdown; on mobile there was no hint it existed. */}
        <Link
          href="/knockout-live"
          className={`sm:hidden flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
            isLiveActive
              ? "bg-white text-emerald-700 shadow-lg"
              : liveOpen
                ? "bg-emerald-500 text-white border border-emerald-300/60 shadow-sm"
                : "bg-white/15 text-white/90 border border-white/20"
          }`}
        >
          <span className="text-base">🟢</span>
          <span>עץ נתוני אמת</span>
          <span className={`text-[11px] font-medium ${isLiveActive ? "text-emerald-600" : "opacity-80"}`}>
            · {liveOpen ? "במהלך הטורניר" : "ייפתח בתום שלב הבתים"}
          </span>
          {koStatus.unfilledOpenCount > 0 && (
            <span className="ms-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-white text-emerald-700 text-[10px] font-black shadow" style={{ fontFamily: "var(--font-inter)" }}>
              {koStatus.unfilledOpenCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Progress Banner — shows on ALL pages
// ============================================================================
function ProgressBanner() {
  const koStatus = useRealKnockoutStatus();
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

  // During tournament: show a live banner; once the group stage ends, nudge the
  // bettor to fill the real-data tree (עץ נתוני אמת) whenever open matches remain.
  if (preLockPassed && tournamentStarted) {
    // We're inside an active knockout stage when the group stage is done AND at
    // least one match is currently open. Gate the rich banner on openCount (not
    // the per-user unfilled count) so it ALWAYS shows the stage + next match,
    // even after the viewer has bet — and even if the store's pick count is off.
    const inStage = koStatus.groupStageComplete && koStatus.openCount > 0;
    const needsFill = koStatus.unfilledOpenCount > 0;
    const nm = koStatus.nextMatch;
    return (
      <div className={`border-b ${inStage && needsFill ? "bg-gradient-to-l from-emerald-50 to-green-100/70 border-emerald-300/70" : "bg-gradient-to-l from-green-50 to-emerald-50/70 border-green-200/60"}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></span>
          {koStatus.loading ? (
            <span className="text-green-700 font-bold">הטורניר בעיצומו! <span className="text-green-600/60 font-normal">טוען מצב…</span></span>
          ) : inStage ? (
            <>
              <span className="text-green-700 font-bold shrink-0">{koStatus.currentStageLabel ?? "עץ נתוני אמת"} בעיצומו!</span>
              {nm && (
                <span className="text-gray-600 shrink-0">
                  המשחק הבא: <span className="font-bold text-gray-800">{getTeamNameHe(nm.team1) || nm.team1}–{getTeamNameHe(nm.team2) || nm.team2}</span>
                  {" · בעיטה "}<span dir="ltr" className="tabular-nums">{toIsraelTimeShort(nm.kickoff)}</span>
                  {" · ננעל "}<span dir="ltr" className="tabular-nums font-bold">{toIsraelTimeShort(nm.lockAt)}</span>
                </span>
              )}
              <Link href="/knockout-live" className={`ms-auto flex items-center gap-1.5 rounded-full px-3 py-1 shadow-sm font-bold shrink-0 transition-colors ${needsFill ? "bg-emerald-600 text-white hover:bg-emerald-700 animate-pulse" : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"}`}>
                {needsFill ? `🟢 מלאו הימור — נותרו ${koStatus.unfilledOpenCount} ←` : "לעץ נתוני אמת ←"}
              </Link>
            </>
          ) : (
            <>
              <span className="text-green-700 font-bold shrink-0">הטורניר בעיצומו!</span>
              <Link href="/live" className="text-green-600 font-bold hover:underline ms-auto">צפו בלייב ←</Link>
            </>
          )}
        </div>
        {/* Second row — DB-AUTHORITATIVE shortfall for THIS user: how many open
            matches in the current stage aren't saved to the database (not the
            local cache). This is the number the bettor should trust. */}
        {inStage && koStatus.dbUnfilledOpenCount !== null && (
          <div className={`border-t ${koStatus.dbUnfilledOpenCount > 0 ? "bg-red-50/70 border-red-200/60" : "bg-emerald-50/60 border-emerald-200/50"}`}>
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold flex items-center gap-2">
              {koStatus.dbUnfilledOpenCount > 0 ? (
                <Link href="/knockout-live" className="text-red-700 hover:underline">
                  ⚠️ נשמרו לך {koStatus.dbSavedOpenCount}/{koStatus.openCount} (לפי הדאטהבייס) — חסרים {koStatus.dbUnfilledOpenCount} משחקים ב{koStatus.currentStageLabel ?? "שלב הנוכחי"} ←
                </Link>
              ) : (
                <span className="text-emerald-700">✓ כל {koStatus.openCount} המשחקים בשלב הנוכחי נשמרו בדאטהבייס</span>
              )}
            </div>
          </div>
        )}
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
  const [showLockedCelebration, setShowLockedCelebration] = useState(false);
  const [showKoLive, setShowKoLive] = useState(false);
  const { loading: dataLoading } = useSharedData();
  const koStatus = useRealKnockoutStatus();

  const groupsFilled = useBettingStore((s) => s.getCompletedGroupsCount());
  const knockoutFilled = useBettingStore((s) => Object.keys(s.knockout).filter((k) => s.knockout[k]?.winner).length);
  const specialsFilled = useBettingStore((s) => s.getSpecialsFilledCount());
  const bettingOverallPct = Math.round((groupsFilled / 12 + knockoutFilled / 31 + specialsFilled / 24) / 3 * 100);

  // Completion per betting destination — drives the green ✓ in the הימורים menu.
  const stepDone: Record<string, boolean> = {
    "/groups": groupsFilled >= 12,
    "/knockout": knockoutFilled >= 31,
    "/special-bets": specialsFilled >= 24,
  };
  // Real-data tree "done" = all currently-open matches predicted (it fills round
  // by round, so completion is relative to what's open right now).
  const koLiveDone = koStatus.groupStageComplete && koStatus.openCount > 0 && koStatus.unfilledOpenCount === 0;

  const appReady = authReady && !dataLoading;

  useEffect(() => {
    try {
      const last = localStorage.getItem("wc_last_visited");
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

  // One-time nudge when the group stage ends and the real-data tree opens.
  useEffect(() => {
    if (!appReady || !koStatus.groupStageComplete) return;
    try {
      if (!localStorage.getItem("wc_ko_live_opened_seen") && pathname !== "/knockout-live") {
        setShowKoLive(true);
      }
    } catch { /* ignore */ }
  }, [appReady, koStatus.groupStageComplete, pathname]);

  const dismissKoLive = () => {
    setShowKoLive(false);
    try { localStorage.setItem("wc_ko_live_opened_seen", "true"); } catch { /* ignore */ }
  };

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
  const inBettingFlow = isBettingPage || pathname === "/knockout-live";
  const isTrackingPage = TRACKING_ITEMS.some(p => pathname === p.href);

  // Skip splash for returning users who visited within last 24h
  if (!appReady) {
    return (
      <div className="fixed inset-0 bg-[#F8F9FB] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
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

      {showKoLive && (
        <KoLiveOpenModal
          openCount={koStatus.openCount}
          onClose={dismissKoLive}
          onGo={() => { dismissKoLive(); router.push("/knockout-live"); }}
        />
      )}

      {/* Top progress strip — animates on every navigation so tapping a
          nav item feels responsive even when the destination page is
          fetching data on mount. Wrapped in Suspense because it reads
          search params, which Next.js requires to be suspense-bounded. */}
      <Suspense fallback={null}><NavProgressBar /></Suspense>

      {/* ════════════════════════════════════════════ */}
      {/* DESKTOP HEADER                              */}
      {/* ════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 lg:h-16 px-4 lg:px-6">
          <Link href="/standings" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="The Minhelet" className="w-10 h-10 lg:w-14 lg:h-14 rounded-full object-cover shadow-lg" />
            <div className="hidden lg:flex flex-col">
              <span className="font-bold text-sm lg:text-lg text-gray-900 leading-tight" style={{ fontFamily: "var(--font-secular)" }}>THE MINHELET</span>
              <span className="text-[9px] lg:text-xs text-gray-400 font-medium" style={{ fontFamily: "var(--font-inter)" }}>WORLD CUP 2026</span>
            </div>
          </Link>

          <nav className="flex items-center gap-0.5 lg:gap-1">
            {/* BETTING — dropdown with blue accent */}
            <div className="relative">
              <button onClick={() => { setShowBetsMenu(!showBetsMenu); setShowUserMenu(false); }}
                className={`relative flex items-center gap-1.5 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${
                  isBettingPage ? "bg-gradient-to-l from-blue-600 to-indigo-600 text-white shadow-md" : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                }`}>
                {Icons.bets(isBettingPage)}
                <span>הימורים</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                {koStatus.unfilledOpenCount > 0 && (
                  <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black shadow ring-2 ring-white animate-pulse" style={{ fontFamily: "var(--font-inter)" }}>
                    {koStatus.unfilledOpenCount}
                  </span>
                )}
              </button>
              {showBetsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBetsMenu(false)}></div>
                  <div className="absolute top-full mt-2 start-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-60">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-400 font-bold">3 שלבים להשלמת ההימורים</p>
                    </div>
                    {BETTING_PAGES.map(p => {
                      const done = stepDone[p.href];
                      return (
                      <Link key={p.href} href={p.href} onClick={() => setShowBetsMenu(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                          pathname === p.href ? "bg-blue-50 text-blue-700" : done ? "text-green-700 hover:bg-gray-50" : "text-gray-700 hover:bg-gray-50"
                        }`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          done ? "bg-green-500 text-white" : pathname === p.href ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                        }`}>{done ? "✓" : p.step}</span>
                        {p.label}
                      </Link>
                      );
                    })}
                    <div className="px-4 pt-2 pb-1 mt-1 border-t border-gray-100">
                      <p className="text-xs text-gray-400 font-bold">במהלך הטורניר</p>
                    </div>
                    <Link href="/knockout-live" onClick={() => setShowBetsMenu(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        pathname === "/knockout-live" ? "bg-emerald-50 text-emerald-700" : koLiveDone ? "text-green-700 hover:bg-gray-50" : "text-gray-700 hover:bg-gray-50"
                      }`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        koLiveDone ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
                      }`}>{koLiveDone ? "✓" : ""}</span>
                      עץ נתוני אמת
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* TRACKING — regular nav items */}
            {TRACKING_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${
                    isActive ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-100"
                  }`}>
                  {Icons[item.iconKey](isActive)}
                  <span>{item.label}</span>
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
      {inBettingFlow && <BettingSubNav pathname={pathname} />}

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
      <SaveBeforeNav />
      <SaveFlushOnNav />
      <ToastHost />
      <ConflictResolutionModal />
      <VersionWatcher />

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
          <Link href="/schedule"
            className={`flex flex-col items-center gap-0.5 py-1 ${pathname === "/schedule" ? "text-gray-900" : "text-gray-400"}`}>
            {Icons.schedule(pathname === "/schedule")}
            <span className="text-[8px] font-bold">לו״ז</span>
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
          <Link href="/rules"
            className={`flex flex-col items-center gap-0.5 py-1 ${pathname === "/rules" ? "text-gray-900" : "text-gray-400"}`}>
            {Icons.rules(pathname === "/rules")}
            <span className="text-[8px] font-bold">חוקים</span>
          </Link>
          <Link href="/groups"
            className={`flex flex-col items-center gap-0.5 py-1 ${inBettingFlow ? "text-blue-600" : "text-gray-400"}`}>
            {Icons.bets(inBettingFlow)}
            <span className="text-[8px] font-bold">הימורים</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
