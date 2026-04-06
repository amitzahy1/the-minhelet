"use client";

import { useState, useMemo } from "react";

// ============================================================================
// Special Bets Page — With VALIDATION (no duplicates) + cascading team→player
// More special bets added for fun
// ============================================================================

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

const ALL_TEAMS = [
  { code: "ARG", flag: "🇦🇷", name: "ארגנטינה" }, { code: "BRA", flag: "🇧🇷", name: "ברזיל" },
  { code: "FRA", flag: "🇫🇷", name: "צרפת" }, { code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "אנגליה" },
  { code: "ESP", flag: "🇪🇸", name: "ספרד" }, { code: "GER", flag: "🇩🇪", name: "גרמניה" },
  { code: "POR", flag: "🇵🇹", name: "פורטוגל" }, { code: "NED", flag: "🇳🇱", name: "הולנד" },
  { code: "ITA", flag: "🇮🇹", name: "איטליה" }, { code: "BEL", flag: "🇧🇪", name: "בלגיה" },
  { code: "CRO", flag: "🇭🇷", name: "קרואטיה" }, { code: "URU", flag: "🇺🇾", name: "אורוגוואי" },
  { code: "JPN", flag: "🇯🇵", name: "יפן" }, { code: "KOR", flag: "🇰🇷", name: "דרום קוריאה" },
  { code: "MAR", flag: "🇲🇦", name: "מרוקו" }, { code: "SEN", flag: "🇸🇳", name: "סנגל" },
  { code: "USA", flag: "🇺🇸", name: "ארה״ב" }, { code: "MEX", flag: "🇲🇽", name: "מקסיקו" },
  { code: "COL", flag: "🇨🇴", name: "קולומביה" }, { code: "ECU", flag: "🇪🇨", name: "אקוודור" },
];

// Players per team (key players for the cascading select)
const TEAM_PLAYERS: Record<string, string[]> = {
  ARG: ["L. Messi", "L. Martínez", "J. Álvarez", "A. Mac Allister", "E. Fernández", "Á. Di María", "A. Garnacho", "P. Dybala"],
  BRA: ["Vinícius Jr.", "Rodrygo", "Endrick", "B. Guimarães", "L. Paquetá", "Savinho", "Raphinha"],
  FRA: ["K. Mbappé", "A. Griezmann", "O. Dembélé", "M. Thuram", "A. Tchouaméni", "W. Saliba", "R. Kolo Muani"],
  ENG: ["J. Bellingham", "B. Saka", "H. Kane", "P. Foden", "C. Palmer", "D. Rice", "T. Alexander-Arnold"],
  ESP: ["L. Yamal", "N. Williams", "Rodri", "Pedri", "D. Olmo", "A. Morata", "F. Torres"],
  GER: ["J. Musiala", "F. Wirtz", "K. Havertz", "T. Müller", "İ. Gündoğan", "L. Sané", "N. Füllkrug"],
  POR: ["C. Ronaldo", "B. Fernandes", "R. Leão", "B. Silva", "Vitinha", "Pedro Neto", "Diogo Jota"],
  NED: ["C. Gakpo", "X. Simons", "V. van Dijk", "F. de Jong", "M. Depay"],
  ITA: ["F. Chiesa", "N. Barella", "G. Scamacca", "G. Donnarumma", "S. Tonali", "M. Retegui"],
  BEL: ["K. De Bruyne", "R. Lukaku", "J. Doku", "L. Trossard", "Y. Tielemans"],
  CRO: ["L. Modrić", "M. Kovačić", "I. Perišić", "A. Kramarić"],
  URU: ["D. Núñez", "F. Valverde", "R. Bentancur", "R. Araújo"],
  JPN: ["T. Kubo", "K. Mitoma", "D. Kamada", "W. Endo"],
  KOR: ["Son Heung-min", "Lee Kang-in", "Kim Min-jae", "Hwang Hee-chan"],
  MAR: ["H. Ziyech", "A. Hakimi", "Y. En-Nesyri", "S. Amrabat"],
  SEN: ["S. Mané", "I. Sarr", "K. Koulibaly"],
  USA: ["C. Pulisic", "G. Reyna", "W. McKennie", "T. Weah", "R. Balogun"],
  MEX: ["H. Lozano", "S. Giménez", "E. Álvarez"],
  COL: ["L. Díaz", "J. Arias", "R. Falcao", "J. Lerma"],
  ECU: ["M. Caicedo", "G. Plata", "E. Valencia"],
};

