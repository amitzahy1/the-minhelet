"use client";

import { PageTransition } from "@/components/shared/PageTransition";
import { PENALTIES_LINE } from "@/lib/constants";

export default function RulesPage() {
  return (
    <PageTransition>
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-3xl font-black text-gray-900 mb-6" style={{ fontFamily: "var(--font-secular)" }}>חוקים וניקוד</h1>

      <div className="space-y-6">
        {/* Two-tree model */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-amber-50/40 to-amber-50/30 border-b border-amber-100/50">
            <h2 className="text-lg font-bold text-gray-900">שני עצי נוק-אאוט</h2>
          </div>
          <div className="p-5 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p><strong>🟡 עץ סימולציה (מבעוד מועד):</strong> בוחרים מי עולה בכל שלב ומי האלופה. זו סימולציה לבחירת העולות — <strong>אין בה הימור על תוצאות משחקים</strong>. ממנה נגזר ניקוד העולות (שמינית/רבע/חצי/גמר) והאלופה. ננעלת ב-10.06.2026.</p>
            <p><strong>🟢 עץ נתוני אמת (במהלך הטורניר):</strong> נפתח בתום שלב הבתים עם 32 העולות האמיתיות (כולל 8 המקומות השלישיים הטובים). מנחשים תוצאה + מי עולה לכל משחק אמיתי — <strong>וזהו העץ היחיד שנספר לניקוד תוצאות הנוק-אאוט</strong>. אין דד-ליין אחד: כל משחק ניתן לעדכון עד שעה לפני שריקת הפתיחה.</p>
          </div>
        </section>

        {/* Match scoring */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
            <h2 className="text-lg font-bold text-gray-900">הימורי תוצאות — לכל משחק</h2>
            <p className="text-xs text-gray-500 mt-0.5">נוק-אאוט: רק מ<strong>עץ נתוני אמת</strong>. שלב הבתים: מדף ההימורים של הבתים.</p>
          </div>
          <div className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 font-bold border-b border-gray-200">
                  <th className="py-2 text-start">שלב</th>
                  <th className="py-2 text-center">טוטו (1X2)</th>
                  <th className="py-2 text-center">מדויקת</th>
                  <th className="py-2 text-center">סה״כ</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {[
                  ["בתים", 2, 1, 3], ["שלב 32 הגדולות", 3, 1, 4], ["שמינית גמר", 3, 1, 4], ["רבע גמר", 3, 1, 4],
                  ["חצי גמר", 3, 2, 5], ["משחק מקום 3", 3, 1, 4], ["גמר", 4, 2, 6],
                ].map(([stage, toto, exact, total]) => (
                  <tr key={stage as string} className="border-b border-gray-50">
                    <td className="py-2.5 font-bold text-gray-800">{stage}</td>
                    <td className="py-2.5 text-center text-blue-600 font-bold">{toto}</td>
                    <td className="py-2.5 text-center text-green-600 font-bold">+{exact}</td>
                    <td className="py-2.5 text-center font-black text-gray-900">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Advancement */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
            <h2 className="text-lg font-bold text-gray-900">הימורי עולות — מבעוד מועד</h2>
          </div>
          <div className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 font-bold border-b border-gray-200">
                  <th className="py-2 text-start">הימור</th>
                  <th className="py-2 text-center">ניקוד</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {[
                  ["עולה מהבית — מיקום מדויק", "5 נק׳"],
                  ["עולה מהבית — לא מדויק (1↔2)", "3 נק׳"],
                  ["עולה מהבית — עלתה ממקום שלישי", "2 נק׳"],
                  ["עולה לשמינית הגמר (16 נבחרות)", "1 נק׳ כל אחת"],
                  ["עולה לרבע גמר (8 נבחרות)", "3 נק׳ כל אחת"],
                  ["עולה לחצי גמר (4 נבחרות)", "6 נק׳ כל אחת"],
                  ["עולה לגמר (2 נבחרות)", "10 נק׳ כל אחת"],
                  ["זוכה הטורניר", "16 נק׳"],
                ].map(([bet, pts]) => (
                  <tr key={bet} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-800">{bet}</td>
                    <td className="py-2.5 text-center font-bold text-blue-600">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Special bets */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
            <h2 className="text-lg font-bold text-gray-900">הימורים מיוחדים</h2>
          </div>
          <div className="p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 font-bold border-b border-gray-200">
                  <th className="py-2 text-start">הימור</th>
                  <th className="py-2 text-center">ניקוד</th>
                  <th className="py-2 text-start">הערות</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {[
                  ["מלך שערים", "12 / 7", "מוחלט: 12 · יחסי: 7 (מינימום 3 שערים)"],
                  ["מלך בישולים", "9 / 5", "מוחלט: 9 · יחסי: 5 (מינימום 2 בישולים)"],
                  ["התקפה טובה", "8", "הנבחרת עם הכי הרבה שערים בטורניר"],
                  ["בית פורה", "6", "הכי הרבה שערים בשלב הבתים"],
                  ["בית יבש", "6", "הכי מעט שערים בשלב הבתים"],
                  ["כסחנית", "6", "צהוב=1, אדום=3 · צהוב שני באותו משחק = אדום אחד (פירוט למטה)"],
                  ["מאצ׳אפ", "5 ×3", "5 נק׳ לכל דו-קרב (3 דו-קרבות = 15) · שערים + בישולים בכל הטורניר"],
                  ["פנדלים", "6", `אובר/אנדר ${PENALTIES_LINE} · כולל הארכות, ללא דו-קרב פנדלים`],
                ].map(([bet, pts, note]) => (
                  <tr key={bet} className="border-b border-gray-50">
                    <td className="py-2.5 font-bold text-gray-800">{bet}</td>
                    <td className="py-2.5 text-center font-bold text-blue-600">{pts}</td>
                    <td className="py-2.5 text-xs text-gray-500">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-900 leading-relaxed">
              <p className="font-bold mb-1 text-blue-950">📋 איך נספרים שערים, בישולים ופנדלים</p>
              <ul className="space-y-1.5 list-disc pr-4">
                <li>
                  <strong>שערים ובישולים</strong> (מלך שערים, מלך בישולים, ההתקפה
                  הטובה ביותר, מאצ׳אפים): נספרים כל שערי ובישולי הטורניר
                  <strong> כולל זמן הארכה</strong>. שערים שהובקעו ב<strong>דו-קרב
                  פנדלים</strong> (אחרי ההארכה) <strong>אינם נספרים</strong> — בהתאם
                  לסטטיסטיקה הרשמית של FIFA.
                </li>
                <li>
                  <strong>מאצ׳אפים:</strong> 3 דו-קרבות שחקנים קבועים
                  (מסי–רונאלדו · רפיניה–ויניסיוס · אמבפה–קיין). הזוכה בכל דו-קרב
                  נקבע לפי סך <strong>שערים + בישולים</strong> בכל הטורניר. בוחרים
                  1 / X (שווה) / 2 בכל דו-קרב.
                </li>
                <li>
                  <strong>פנדלים (אובר/אנדר {PENALTIES_LINE}):</strong> נספרים
                  פנדלים שנפסקו ב-90 הדקות + ההארכה. <strong>דו-קרב פנדלים</strong>
                  שאחרי ההארכה <strong>אינו נספר</strong>.
                </li>
              </ul>
            </div>

            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 leading-relaxed">
              <p className="font-bold mb-1">⏱ ניקוד זמני במהלך הטורניר</p>
              <p>
                כל עוד האלוף הסופי לא הוכרז, מלך שערים ומלך בישולים מחושבים
                לפי המוביל הנוכחי בטורניר. אם השחקן שלך מוביל ברגע נתון —
                אתה מקבל את הנקודות באופן זמני (מסומן ב-&quot;⏱ זמני&quot;
                בטבלת הניקוד). הניקוד יקבע סופית כשמנהל המערכת ירשום את
                המנצח האמיתי. שובר השוויון בין שחקנים עם אותו מספר שערים:
                מספר בישולים גבוה יותר, ואז מספר דקות נמוך יותר —
                בדומה לכלל FIFA Golden Boot.
              </p>
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-700 leading-relaxed">
              <p className="font-bold mb-1 text-slate-900">🟨🟥 ספירת כרטיסים — הנבחרת הכסחנית</p>
              <p className="mb-2">
                הכסחנית היא הנבחרת עם הכי הרבה נקודות כסחנות בטורניר:
                <strong> כרטיס צהוב = 1 נק׳, כרטיס אדום = 3 נק׳</strong>.
              </p>
              <ul className="space-y-1.5 list-disc pr-4">
                <li>
                  <strong>כל שלבי המשחק:</strong> נספר כל כרטיס שנשלף, לא משנה מתי
                  — כולל זמן הארכה.
                </li>
                <li>
                  <strong>צהוב שני = אדום:</strong> שני כרטיסים צהובים לאותו שחקן
                  באותו משחק נספרים ככרטיס אדום אחד בלבד (3 נק׳). שני הצהובים
                  אינם נספרים בנפרד — אין ספירה כפולה.
                </li>
                <li>
                  <strong>צהוב + אדום ישיר:</strong> שחקן שקיבל כרטיס צהוב
                  &quot;רגיל&quot;, ובהמשך אותו משחק כרטיס אדום ישיר (שתי עבירות
                  נפרדות) — שני הכרטיסים נספרים (1 + 3 = 4 נק׳).
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Tiebreaker */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
            <h2 className="text-lg font-bold text-gray-900">שובר שוויון</h2>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-3">במקרה של שוויון בניקוד הכולל, מוכרע לפי (בסדר יורד):</p>
            <ol className="space-y-2 text-sm font-medium text-gray-800">
              {[
                "ניחוש הזוכה נכון",
                "ניחוש העולות לגמר",
                "טוטו גמר נכון",
                "ניחוש העולות לחצי",
                "טוטו חצי גמר נכון",
                "ניחוש מלך שערים",
                "ניחוש העולות לרבע גמר",
              ].map((rule, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500">{i + 1}</span>
                  {rule}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Deadlines */}
        <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
          <h2 className="text-lg font-bold text-amber-800 mb-3">לוח זמנים</h2>
          <div className="space-y-2 text-sm text-amber-700 font-medium">
            <p>• <strong>עכשיו:</strong> הירשמו והתחילו להמר</p>
            <p>• <strong>10 ביוני 2026, 17:00:</strong> נעילת הימורי בתים + מיוחדים + עולות</p>
            <p>• <strong>11 ביוני 2026:</strong> שריקת פתיחה — אי אפשר לשנות יותר</p>
            <p>• <strong>במהלך הטורניר:</strong> הימורי תוצאות נוק-אאוט ננעלים 30 דק׳ לפני כל משחק</p>
          </div>
        </section>
      </div>
    </div>
    </PageTransition>
  );
}
