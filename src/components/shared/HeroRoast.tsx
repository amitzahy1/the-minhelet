"use client";

// ============================================================================
// Hero & Roast of the Day — מצטיין וחולשת היום
// ============================================================================

interface Performer {
  name: string;
  points: number;
  highlight?: string;
}

interface HeroRoastProps {
  hero: Performer;
  roast: Performer;
  matchday?: string;
}

export const MOCK_HERO_ROAST: HeroRoastProps = {
  hero: { name: "דני", points: 12, highlight: "3 תוצאות מדויקות!" },
  roast: { name: "אורי", points: 0, highlight: "0/4 — אין מה לעשות" },
  matchday: "יום משחק 3",
};

// Israeli-slang roast lines per scenario bucket
function roastLine(name: string, pts: number): string {
  if (pts === 0) return `${name} אחי — אפס. אפס! גם מטבע הייתה עושה יותר טוב 🤦`;
  if (pts <= 2) return `${name} ואלה, ${pts} נקודות? הלכת חביבי. נכנסת לרשימה השחורה 😬`;
  if (pts <= 5) return `${name} זה לא נורא, אבל גם לא מרשים. ניסית לפחות 🤷`;
  return `${name} — יום שקט, תיסגר 🙃`;
}

function heroLine(name: string, pts: number, highlight?: string): string {
  if (pts >= 15) return `${name} 🔥 אחי וואלה, ${pts} נקודות ביום אחד? נכנסת לפנתאון`;
  if (pts >= 10) return `${name} מלך היום — ${highlight || `${pts} נקודות`}. מי מדבר עכשיו?`;
  if (pts >= 6) return `${name} לא רע בכלל — ${pts} נקודות. שמור על הרצף אחי 💪`;
  return `${name} — יום ממוצע, אבל עדיין הכי טוב. נהנה ממנו 😄`;
}

export function HeroRoast({ hero, roast, matchday }: HeroRoastProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md mb-6" dir="rtl">
      <div className="flex items-stretch">
        {/* Hero panel */}
        <div className="flex-1 bg-gradient-to-bl from-green-50 to-emerald-50 border-l border-gray-200 px-4 py-3">
          <p className="text-[10px] text-green-600 font-bold mb-0.5">👑 מצטיין היום</p>
          <p className="text-sm font-black text-gray-900 leading-tight">{hero.name}</p>
          <p className="text-xs text-green-700 mt-1 leading-snug">{heroLine(hero.name, hero.points, hero.highlight)}</p>
          <p className="text-lg font-black text-green-600 mt-1" style={{ fontFamily: "var(--font-inter)" }}>+{hero.points}</p>
        </div>

        {/* Divider + matchday */}
        <div className="flex flex-col items-center justify-center px-2 text-center">
          {matchday && <span className="text-[9px] text-gray-400 font-bold leading-tight">{matchday}</span>}
          <span className="text-gray-300 text-lg">|</span>
        </div>

        {/* Roast panel */}
        <div className="flex-1 bg-gradient-to-bl from-red-50 to-rose-50 px-4 py-3">
          <p className="text-[10px] text-red-500 font-bold mb-0.5">💀 חולשת היום</p>
          <p className="text-sm font-black text-gray-900 leading-tight">{roast.name}</p>
          <p className="text-xs text-red-600 mt-1 leading-snug">{roastLine(roast.name, roast.points)}</p>
          <p className="text-lg font-black text-red-500 mt-1" style={{ fontFamily: "var(--font-inter)" }}>+{roast.points}</p>
        </div>
      </div>
    </div>
  );
}