function SectionCard({ title, subtitle, points, children }: {
  title: string; subtitle?: string; points: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all">
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600 mt-0.5 font-medium">{subtitle}</p>}
        </div>
        <span className="text-sm font-bold rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 shadow-md">{points}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ValidatedTeamSelect({ value, onChange, label, excludeCodes = [] }: {
  value: string; onChange: (v: string) => void; label: string; excludeCodes?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">בחרו נבחרת...</option>
        {ALL_TEAMS.filter(t => !excludeCodes.includes(t.code) || t.code === value).map(t => (
          <option key={t.code} value={t.code}>{t.flag} {t.name}</option>
        ))}
      </select>
      {excludeCodes.includes(value) && value && (
        <p className="text-xs text-amber-600 font-medium">נבחרת זו כבר נבחרה במקום אחר</p>
      )}
    </div>
  );
}

function PlayerSelect({ team, value, onChange, label }: {
  team: string; value: string; onChange: (v: string) => void; label: string;
}) {
  const players = team ? (TEAM_PLAYERS[team] || []) : [];
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {!team ? (
        <div className="px-3 py-2.5 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 font-medium">בחרו קודם נבחרת ←</div>
      ) : (
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" dir="ltr">
          <option value="">בחרו שחקן...</option>
          {players.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
    </div>
  );
}

export function SpecialBetsPage() {
  // Advancement picks with validation
  const [winner, setWinner] = useState("");
  const [finalist1, setFinalist1] = useState("");
  const [finalist2, setFinalist2] = useState("");
  const [sf, setSf] = useState(["", "", "", ""]);
  const [qf, setQf] = useState(["", "", "", "", "", "", "", ""]);

  // All selected codes for duplicate prevention (cascading)
  const allAdvancementCodes = useMemo(() => [winner, finalist1, finalist2, ...sf, ...qf].filter(Boolean), [winner, finalist1, finalist2, sf, qf]);

  // Special bets
  const [scorerTeam, setScorerTeam] = useState("");
  const [scorerPlayer, setScorerPlayer] = useState("");
  const [assistsTeam, setAssistsTeam] = useState("");
  const [assistsPlayer, setAssistsPlayer] = useState("");
  const [bestAttack, setBestAttack] = useState("");
  const [prolificGroup, setProlificGroup] = useState("");
  const [driestGroup, setDriestGroup] = useState("");
  const [dirtiestTeam, setDirtiestTeam] = useState("");
  const [matchup1, setMatchup1] = useState("");
  const [matchup2, setMatchup2] = useState("");
  const [matchup3, setMatchup3] = useState("");
  const [penaltiesPick, setPenaltiesPick] = useState("");
  const [mostGoalsMatch, setMostGoalsMatch] = useState("");
  const [firstRedCard, setFirstRedCard] = useState("");
  const [youngestScorer, setYoungestScorer] = useState("");

  // Prevent selecting same team for SF that's already in Final
  const finalCodes = [finalist1, finalist2].filter(Boolean);
  const sfCodes = sf.filter(Boolean);

  // Fill count
  const filledCount = [winner, finalist1, finalist2, ...sf, ...qf, scorerPlayer, assistsPlayer, bestAttack, prolificGroup, driestGroup, dirtiestTeam, matchup1, matchup2, matchup3, penaltiesPick].filter(Boolean).length;
  const totalBets = 8 + 4 + 2 + 1 + 10; // qf + sf + final + winner + specials

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular), sans-serif" }}>הימורים מיוחדים</h1>
        <p className="text-base text-gray-600 mt-1">בחרו את העולות בכל שלב, מלך שערים, מלך בישולים ועוד — הכל במקום אחד</p>
      </div>

      {/* Lock + progress */}
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-gradient-to-l from-blue-50 to-white border border-blue-200 px-5 py-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-800">ננעל בעוד <strong className="text-blue-600">64 ימים</strong></p>
          <p className="text-sm text-gray-500">10.06.2026, 17:00 (שעון ישראל) · ניתן לשנות עד אז</p>
        </div>
        <div className="text-center bg-white rounded-lg border border-gray-200 px-3 py-1.5 shadow-sm">
          <span className="text-lg font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{filledCount}</span>
          <span className="text-sm text-gray-400">/{totalBets}</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* === ADVANCEMENT PICKS === */}
        <div className="flex items-center gap-3 pb-3 border-b-2 border-gray-200">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <div>
            <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular), sans-serif" }}>הימורי עולות</h2>
            <p className="text-sm text-gray-500 font-medium">מבעוד מועד — מי תעלה בכל שלב?</p>
          </div>
        </div>

        <SectionCard title="זוכה הטורניר" subtitle="מי לוקח את הגביע?" points="12 נק׳">
          <div className="max-w-xs">
            <ValidatedTeamSelect value={winner} onChange={setWinner} label="הנבחרת הזוכה" />
          </div>
        </SectionCard>

        <SectionCard title="עולות לגמר" subtitle="2 נבחרות — הזוכה חייב להיות אחת מהן" points="8 נק׳ כ״א">
          <div className="grid grid-cols-2 gap-3">
            <ValidatedTeamSelect value={finalist1} onChange={setFinalist1} label="עולה לגמר 1" excludeCodes={[finalist2]} />
            <ValidatedTeamSelect value={finalist2} onChange={setFinalist2} label="עולה לגמר 2" excludeCodes={[finalist1]} />
          </div>
          {winner && ![finalist1, finalist2].includes(winner) && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1">הזוכה ({ALL_TEAMS.find(t=>t.code===winner)?.flag} {winner}) חייב להיות אחד מהעולות לגמר</p>
          )}
        </SectionCard>

        <SectionCard title="עולות לחצי גמר" subtitle="4 נבחרות — העולות לגמר חייבות להיכלל" points="6 נק׳ כ״א">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sf.map((v, i) => (
              <ValidatedTeamSelect key={i} value={v}
                onChange={val => { const n = [...sf]; n[i] = val; setSf(n); }}
                label={`חצי ${i+1}`}
                excludeCodes={sf.filter((s, j) => j !== i && s)} />
            ))}
          </div>
          {finalCodes.length > 0 && !finalCodes.every(fc => sfCodes.includes(fc)) && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1">העולות לגמר חייבות להיכלל ב-4 העולות לחצי</p>
          )}
        </SectionCard>

        <SectionCard title="עולות לרבע גמר" subtitle="8 נבחרות" points="4 נק׳ כ״א">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {qf.map((v, i) => (
              <ValidatedTeamSelect key={i} value={v}
                onChange={val => { const n = [...qf]; n[i] = val; setQf(n); }}
                label={`רבע ${i+1}`}
                excludeCodes={qf.filter((s, j) => j !== i && s)} />
            ))}
          </div>
        </SectionCard>

        {/* === SPECIAL BETS === */}
        <div className="border-t-2 border-gray-200 pt-6 flex items-center gap-3 pb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500 shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <div>
            <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular), sans-serif" }}>הימורים מיוחדים</h2>
            <p className="text-sm text-gray-500 font-medium">שחקנים, נבחרות וסטטיסטיקות</p>
          </div>
        </div>

        <SectionCard title="מלך שערים" subtitle="בחרו נבחרת ואז שחקן מהסגל" points="9 / 5 נק׳">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <ValidatedTeamSelect value={scorerTeam} onChange={(v) => { setScorerTeam(v); setScorerPlayer(""); }} label="נבחרת" />
            <PlayerSelect team={scorerTeam} value={scorerPlayer} onChange={setScorerPlayer} label="שחקן" />
          </div>
          <p className="text-xs text-gray-400 mt-2">תפיסה מוחלטת: 9 נק׳ · תפיסה יחסית (מינימום 3 שערים): 5 נק׳</p>
        </SectionCard>

        <SectionCard title="מלך בישולים (אסיסטים)" subtitle="בחרו נבחרת ואז שחקן מהסגל" points="7 / 4 נק׳">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <ValidatedTeamSelect value={assistsTeam} onChange={(v) => { setAssistsTeam(v); setAssistsPlayer(""); }} label="נבחרת" />
            <PlayerSelect team={assistsTeam} value={assistsPlayer} onChange={setAssistsPlayer} label="שחקן" />
          </div>
          <p className="text-xs text-gray-400 mt-2">תפיסה מוחלטת: 7 נק׳ · תפיסה יחסית (מינימום 2 בישולים): 4 נק׳</p>
        </SectionCard>

        <SectionCard title="ההתקפה הטובה ביותר" subtitle="הנבחרת שתבקיע הכי הרבה שערים בכל הטורניר" points="6 נק׳">
          <div className="max-w-xs"><ValidatedTeamSelect value={bestAttack} onChange={setBestAttack} label="נבחרת" /></div>
        </SectionCard>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionCard title="הבית הכי פורה" subtitle="הכי הרבה שערים בשלב הבתים" points="5 נק׳">
            <select value={prolificGroup} onChange={e => setProlificGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">בחרו בית...</option>
              {GROUPS.map(g => <option key={g} value={g}>בית {g}</option>)}
            </select>
          </SectionCard>
          <SectionCard title="הבית הכי יבש" subtitle="הכי מעט שערים בשלב הבתים" points="5 נק׳">
            <select value={driestGroup} onChange={e => setDriestGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">בחרו בית...</option>
              {GROUPS.filter(g => g !== prolificGroup).map(g => <option key={g} value={g}>בית {g}</option>)}
            </select>
          </SectionCard>
        </div>

        <SectionCard title="הנבחרת הכסחנית" subtitle="צהוב = 1 נק׳ כסחנות, אדום = 3 נק׳ כסחנות" points="5 נק׳">
          <div className="max-w-xs"><ValidatedTeamSelect value={dirtiestTeam} onChange={setDirtiestTeam} label="הנבחרת הכסחנית" /></div>
        </SectionCard>

        {/* MATCHUPS — 3 different ones */}
        <div className="border-t-2 border-gray-200 pt-6 flex items-center gap-3 pb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <div>
            <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular), sans-serif" }}>מאצ׳אפים</h2>
            <p className="text-sm text-gray-500 font-medium">שערים + בישולים לאורך כל הטורניר</p>
          </div>
        </div>

        {[
          { id: 1, p1: "🇫🇷 Mbappé", p2: "🇧🇷 Vinícius Jr.", val: matchup1, set: setMatchup1 },
          { id: 2, p1: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Bellingham", p2: "🇪🇸 Yamal", val: matchup2, set: setMatchup2 },
          { id: 3, p1: "🇦🇷 Messi", p2: "🇵🇹 Ronaldo", val: matchup3, set: setMatchup3 },
        ].map(mu => (
          <SectionCard key={mu.id} title={`מאצ׳אפ ${mu.id}: ${mu.p1} vs ${mu.p2}`} subtitle="מי יצבור יותר שערים + בישולים?" points="5 נק׳">
            <div className="flex gap-2">
              {[
                { val: "1", label: mu.p1 },
                { val: "X", label: "שווה" },
                { val: "2", label: mu.p2 },
              ].map(opt => (
                <button key={opt.val} onClick={() => mu.set(opt.val)}
                  className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    mu.val === opt.val ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </SectionCard>
        ))}

        <SectionCard title="סה״כ פנדלים בטורניר" subtitle="אובר / אנדר 18.5" points="5 נק׳">
          <div className="flex gap-3">
            {[{ val: "OVER", label: "מעל 18.5 ⬆" }, { val: "UNDER", label: "מתחת 18.5 ⬇" }].map(opt => (
              <button key={opt.val} onClick={() => setPenaltiesPick(opt.val)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  penaltiesPick === opt.val ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>{opt.label}</button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="המשחק עם הכי הרבה שערים" subtitle="באיזה שלב ייערך המשחק עם הכי הרבה גולים?" points="5 נק׳">
          <div className="flex gap-2 flex-wrap">
            {["בתים", "שמינית", "רבע", "חצי", "גמר"].map(stage => (
              <button key={stage} onClick={() => setMostGoalsMatch(stage)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  mostGoalsMatch === stage ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>{stage}</button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="כרטיס אדום ראשון" subtitle="מאיזו נבחרת יקבל השחקן הראשון כרטיס אדום?" points="5 נק׳">
          <div className="max-w-xs"><ValidatedTeamSelect value={firstRedCard} onChange={setFirstRedCard} label="נבחרת" /></div>
        </SectionCard>

        <SectionCard title="המבקיע הצעיר ביותר" subtitle="מאיזו נבחרת יבקיע המבקיע הצעיר ביותר בטורניר?" points="5 נק׳">
          <div className="max-w-xs"><ValidatedTeamSelect value={youngestScorer} onChange={setYoungestScorer} label="נבחרת" /></div>
        </SectionCard>

        {/* Save */}
        <div className="pt-4">
          <button className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 transition-colors shadow-sm">
            שמירת כל ההימורים ({filledCount}/{totalBets})
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-2">ניתן לשנות עד הנעילה</p>
        </div>
      </div>
    </div>
  );
}
