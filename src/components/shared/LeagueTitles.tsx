"use client";

// 🏅 תארים — fun league title badges, shown on the table page after the
// global lock. Awards are computed in src/lib/league-titles.ts (one clear
// holder only, minimum thresholds); this component just renders them.
// Pending (unawarded) titles render greyed-out so the league knows what's
// still up for grabs.

import type { TitleAward } from "@/lib/league-titles";

function TitleCard({ award }: { award: TitleAward }) {
  const awarded = !!award.holder;
  return (
    <div
      className={`rounded-xl border p-3 text-center transition-all ${
        awarded
          ? "bg-white border-gray-200 shadow-sm hover:shadow-md"
          : "bg-gray-50/60 border-dashed border-gray-200 opacity-75"
      }`}
    >
      <div className={`text-2xl leading-none mb-1.5 ${awarded ? "" : "grayscale opacity-60"}`}>
        {award.emoji}
      </div>
      <p className="text-xs font-bold text-gray-500">{award.title}</p>
      {awarded ? (
        <p className="text-lg font-black text-gray-900 mt-0.5 truncate" style={{ fontFamily: "var(--font-secular)" }} title={award.holder!}>
          {award.holder}
        </p>
      ) : (
        <p className="text-lg font-black text-gray-300 mt-0.5">—</p>
      )}
      <p className={`text-[10px] leading-tight mt-1 ${awarded ? "text-gray-500" : "text-gray-400"}`}>
        {award.detail}
      </p>
    </div>
  );
}

export function LeagueTitles({ awards }: { awards: TitleAward[] }) {
  if (awards.length === 0) return null;
  const awarded = awards.filter((a) => a.holder);
  const pending = awards.filter((a) => !a.holder);
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-lg font-bold text-gray-900">🏅 תארים</h2>
        <span className="text-xs text-gray-400">
          תואר ניתן רק כשמישהו בולט לבדו — תיקו = אין תואר
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {awarded.map((a) => (
          <TitleCard key={a.key} award={a} />
        ))}
        {pending.map((a) => (
          <TitleCard key={a.key} award={a} />
        ))}
      </div>
    </div>
  );
}
