"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useBettingStore } from "@/stores/betting-store";
import { ALL_TEAMS } from "@/lib/tournament/groups";
import { SQUADS_DATA } from "@/lib/tournament/squads-data";
import { getFlag } from "@/lib/flags";
import { PageTransition } from "@/components/shared/PageTransition";
import { useConfetti } from "@/hooks/useConfetti";

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

// Order: attackers first (FW → MID → DEF → GK). Top-scorer/top-assists candidates
// usually sit at the top. Within each position, keep the squad order.
const POS_ORDER: Record<string, number> = { FW: 0, MID: 1, DEF: 2, GK: 3 };
function getSquadPlayers(team: string): string[] {
  const squad = SQUADS_DATA[team];
  if (!squad) return [];
  return [...squad.players]
    .sort((a, b) => (POS_ORDER[a.pos] ?? 99) - (POS_ORDER[b.pos] ?? 99))
    .map(p => p.nameEn);
}

function SectionCard({ title, subtitle, points, warning, children }: { title: string; subtitle?: string; points: string; warning?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all">
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600 mt-0.5 font-medium">{subtitle}</p>}
        </div>
        <span className="text-sm font-bold rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 shadow-md">{points}</span>
      </div>
      {warning && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs font-medium text-amber-800 flex items-start gap-1.5">
          <span>❕</span><span>{warning}</span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function TeamSelect({ value, onChange, label, excludeCodes = [] }: { value: string; onChange: (v: string) => void; label: string; excludeCodes?: string[] }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">בחרו נבחרת...</option>
        {ALL_TEAMS.filter(t => !excludeCodes.includes(t.code) || t.code === value).map(t => (
          <option key={t.code} value={t.code}>{getFlag(t.code)} {t.name_he}</option>
        ))}
      </select>
    </div>
  );
}

function PlayerSelect({ team, value, onChange, label }: { team: string; value: string; onChange: (v: string) => void; label: string }) {
  const players = team ? getSquadPlayers(team) : [];
  const hasSquad = players.length > 0;
  const listId = `players-${team}`;
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {!team ? (
        <div className="px-3 py-2.5 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 font-medium">בחרו קודם נבחרת</div>
      ) : (
        <>
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            list={hasSquad ? listId : undefined}
            placeholder={hasSquad ? "בחרו או הקלידו שם שחקן..." : "הקלידו שם שחקן..."}
            dir="ltr"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {hasSquad && (
            <datalist id={listId}>
              {players.map(p => <option key={p} value={p} />)}
            </datalist>
          )}
          {!hasSquad && (
            <p className="text-[11px] text-gray-400">הסגל לנבחרת הזו עוד לא עודכן — הקלידו שם שחקן ידנית</p>
          )}
        </>
      )}
    </div>
  );
}

export default function SpecialBetsPage() {
  const sb = useBettingStore((s) => s.specialBets);
  const set = useBettingStore((s) => s.setSpecialBet);
  const knockout = useBettingStore((s) => s.knockout);

  // Derive expected advances from the user's knockout tree
  const expected = useMemo(() => ({
    winner: knockout.final?.winner || "",
    finalist1: knockout.sfl_0?.winner || "",
    finalist2: knockout.sfr_0?.winner || "",
    semifinalists: [
      knockout.qfl_0?.winner || "",
      knockout.qfl_1?.winner || "",
      knockout.qfr_0?.winner || "",
      knockout.qfr_1?.winner || "",
    ],
    quarterfinalists: [
      knockout.r16l_0?.winner || "",
      knockout.r16l_1?.winner || "",
      knockout.r16l_2?.winner || "",
      knockout.r16l_3?.winner || "",
      knockout.r16r_0?.winner || "",
      knockout.r16r_1?.winner || "",
      knockout.r16r_2?.winner || "",
      knockout.r16r_3?.winner || "",
    ],
  }), [knockout]);

  // Auto-fill EMPTY fields from the knockout tree (never overwrites user choices)
  useEffect(() => {
    const state = useBettingStore.getState();
    const current = state.specialBets;
    const setBet = state.setSpecialBet;

    if (!current.winner && expected.winner) setBet("winner", expected.winner);
    if (!current.finalist1 && expected.finalist1) setBet("finalist1", expected.finalist1);
    if (!current.finalist2 && expected.finalist2) setBet("finalist2", expected.finalist2);

    const sfMerged = current.semifinalists.map((v, i) => v || expected.semifinalists[i]);
    if (sfMerged.some((v, i) => v !== current.semifinalists[i])) setBet("semifinalists", sfMerged);

    const qfMerged = current.quarterfinalists.map((v, i) => v || expected.quarterfinalists[i]);
    if (qfMerged.some((v, i) => v !== current.quarterfinalists[i])) setBet("quarterfinalists", qfMerged);
  }, [expected]);

  // Mismatch detection (team sets — order doesn't matter)
  const sameSet = (a: string[], b: string[]) => {
    const A = a.filter(Boolean), B = b.filter(Boolean);
    if (A.length === 0 || B.length === 0) return true;
    if (A.length !== B.length) return false;
    const as = new Set(A);
    return B.every(x => as.has(x));
  };

  const winnerMismatch = sb.winner && expected.winner && sb.winner !== expected.winner
    ? `לפי העץ שלך הזוכה היא ${expected.winner}` : "";
  const finalsMismatch = !sameSet([sb.finalist1, sb.finalist2], [expected.finalist1, expected.finalist2])
    ? `לפי העץ שלך: ${[expected.finalist1, expected.finalist2].filter(Boolean).join(", ")}` : "";
  const sfMismatch = !sameSet(sb.semifinalists, expected.semifinalists)
    ? `לפי העץ שלך: ${expected.semifinalists.filter(Boolean).join(", ")}` : "";
  const qfMismatch = !sameSet(sb.quarterfinalists, expected.quarterfinalists)
    ? `לפי העץ שלך: ${expected.quarterfinalists.filter(Boolean).join(", ")}` : "";

  const filledCount = [sb.winner, sb.finalist1, sb.finalist2, ...sb.semifinalists, ...sb.quarterfinalists,
    sb.topScorerPlayer, sb.topAssistsPlayer, sb.bestAttack, sb.prolificGroup, sb.driestGroup,
    sb.dirtiestTeam, ...sb.matchups, sb.penaltiesOverUnder].filter(Boolean).length;

  // Celebrate every time the user transitions from <25 to 25 filled bets
  const fireConfetti = useConfetti();
  const [showCelebration, setShowCelebration] = useState(false);
  const prevCountRef = useRef(filledCount);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = filledCount;
    // Only trigger on the transition (prev < 25 && now === 25), not on mount
    if (prev < 25 && filledCount === 25) {
      setShowCelebration(true);
      fireConfetti();
      const interval = setInterval(() => fireConfetti(), 800);
      const timeout = setTimeout(() => clearInterval(interval), 3500);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
  }, [filledCount, fireConfetti]);

  return (
    <PageTransition>
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>הימורים מיוחדים</h1>
        <p className="text-base text-gray-600 mt-1">בחרו את העולות בכל שלב, מלך שערים, מלך בישולים ועוד</p>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-xl bg-gradient-to-l from-blue-50 to-white border border-blue-200 px-5 py-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-800">ננעל יום לפני הטורניר</p>
          <p className="text-sm text-gray-500">10.06.2026, 17:00 (שעון ישראל)</p>
        </div>
        <div className="text-center bg-white rounded-lg border border-gray-200 px-3 py-1.5 shadow-sm">
          <span className="text-lg font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{filledCount}</span>
          <span className="text-sm text-gray-400">/25</span>
        </div>
      </div>

      {/* Celebration modal — fires when all 25 bets are filled */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            key="celebration-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCelebration(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.7 }}
              onClick={e => e.stopPropagation()}
              className="relative bg-gradient-to-br from-amber-50 via-white to-blue-50 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border-4 border-amber-300"
            >
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-300/40 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-300/40 rounded-full blur-3xl" />
              <div className="relative p-8 text-center">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
                  className="text-7xl mb-4"
                >
                  🏆
                </motion.div>
                <h2 className="text-4xl font-black text-gray-900 mb-2" style={{ fontFamily: "var(--font-secular)" }}>
                  כל הכבוד!
                </h2>
                <p className="text-lg text-gray-700 mb-1 font-bold">סיימת את כל ההימורים!</p>
                <p className="text-sm text-gray-500 mb-6">
                  כל 25 ההימורים מולאו · הברקט שלך מוכן ✨<br/>
                  עכשיו רק לחכות לשריקת הפתיחה
                </p>
                <div className="grid grid-cols-3 gap-2 mb-6 text-xs">
                  <div className="bg-white/80 rounded-lg py-2 border border-gray-200"><div className="text-2xl">🏟️</div><div className="font-bold text-gray-700 mt-1">72 בתים</div></div>
                  <div className="bg-white/80 rounded-lg py-2 border border-gray-200"><div className="text-2xl">🏅</div><div className="font-bold text-gray-700 mt-1">31 נוקאאוט</div></div>
                  <div className="bg-white/80 rounded-lg py-2 border border-gray-200"><div className="text-2xl">⭐</div><div className="font-bold text-gray-700 mt-1">25 מיוחדים</div></div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/compare"
                    className="flex-1 py-3 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-shadow"
                    onClick={() => setShowCelebration(false)}
                  >
                    לדף השוואה
                  </Link>
                  <button
                    onClick={() => setShowCelebration(false)}
                    className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
                  >
                    סגור
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b-2 border-gray-200">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <div><h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>הימורי עולות</h2><p className="text-sm text-gray-500">מי תעלה בכל שלב?</p></div>
        </div>

        <SectionCard title="זוכה הטורניר" subtitle="מי לוקח את הגביע?" points="12 נק׳" warning={winnerMismatch}>
          <div className="max-w-xs"><TeamSelect value={sb.winner} onChange={(v) => set("winner", v)} label="הנבחרת הזוכה" /></div>
        </SectionCard>

        <SectionCard title="עולות לגמר" subtitle="2 נבחרות" points="8 נק׳ כ״א" warning={finalsMismatch}>
          <div className="grid grid-cols-2 gap-3">
            <TeamSelect value={sb.finalist1} onChange={(v) => set("finalist1", v)} label="עולה לגמר 1" excludeCodes={[sb.finalist2]} />
            <TeamSelect value={sb.finalist2} onChange={(v) => set("finalist2", v)} label="עולה לגמר 2" excludeCodes={[sb.finalist1]} />
          </div>
        </SectionCard>

        <SectionCard title="עולות לחצי גמר" subtitle="4 נבחרות" points="6 נק׳ כ״א" warning={sfMismatch}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sb.semifinalists.map((v, i) => (
              <TeamSelect key={i} value={v} onChange={(val) => { const n = [...sb.semifinalists]; n[i] = val; set("semifinalists", n); }}
                label={`חצי ${i+1}`} excludeCodes={sb.semifinalists.filter((s, j) => j !== i && s)} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="עולות לרבע גמר" subtitle="8 נבחרות" points="4 נק׳ כ״א" warning={qfMismatch}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sb.quarterfinalists.map((v, i) => (
              <TeamSelect key={i} value={v} onChange={(val) => { const n = [...sb.quarterfinalists]; n[i] = val; set("quarterfinalists", n); }}
                label={`רבע ${i+1}`} excludeCodes={sb.quarterfinalists.filter((s, j) => j !== i && s)} />
            ))}
          </div>
        </SectionCard>

        <div className="border-t-2 border-gray-200 pt-6 flex items-center gap-3 pb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <div><h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>הימורים מיוחדים</h2><p className="text-sm text-gray-500">שחקנים, נבחרות וסטטיסטיקות</p></div>
        </div>

        <SectionCard title="מלך שערים" subtitle="בחרו נבחרת ואז שחקן" points="9 / 5 נק׳">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <TeamSelect value={sb.topScorerTeam} onChange={(v) => { set("topScorerTeam", v); set("topScorerPlayer", ""); }} label="נבחרת" />
            <PlayerSelect team={sb.topScorerTeam} value={sb.topScorerPlayer} onChange={(v) => set("topScorerPlayer", v)} label="שחקן" />
          </div>
        </SectionCard>

        <SectionCard title="מלך בישולים" subtitle="בחרו נבחרת ואז שחקן" points="7 / 4 נק׳">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <TeamSelect value={sb.topAssistsTeam} onChange={(v) => { set("topAssistsTeam", v); set("topAssistsPlayer", ""); }} label="נבחרת" />
            <PlayerSelect team={sb.topAssistsTeam} value={sb.topAssistsPlayer} onChange={(v) => set("topAssistsPlayer", v)} label="שחקן" />
          </div>
        </SectionCard>

        <SectionCard title="ההתקפה הטובה ביותר" subtitle="הנבחרת עם הכי הרבה שערים בטורניר" points="6 נק׳">
          <div className="max-w-xs"><TeamSelect value={sb.bestAttack} onChange={(v) => set("bestAttack", v)} label="נבחרת" /></div>
        </SectionCard>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionCard title="הבית הכי פורה" subtitle="הכי הרבה שערים בבתים" points="5 נק׳">
            <select value={sb.prolificGroup} onChange={e => set("prolificGroup", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">בחרו בית...</option>{GROUPS.map(g => <option key={g} value={g}>בית {g}</option>)}
            </select>
          </SectionCard>
          <SectionCard title="הבית הכי יבש" subtitle="הכי מעט שערים בבתים" points="5 נק׳">
            <select value={sb.driestGroup} onChange={e => set("driestGroup", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">בחרו בית...</option>{GROUPS.filter(g => g !== sb.prolificGroup).map(g => <option key={g} value={g}>בית {g}</option>)}
            </select>
          </SectionCard>
        </div>

        <SectionCard title="הנבחרת הכסחנית" subtitle="צהוב=1, אדום=3 נק׳ כסחנות" points="5 נק׳">
          <div className="max-w-xs"><TeamSelect value={sb.dirtiestTeam} onChange={(v) => set("dirtiestTeam", v)} label="נבחרת" /></div>
        </SectionCard>

        <div className="border-t-2 border-gray-200 pt-6 flex items-center gap-3 pb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div><h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>מאצ׳אפים</h2><p className="text-sm text-gray-500">שערים + בישולים בכל הטורניר</p></div>
        </div>

        {[
          { id: 0, p1: "🇫🇷 Mbappé", p2: "🇧🇷 Vinícius Jr." },
          { id: 1, p1: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Bellingham", p2: "🇪🇸 Yamal" },
          { id: 2, p1: "🇦🇷 Messi", p2: "🇵🇹 Ronaldo" },
        ].map(mu => (
          <SectionCard key={mu.id} title={`${mu.p1} vs ${mu.p2}`} subtitle="מי יצבור יותר?" points="5 נק׳">
            <div className="flex gap-2">
              {[{ val: "1", label: mu.p1 }, { val: "X", label: "שווה" }, { val: "2", label: mu.p2 }].map(opt => (
                <button key={opt.val} onClick={() => { const n = [...sb.matchups]; n[mu.id] = opt.val; set("matchups", n); }}
                  className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                    sb.matchups[mu.id] === opt.val ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </SectionCard>
        ))}

        <SectionCard title="סה״כ פנדלים בטורניר" subtitle="אובר / אנדר 18.5" points="5 נק׳">
          <div className="flex gap-3">
            {[{ val: "OVER", label: "מעל 18.5" }, { val: "UNDER", label: "מתחת 18.5" }].map(opt => (
              <button key={opt.val} onClick={() => set("penaltiesOverUnder", opt.val)}
                className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                  sb.penaltiesOverUnder === opt.val ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>{opt.label}</button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
    </PageTransition>
  );
}
