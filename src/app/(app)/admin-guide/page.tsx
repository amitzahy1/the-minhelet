"use client";

import { PageTransition } from "@/components/shared/PageTransition";

export default function AdminGuidePage() {
  return (
    <PageTransition>
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24" dir="rtl">
      <h1 className="text-3xl font-black text-gray-900 mb-6" style={{ fontFamily: "var(--font-secular)" }}>מדריך למנהלים</h1>

      {/* What is this */}
      <Section title="מה זה The Minhelet?">
        <p>פלטפורמת הימורים פרטית למונדיאל 2026. כל חבר בקבוצה נרשם, מזין את ההימורים שלו, ומתחרה על ניקוד.</p>
        <Info label="כתובת האתר" value="the-minhelet.vercel.app" />
        <Info label="קוד כניסה" value="minhelet26" />
      </Section>

      {/* User flow */}
      <Section title="איך זה עובד — תהליך המשתמש">
        <h3 className="font-bold text-gray-800 mt-4 mb-2">לפני הטורניר (עכשיו עד 10 ביוני)</h3>
        <ol className="space-y-2 text-gray-700">
          <li className="flex gap-2"><span className="font-black text-blue-600 shrink-0">1.</span> משתמש נכנס לאתר ← מזין קוד ← נרשם עם Google או אימייל</li>
          <li className="flex gap-2"><span className="font-black text-blue-600 shrink-0">2.</span> ממלא <strong>שלב הבתים</strong> — הזנת תוצאה מדויקת ל-72 משחקים ב-12 בתים</li>
          <li className="flex gap-2"><span className="font-black text-blue-600 shrink-0">3.</span> ממלא <strong>עץ הנוק-אאוט</strong> — הזנת תוצאה + מי עולה מהשמינית ועד הגמר</li>
          <li className="flex gap-2"><span className="font-black text-blue-600 shrink-0">4.</span> ממלא <strong>הימורים מיוחדים</strong> — מי זוכה, עולות, מלך שערים, כסחנית ועוד</li>
        </ol>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="font-bold text-amber-800">ב-10 ביוני 17:00 — כל ההימורים ננעלים. לא ניתן לשנות יותר.</p>
        </div>

        <h3 className="font-bold text-gray-800 mt-6 mb-2">במהלך הטורניר (11 ביוני — 19 ביולי)</h3>
        <ul className="space-y-1 text-gray-700">
          <li>• הימורי תוצאות נוק-אאוט ניתן לשנות עד 30 דקות לפני כל משחק</li>
          <li>• התוצאות מתעדכנות (ידנית או אוטומטית מ-API)</li>
          <li>• הניקוד מחושב אוטומטית</li>
          <li>• הדירוג מתעדכן בזמן אמת</li>
        </ul>
      </Section>

      {/* Admin panel */}
      <Section title="דף ניהול — מה אפשר לעשות">
        <p className="text-gray-600 mb-3">כתובת: <strong>the-minhelet.vercel.app/admin</strong></p>

        <h3 className="font-bold text-gray-800 mt-4 mb-2">טאב 1: תוצאות משחקים</h3>
        <ul className="space-y-1 text-gray-700">
          <li>• <strong>סנכרון אוטומטי</strong> — לחיצה על ״סנכרון עכשיו״ מושכת תוצאות מ-Football-Data.org</li>
          <li>• <strong>הזנה ידנית</strong> — אם ה-API לא עודכן, אפשר להזין תוצאות ידנית</li>
          <li>• רשימת כל המשחקים עם סינון לפי שלב</li>
          <li>• משחקים שהוזנו מסומנים בירוק</li>
        </ul>

        <h3 className="font-bold text-gray-800 mt-4 mb-2">טאב 2: ניקוד</h3>
        <p className="text-gray-700 mb-2">אפשר לשנות את כל נקודות הניקוד:</p>
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead><tr className="bg-gray-100"><th className="py-2 px-3 text-start font-bold">קטגוריה</th><th className="py-2 px-3 text-start font-bold">מה אפשר לשנות</th></tr></thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="py-2 px-3">טוטו (1X2)</td><td className="py-2 px-3">נקודות לכל שלב (בתים=2, שמינית=3... גמר=4)</td></tr>
            <tr className="border-t border-gray-100"><td className="py-2 px-3">מדויקת</td><td className="py-2 px-3">בונוס לכל שלב (בתים=1... גמר=2)</td></tr>
            <tr className="border-t border-gray-100"><td className="py-2 px-3">עולות</td><td className="py-2 px-3">עולה מדויקת, חלקית, רבע/חצי/גמר/זוכה</td></tr>
            <tr className="border-t border-gray-100"><td className="py-2 px-3">מיוחדים</td><td className="py-2 px-3">מלך שערים, בישולים, התקפה, כסחנית, מאצ׳אפ</td></tr>
          </tbody>
        </table>

        <h3 className="font-bold text-gray-800 mt-4 mb-2">טאב 3: טורנירים</h3>
        <p className="text-gray-700">רשימת טורנירים. אפשר ליצור טורניר חדש בעתיד (מונדיאל 2030).</p>

        <h3 className="font-bold text-gray-800 mt-4 mb-2">טאב 4: מנהלים</h3>
        <p className="text-gray-700">הוספת מנהלים חדשים לפי אימייל. מנהלים יכולים לגשת לדף ניהול.</p>
      </Section>

      {/* Scoring */}
      <Section title="ניקוד — איך זה עובד">
        <h3 className="font-bold text-gray-800 mb-2">הימורי תוצאות (לכל משחק)</h3>
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mb-4">
          <thead><tr className="bg-gray-100"><th className="py-2 px-3 text-start">שלב</th><th className="py-2 px-3 text-center">טוטו</th><th className="py-2 px-3 text-center">מדויקת</th></tr></thead>
          <tbody>
            {[["בתים",2,1],["שמינית/רבע",3,1],["חצי גמר",3,2],["גמר",4,2]].map(([s,t,e]) => (
              <tr key={String(s)} className="border-t border-gray-100"><td className="py-2 px-3 font-medium">{s}</td><td className="py-2 px-3 text-center text-blue-600 font-bold">{t}</td><td className="py-2 px-3 text-center text-green-600 font-bold">+{e}</td></tr>
            ))}
          </tbody>
        </table>

        <h3 className="font-bold text-gray-800 mb-2">הימורי עולות (מבעוד מועד)</h3>
        <ul className="space-y-1 text-gray-700 mb-4">
          <li>• עולה מדויקת מהבית: <strong>5 נק׳</strong> · עולה לא מדויקת: <strong>3 נק׳</strong></li>
          <li>• עולה לרבע: <strong>4</strong> · חצי: <strong>6</strong> · גמר: <strong>8</strong> · זוכה: <strong>12</strong></li>
        </ul>

        <h3 className="font-bold text-gray-800 mb-2">הימורים מיוחדים</h3>
        <ul className="space-y-1 text-gray-700 mb-4">
          <li>• מלך שערים: <strong>9</strong> (מוחלט) / <strong>5</strong> (יחסי, מינימום 3 שערים)</li>
          <li>• מלך בישולים: <strong>7</strong> / <strong>4</strong> (מינימום 2 בישולים)</li>
          <li>• שאר המיוחדים: <strong>5-6</strong> נקודות כל אחד</li>
        </ul>

        <h3 className="font-bold text-gray-800 mb-2">שובר שוויון (בסדר)</h3>
        <ol className="space-y-1 text-gray-700">
          {["ניחוש הזוכה","עולות לגמר","טוטו גמר","עולות לחצי","טוטו חצי","מלך שערים","עולות לרבע"].map((r,i) => (
            <li key={i} className="flex gap-2"><span className="font-black text-gray-400">{i+1}.</span> {r}</li>
          ))}
        </ol>
      </Section>

      {/* Updates */}
      <Section title="עדכון תוצאות — מתי ואיך">
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="font-bold text-green-800 mb-1">אוטומטי (Football-Data.org)</p>
            <p className="text-green-700 text-sm">לחיצה על ״סנכרון עכשיו״ בדף ניהול → מושך תוצאות. חינמי, עד 10 בקשות בדקה.</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="font-bold text-blue-800 mb-1">ידני</p>
            <p className="text-blue-700 text-sm">דף ניהול → תוצאות משחקים → בחירת משחק → הזנת תוצאה. מיידי.</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="font-bold text-gray-800 mb-1">המלצה</p>
            <p className="text-gray-600 text-sm">לסנכרן אוטומטית פעם ב-30 דקות ביום משחק. אם יש עיכוב — להזין ידנית.</p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section title="שאלות נפוצות">
        {[
          { q: "מה קורה אם משתמש שכח להזין הימורים?", a: "אם לא הזין עד הנעילה, הוא לא מקבל נקודות על מה שלא הזין." },
          { q: "אפשר להוסיף משתמשים אחרי שהטורניר התחיל?", a: "כן, אבל הם יפסידו את כל הנקודות על הימורי הבתים ועולות מבעוד מועד." },
          { q: "מה אם יש טעות בתוצאה?", a: "מנהל יכול לתקן בדף ניהול → טאב תוצאות." },
          { q: "איפה רואים את ההימורים של כולם?", a: "דף ״השוואה״ מציג את כל ההימורים של כל המשתתפים." },
          { q: "אפשר לשנות את קוד הכניסה?", a: "כן, דרך קוד המקור או מבקשים ממפתח." },
          { q: "הנתונים נשמרים?", a: "כן — בענן (Supabase) + גיבוי יומי מקומי. כפתור CSV בדף דירוג מוריד הכל." },
        ].map(({ q, a }) => (
          <div key={q} className="border-b border-gray-100 py-3 last:border-0">
            <p className="font-bold text-gray-900">{q}</p>
            <p className="text-gray-600 text-sm mt-1">{a}</p>
          </div>
        ))}
      </Section>
    </div>
    </PageTransition>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden mb-5">
      <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      <div className="px-5 py-4 text-base leading-relaxed">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 mt-2 bg-gray-50 rounded-lg px-3 py-2">
      <span className="text-sm font-bold text-gray-500">{label}:</span>
      <span className="text-sm font-black text-gray-900 select-all" dir="ltr">{value}</span>
    </div>
  );
}
