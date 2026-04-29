"use client";

import { PageTransition } from "@/components/shared/PageTransition";

export default function RulesPage() {
  return (
    <PageTransition>
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-3xl font-black text-gray-900 mb-6" style={{ fontFamily: "var(--font-secular)" }}>חוקים וניקוד</h1>

      <div className="space-y-6">
        {/* Match scoring */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
            <h2 className="text-lg font-bold text-gray-900">הימורי תוצאות — לכל משחק</h2>
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
                  ["בתים", 2, 1, 3], ["שמינית גמר", 3, 1, 4], ["רבע גמר", 3, 1, 4],
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
                  ["עולה לרבע גמר (8 נבחרות)", "4 נק׳ כל אחת"],
                  ["עולה לחצי גמר (4 נבחרות)", "6 נק׳ כל אחת"],
                  ["עולה לגמר (2 נבחרות)", "8 נק׳ כל אחת"],
                  ["זוכה הטורניר", "12 נק׳"],
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
                  ["מלך שערים", "9 / 5", "מוחלט: 9 · יחסי: 5 (מינימום 3 שערים)"],
                  ["מלך בישולים", "7 / 4", "מוחלט: 7 · יחסי: 4 (מינימום 2 בישולים)"],
                  ["התקפה טובה", "6", "הנבחרת עם הכי הרבה שערים בטורניר"],
                  ["בית פורה", "5", "הכי הרבה שערים בשלב הבתים"],
                  ["בית יבש", "5", "הכי מעט שערים בשלב הבתים"],
                  ["כסחנית", "5", "צהוב=1, אדום=3 נק׳ כסחנות"],
                  ["מאצ׳אפ", "5", "שערים + בישולים — בכל הטורניר"],
                  ["פנדלים", "5", "אובר/אנדר קו שנקבע"],
                ].map(([bet, pts, note]) => (
                  <tr key={bet} className="border-b border-gray-50">
                    <td className="py-2.5 font-bold text-gray-800">{bet}</td>
                    <td className="py-2.5 text-center font-bold text-blue-600">{pts}</td>
                    <td className="py-2.5 text-xs text-gray-500">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
