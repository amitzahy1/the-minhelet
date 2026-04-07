"use client";

function GuideSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <summary className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between font-bold text-gray-900">
        {title}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div className="px-5 pb-4 text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-3">{children}</div>
    </details>
  );
}

export function AdminGuide() {
  return (
    <div className="space-y-3" dir="rtl">
      <GuideSection title="סקירה כללית — מה זה The Minhelet?" defaultOpen>
        <p className="mb-2">פלטפורמת הימורים פרטית למונדיאל 2026. חברי הקבוצה נרשמים, מזינים הימורים על כל שלב בטורניר, ומתחרים על ניקוד.</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-gray-50 rounded-lg p-3"><strong>כתובת:</strong> the-minhelet.vercel.app</div>
          <div className="bg-gray-50 rounded-lg p-3"><strong>קוד כניסה:</strong> minhelet26</div>
          <div className="bg-gray-50 rounded-lg p-3"><strong>נבחרות:</strong> 48</div>
          <div className="bg-gray-50 rounded-lg p-3"><strong>משחקים:</strong> 104</div>
        </div>
      </GuideSection>

      <GuideSection title="תהליך המשתמש — מה כל אחד צריך לעשות" defaultOpen>
        <div className="space-y-3">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="font-bold text-blue-800 mb-1">שלב 1: שלב הבתים</p>
            <p className="text-blue-700">הזנת תוצאה מדויקת ל-72 משחקים ב-12 בתים. הטבלה מתעדכנת אוטומטית לפי חוקי FIFA.</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <p className="font-bold text-amber-800 mb-1">שלב 2: עץ הנוק-אאוט</p>
            <p className="text-amber-700">הנבחרות שעלו מהבתים מופיעות אוטומטית. הזנת תוצאה + בחירת מי עולה מהשמינית ועד הגמר.</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
            <p className="font-bold text-purple-800 mb-1">שלב 3: הימורים מיוחדים</p>
            <p className="text-purple-700">מי זוכה, עולות לכל שלב, מלך שערים, מלך בישולים, כסחנית, מאצ׳אפים, פנדלים.</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <p className="font-bold text-red-800">נעילה: 10 ביוני 2026, 17:00 (שעון ישראל) — אי אפשר לשנות אחרי!</p>
          </div>
        </div>
      </GuideSection>

      <GuideSection title="מבנה הניקוד">
        <h4 className="font-bold mb-2">הימורי תוצאות (לכל משחק)</h4>
        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden mb-4">
          <thead><tr className="bg-gray-100"><th className="py-2 px-3 text-start">שלב</th><th className="py-2 px-3 text-center">טוטו</th><th className="py-2 px-3 text-center">מדויקת</th><th className="py-2 px-3 text-center">סה״כ</th></tr></thead>
          <tbody>
            {[["בתים",2,1,3],["שמינית/רבע",3,1,4],["חצי גמר",3,2,5],["גמר",4,2,6]].map(([s,t,e,tot]) => (
              <tr key={String(s)} className="border-t border-gray-100"><td className="py-1.5 px-3">{s}</td><td className="py-1.5 px-3 text-center text-blue-600 font-bold">{t}</td><td className="py-1.5 px-3 text-center text-green-600 font-bold">+{e}</td><td className="py-1.5 px-3 text-center font-bold">{tot}</td></tr>
            ))}
          </tbody>
        </table>
        <h4 className="font-bold mb-2">הימורי עולות (מבעוד מועד)</h4>
        <ul className="space-y-1 mb-4">
          <li>• עולה מדויקת מהבית: <strong>5 נק׳</strong> · עולה לא מדויקת: <strong>3 נק׳</strong></li>
          <li>• רבע: <strong>4</strong> · חצי: <strong>6</strong> · גמר: <strong>8</strong> · זוכה: <strong>12</strong></li>
        </ul>
        <h4 className="font-bold mb-2">הימורים מיוחדים</h4>
        <ul className="space-y-1 mb-4">
          <li>• מלך שערים: <strong>9</strong> (מוחלט) / <strong>5</strong> (יחסי)</li>
          <li>• מלך בישולים: <strong>7</strong> / <strong>4</strong></li>
          <li>• התקפה, כסחנית, בית פורה/יבש, מאצ׳אפ, פנדלים: <strong>5-6</strong> כ״א</li>
        </ul>
        <h4 className="font-bold mb-2">שובר שוויון</h4>
        <ol className="space-y-0.5">
          {["זוכה","עולות לגמר","טוטו גמר","עולות לחצי","טוטו חצי","מלך שערים","עולות לרבע"].map((r,i) => (
            <li key={i}>{i+1}. {r}</li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection title="עדכון תוצאות — אוטומטי וידני">
        <div className="space-y-3">
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="font-bold text-green-800 mb-1">אוטומטי — Football-Data.org</p>
            <p className="text-green-700">בטאב ״תוצאות משחקים״ → לחצו ״סנכרון עכשיו״. מושך תוצאות מה-API. חינמי, 10 בקשות/דקה.</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="font-bold text-blue-800 mb-1">ידני</p>
            <p className="text-blue-700">בטאב ״תוצאות משחקים״ → בחרו משחק → הזינו תוצאה → נשמר מיד.</p>
          </div>
        </div>
      </GuideSection>

      <GuideSection title="דפי האתר — מה כל דף עושה">
        <div className="space-y-2">
          {[
            { name: "דירוג", path: "/standings", desc: "טבלת ניקוד כולל, השוואת מהמרים, מלכי קטגוריות, גרפים" },
            { name: "השוואה", path: "/compare", desc: "השוואה מלאה בין כל המהמרים — עולות, מיוחדים, בתים" },
            { name: "לו״ז", path: "/schedule", desc: "לוח 104 משחקים בשעון ישראל, סינון לפי בית" },
            { name: "לייב", path: "/live", desc: "משחקים חיים, ניחושי חברים, בריאות העץ שלך" },
            { name: "נבחרות", path: "/squads", desc: "סגלים של 48 נבחרות, הרכב פתיחה על מגרש" },
            { name: "חוקים", path: "/rules", desc: "כל טבלאות הניקוד, שוברי שוויון, לוח זמנים" },
            { name: "הימורי משתמש", path: "/groups", desc: "3 שלבים: בתים → נוק-אאוט → מיוחדים" },
            { name: "ניהול", path: "/admin", desc: "תוצאות, ניקוד, טורנירים, מנהלים, מדריך" },
          ].map(p => (
            <div key={p.name} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
              <span className="font-bold text-gray-800 shrink-0 w-20">{p.name}</span>
              <span className="text-gray-500 text-xs shrink-0" dir="ltr">{p.path}</span>
              <span className="text-gray-600 flex-1">{p.desc}</span>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection title="גיבויים ושמירת נתונים">
        <ul className="space-y-2">
          <li>• <strong>שמירה אוטומטית:</strong> כל שינוי בהימורים נשמר ב-localStorage + Supabase (ענן)</li>
          <li>• <strong>גיבוי יומי:</strong> כל יום נשמר snapshot מלא של כל ההימורים ב-localStorage</li>
          <li>• <strong>ייצוא CSV:</strong> בדף הדירוג יש כפתור CSV להורדת כל הנתונים</li>
          <li>• <strong>ייצוא JSON:</strong> כפתור ״גיבוי״ בדף הדירוג מוריד גיבוי מלא</li>
          <li>• <strong>שחזור:</strong> ניתן לשחזר מגיבוי דרך קונסולת הדפדפן</li>
        </ul>
      </GuideSection>

      <GuideSection title="שאלות נפוצות">
        {[
          { q: "משתמש שכח להזין הימורים?", a: "לא מקבל נקודות על מה שלא הזין." },
          { q: "הוספת משתמש אחרי הטורניר התחיל?", a: "אפשר, אבל יפסיד נקודות על בתים ועולות." },
          { q: "טעות בתוצאה?", a: "מנהל מתקן בטאב ״תוצאות משחקים״." },
          { q: "שינוי קוד הכניסה?", a: "בקובץ src/app/api/verify-code/route.ts" },
          { q: "שינוי ניקוד?", a: "בטאב ״ניקוד״ בדף הניהול — מיידי." },
          { q: "הוספת מנהל?", a: "בטאב ״מנהלים״ — הזנת אימייל." },
          { q: "איפה רואים הימורים של כולם?", a: "דף ״השוואה״ מציג הכל." },
        ].map(({ q, a }) => (
          <div key={q} className="py-2 border-b border-gray-100 last:border-0">
            <p className="font-bold text-gray-800">{q}</p>
            <p className="text-gray-500 text-xs mt-0.5">{a}</p>
          </div>
        ))}
      </GuideSection>

      <GuideSection title="פרטים טכניים">
        <div className="space-y-2 text-xs text-gray-500">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2"><strong>Framework:</strong> Next.js 15</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Language:</strong> TypeScript</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Styling:</strong> Tailwind CSS v4 + shadcn/ui</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>State:</strong> Zustand + persist</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>DB:</strong> Supabase (PostgreSQL)</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Auth:</strong> Supabase Auth (Google + Email)</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>API (matches):</strong> Football-Data.org</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>API (live):</strong> API-Football</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Deploy:</strong> Vercel</div>
            <div className="bg-gray-50 rounded-lg p-2"><strong>Repo:</strong> github.com/amitzahy1/the-minhelet</div>
          </div>
          <h4 className="font-bold text-gray-700 mt-3">מבנה טבלאות DB (Supabase)</h4>
          <ul className="space-y-0.5">
            {[
              "profiles — פרופילי משתמשים",
              "leagues — ליגות פרטיות",
              "league_members — חברות בליגה",
              "teams — 48 נבחרות",
              "matches — 104 משחקים",
              "user_brackets — עץ הימורים (JSONB)",
              "advancement_picks — הימורי עולות",
              "special_bets — הימורים מיוחדים",
              "match_predictions — הימורי תוצאות",
              "scoring_log — יומן ניקוד",
              "scoring_config — הגדרות ניקוד (ניתן לשינוי)",
              "tournaments — טורנירים (WC2026, WC2030...)",
              "admins — רשימת מנהלים",
            ].map(t => <li key={t}>• {t}</li>)}
          </ul>
          <h4 className="font-bold text-gray-700 mt-3">Environment Variables</h4>
          <ul className="space-y-0.5 font-mono text-[10px]">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>SUPABASE_SERVICE_ROLE_KEY</li>
            <li>FOOTBALL_DATA_TOKEN</li>
            <li>API_FOOTBALL_KEY</li>
          </ul>
        </div>
      </GuideSection>
    </div>
  );
}
