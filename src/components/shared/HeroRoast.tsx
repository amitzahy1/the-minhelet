"use client";

// ============================================================================
// Hero & Roast of the Day — מצטיין וחולשת היום
//
// Each scenario bucket has 3 line variants; the one shown is picked
// DETERMINISTICALLY from the Israel date + the player's name, so it's stable
// all day (no flicker between renders/devices) and rotates the next day.
// ============================================================================

import { useState } from "react";

interface Performer {
  name: string;
  points: number;
  highlight?: string;
  /** True when `name` is several tied players — switches to plural phrasing. */
  plural?: boolean;
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

/** Stable daily pick: same option all day, a different one tomorrow. */
function dailyPick(options: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length];
}

function roastLines(name: string, pts: number, plural?: boolean): string[] {
  if (plural) {
    if (pts === 0)
      return [
        `${name} סיימו את היום עם אפס. הטפסים היו מיותרים.`,
        `אפס נקודות ל${name}. הקבוצות פשוט לא שיתפו פעולה.`,
        `${name} ניחשו הכל — חוץ ממה שקרה בפועל.`,
      ];
    return [
      `${pts} נקודות בלבד ל${name}. תחתית משותפת.`,
      `${name} חולקים את התחתית עם ${pts}. לפחות יש חברה.`,
      `${name} עם ${pts} — אחרונים, אבל ביחד.`,
    ];
  }
  if (pts === 0)
    return [
      `${name} סיים את היום עם אפס. הטופס היה מיותר.`,
      `אפס נקודות ל${name}. הקבוצות פשוט לא קראו את התסריט שלו.`,
      `${name} ניחש הכל — חוץ ממה שקרה בפועל.`,
    ];
  if (pts <= 2)
    return [
      `${pts} נקודות ל${name}. היה שווה להישאר ער בשביל זה?`,
      `${name} עם ${pts} — נוכחות סמלית בלבד.`,
      `${name} גרד ${pts} נקודות. גם שעון מקולקל צודק פעמיים ביום.`,
    ];
  if (pts <= 5)
    return [
      `${name} עם ${pts} נקודות. לא בושה, לא גאווה.`,
      `${pts} ל${name} — בדיוק באמצע, בדיוק נשכח.`,
      `${name} אסף ${pts} בשקט. יותר מדי בשקט.`,
    ];
  return [
    `${name} עם ${pts} — לא רע בכלל, אבל מישהו חייב להיות אחרון.`,
    `${pts} נקודות ל${name} — הטוב שבחלשים.`,
    `${name} סגר ${pts}. אחרון, אבל בכבוד.`,
  ];
}

function heroLines(name: string, pts: number, highlight?: string, plural?: boolean): string[] {
  if (plural)
    return [
      `${name} חולקים את ההובלה היומית עם ${pts} נקודות כל אחד.`,
      `${pts} נקודות לכל אחד — ${name} בראש היום, ביחד.`,
      `${name} מובילים את היום עם ${pts}. תיקו בצמרת.`,
    ];
  if (pts >= 15)
    return [
      `${name} עשה ${pts} נקודות ביום אחד. שמישהו יבדוק אותו.`,
      `${pts} נקודות ל${name}. או שהוא יודע משהו, או שמישהו מדליף לו.`,
      `${name} עם יום של אגדות — ${pts} נקודות. תצלמו מסך.`,
    ];
  if (pts >= 10)
    return [
      `${name} מלך היום — ${highlight || `${pts} נקודות`}.`,
      `${name} קם הבוקר ובחר באלימות: ${pts} נקודות.`,
      `${pts} נקודות ל${name}. שהשאר ירשמו וילמדו.`,
    ];
  if (pts >= 6)
    return [
      `${name} עם ${pts} נקודות נקיות. עבודה שקטה.`,
      `${name} אסף ${pts} בלי רעש. מקצוען.`,
      `${pts} נקודות ל${name} — יציב ומסוכן.`,
    ];
  return [
    `${name} לקח את היום עם ${pts}. לא מרשים — אבל כולם מאחוריו.`,
    `${pts} נקודות הספיקו ל${name} לסיים ראשון. יום חלש לכולם.`,
    `${name} ראשון עם ${pts}. בארץ העיוורים החד-עין הוא מלך.`,
  ];
}

export function HeroRoast({ hero, roast, matchday }: HeroRoastProps) {
  // Israel date key seeds the daily rotation; state initializer keeps the
  // render pure (computed once per mount).
  const [dayKey] = useState(() =>
    new Date().toLocaleString("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }),
  );
  const heroText = dailyPick(heroLines(hero.name, hero.points, hero.highlight, hero.plural), `${dayKey}:hero:${hero.name}`);
  const roastText = dailyPick(roastLines(roast.name, roast.points, roast.plural), `${dayKey}:roast:${roast.name}`);
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md mb-6" dir="rtl">
      <div className="flex items-stretch">
        {/* Hero panel */}
        <div className="flex-1 bg-gradient-to-bl from-green-50 to-emerald-50 border-l border-gray-200 px-4 py-3">
          <p className="text-[10px] text-green-600 font-bold mb-0.5">👑 מצטיין היום</p>
          <p className="text-sm font-black text-gray-900 leading-tight">{hero.name}</p>
          <p className="text-xs text-green-700 mt-1 leading-snug">{heroText}</p>
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
          <p className="text-xs text-red-600 mt-1 leading-snug">{roastText}</p>
          <p className="text-lg font-black text-red-500 mt-1" style={{ fontFamily: "var(--font-inter)" }}>+{roast.points}</p>
        </div>
      </div>
    </div>
  );
}
