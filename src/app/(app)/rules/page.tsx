"use client";

import { PageTransition } from "@/components/shared/PageTransition";
import { useScoring } from "@/hooks/useScoring";
import type { MatchStage } from "@/types";

export default function RulesPage() {
  // Live point values from scoring_config (falls back to the SCORING constant),
  // so the rules page always shows exactly what the scorer awards and what the
  // admin set — never a stale hardcoded number.
  const scoring = useScoring();
  const sp = scoring.specials;
  const rm = scoring.relative_minimums;
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
            <p><strong>🟢 עץ נתוני אמת (במהלך הטורניר):</strong> נפתח בתום שלב הבתים עם 32 העולות האמיתיות (כולל 8 המקומות השלישיים הטובים). מנחשים תוצאה + מי עולה לכל משחק אמיתי — <strong>וזהו העץ היחיד שנספר לניקוד תוצאות הנוק-אאוט</strong>. אין דד-ליין אחד: כל משחק ניתן לעדכון עד חצי שעה לפני שריקת הפתיחה.</p>
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
                {([
                  ["בתים", "GROUP"], ["שלב 32 הגדולות", "R32"], ["שמינית גמר", "R16"], ["רבע גמר", "QF"],
                  ["חצי גמר", "SF"], ["גמר", "FINAL"],
                ] as [string, MatchStage][]).map(([stage, key]) => {
                  const toto = scoring.toto[key];
                  const exact = scoring.exact[key];
                  return (
                  <tr key={stage} className="border-b border-gray-50">
                    <td className="py-2.5 font-bold text-gray-800">{stage}</td>
                    <td className="py-2.5 text-center text-blue-600 font-bold">{toto}</td>
                    <td className="py-2.5 text-center text-green-600 font-bold">+{exact}</td>
                    <td className="py-2.5 text-center font-black text-gray-900">{toto + exact}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              ניחוש התוצאה נוגע ל<strong>90 הדקות בלבד</strong> — הארכה ודו-קרב פנדלים אינם נכללים בתוצאה.
              (ההעפלה/המנצח בנוק-אאוט נקבעים לפי התוצאה בפועל, כולל הארכה ופנדלים.)
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-700 leading-relaxed">
              <p className="font-bold mb-1 text-slate-900">🥉 משחק המקום השלישי</p>
              <p>
                על משחק המקום השלישי (בין המפסידות בחצי הגמר) <strong>לא מהמרים</strong> טוטו או
                תוצאה מדויקת — הוא אינו חלק מעץ הניחושים. אבל <strong>השערים, הבישולים והכרטיסים
                שבו כן נספרים</strong> לכל ההימורים המיוחדים: מלך השערים, מלך הבישולים, ההתקפה
                הטובה, הכסחנית והמאצ׳אפים.
              </p>
            </div>
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
                  ["עולה מהבית — מיקום מדויק", `${scoring.advancement.group_exact} נק׳`],
                  ["עולה מהבית — לא מדויק (1↔2)", `${scoring.advancement.group_partial} נק׳`],
                  ["עולה מהבית — עלתה ממקום שלישי", `${scoring.advancement.group_as_3rd} נק׳`],
                  ["עולה לשמינית הגמר (16 נבחרות)", `${scoring.advancement.r16} נק׳ כל אחת`],
                  ["עולה לרבע גמר (8 נבחרות)", `${scoring.advancement.qf} נק׳ כל אחת`],
                  ["עולה לחצי גמר (4 נבחרות)", `${scoring.advancement.sf} נק׳ כל אחת`],
                  ["עולה לגמר (2 נבחרות)", `${scoring.advancement.final} נק׳ כל אחת`],
                  ["זוכה הטורניר", `${scoring.advancement.winner} נק׳`],
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
                  ["מלך שערים", `${sp.top_scorer_exact} / ${sp.top_scorer_relative}`, `מוחלט: ${sp.top_scorer_exact} · יחסי: ${sp.top_scorer_relative} (מינימום ${rm.top_scorer_goals} שערים)`],
                  ["מלך בישולים", `${sp.top_assists_exact} / ${sp.top_assists_relative}`, `מוחלט: ${sp.top_assists_exact} · יחסי: ${sp.top_assists_relative} (מינימום ${rm.top_assists} בישולים)`],
                  ["התקפה טובה", `${sp.best_attack}`, "הנבחרת עם הכי הרבה שערים בטורניר"],
                  ["בית פורה", `${sp.prolific_group}`, "הכי הרבה שערים בשלב הבתים"],
                  ["בית יבש", `${sp.driest_group}`, "הכי מעט שערים בשלב הבתים"],
                  ["כסחנית", `${sp.dirtiest_team}`, "צהוב=1, אדום=3 · צהוב שני באותו משחק = אדום אחד (פירוט למטה)"],
                  ["מאצ׳אפ", `${sp.matchup} ×3`, `${sp.matchup} נק׳ לכל דו-קרב (3 דו-קרבות = ${sp.matchup * 3}) · שערים + בישולים בכל הטורניר`],
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
              <p className="font-bold mb-1 text-blue-950">📋 איך נספרים שערים ובישולים</p>
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
            <p>• <strong>10 ביוני 2026, 17:00:</strong> נעילת העולות (עץ הסימולציה) וההימורים המיוחדים</p>
            <p>• <strong>במהלך שלב הבתים:</strong> תוצאות כל יום־משחקים ננעלות 30 דק׳ לפני המשחק הראשון של אותו יום</p>
            <p>• <strong>במהלך הנוק-אאוט:</strong> תוצאת כל משחק בעץ נתוני־האמת ננעלת 30 דק׳ לפני פתיחתו</p>
          </div>
        </section>
      </div>
    </div>
    </PageTransition>
  );
}
