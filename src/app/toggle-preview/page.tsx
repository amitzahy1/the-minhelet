"use client";

// Standalone preview to choose the "finished ⇄ upcoming" toggle for the main
// page's match strip. Three live, clickable options. Not linked in nav — open
// /toggle-preview directly. Delete after the decision is made.

import { useState } from "react";

type View = "upcoming" | "finished";

interface MiniMatch {
  home: string; away: string; homeFlag: string; awayFlag: string;
  group: string; time?: string; live?: boolean; hg?: number; ag?: number;
}

const UPCOMING: MiniMatch[] = [
  { home: "שוויץ", away: "קטאר", homeFlag: "🇨🇭", awayFlag: "🇶🇦", group: "B", live: true, hg: 0, ag: 0 },
  { home: "מרוקו", away: "ברזיל", homeFlag: "🇲🇦", awayFlag: "🇧🇷", group: "C", time: "01:00" },
  { home: "סקוטלנד", away: "האיטי", homeFlag: "🏴", awayFlag: "🇭🇹", group: "C", time: "04:00" },
  { home: "טורקיה", away: "אוסטרליה", homeFlag: "🇹🇷", awayFlag: "🇦🇺", group: "E", time: "07:00" },
];
const FINISHED: MiniMatch[] = [
  { home: "פרגוואי", away: "ארה״ב", homeFlag: "🇵🇾", awayFlag: "🇺🇸", group: "D", hg: 1, ag: 4 },
  { home: "בוסניה", away: "קנדה", homeFlag: "🇧🇦", awayFlag: "🇨🇦", group: "B", hg: 1, ag: 1 },
  { home: "מקסיקו", away: "דרום אפריקה", homeFlag: "🇲🇽", awayFlag: "🇿🇦", group: "A", hg: 2, ag: 0 },
  { home: "דרום קוריאה", away: "צ׳כיה", homeFlag: "🇰🇷", awayFlag: "🇨🇿", group: "A", hg: 2, ag: 1 },
];

function MiniCards({ view }: { view: View }) {
  const list = view === "upcoming" ? UPCOMING : FINISHED;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
      {list.map((m, i) => {
        const finished = view === "finished";
        return (
          <div key={i} className={`bg-white rounded-xl border shadow-sm p-3 text-center ${m.live ? "border-red-300 bg-red-50/30" : finished ? "border-green-200" : "border-gray-200"}`}>
            <div className="mb-2 h-4 flex items-center justify-center">
              {m.live ? <span className="text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5">LIVE</span>
                : finished ? <span className="text-[10px] font-bold text-green-600 bg-green-100 rounded-full px-2 py-0.5">הסתיים</span>
                : <span className="text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{m.time}</span>}
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                <span className="text-xl">{m.homeFlag}</span>
                <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">{m.home}</span>
              </div>
              <div className="shrink-0 px-1">
                {(m.live || finished) && m.hg != null
                  ? <span dir="ltr" className="text-lg font-black tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.ag}-{m.hg}</span>
                  : <span className="text-sm font-bold text-gray-300">vs</span>}
              </div>
              <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                <span className="text-xl">{m.awayFlag}</span>
                <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">{m.away}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">בית {m.group}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Option A — segmented pill ───────────────────────────────────────────────
function OptionA() {
  const [view, setView] = useState<View>("upcoming");
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-base font-bold text-gray-800">משחקים</h2>
        </div>
        <div className="inline-flex rounded-full bg-gray-100 p-0.5 text-[12px] font-bold">
          {(["upcoming", "finished"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full transition-colors ${view === v ? "bg-blue-600 text-white shadow-sm" : "text-gray-500"}`}>
              {v === "upcoming" ? "הבאים" : "אחרונים"}
            </button>
          ))}
        </div>
      </div>
      <MiniCards view={view} />
    </div>
  );
}

// ── Option B — underline tabs ───────────────────────────────────────────────
function OptionB() {
  const [view, setView] = useState<View>("upcoming");
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-base font-bold text-gray-800">משחקים</h2>
        </div>
        <div className="flex items-center gap-4 text-[13px] font-bold">
          {(["upcoming", "finished"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className="relative pb-1">
              <span className={view === v ? "text-gray-900" : "text-gray-400"}>{v === "upcoming" ? "הבאים" : "אחרונים"}</span>
              {view === v && <span className="absolute -bottom-0.5 inset-x-0 h-0.5 rounded-full bg-blue-600" />}
            </button>
          ))}
        </div>
      </div>
      <MiniCards view={view} />
    </div>
  );
}

// ── Option C — swap chip ────────────────────────────────────────────────────
function OptionC() {
  const [view, setView] = useState<View>("upcoming");
  const other = view === "upcoming" ? "אחרונים" : "הבאים";
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-base font-bold text-gray-800">{view === "upcoming" ? "המשחקים הבאים" : "משחקים אחרונים"}</h2>
        </div>
        <button onClick={() => setView(view === "upcoming" ? "finished" : "upcoming")}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-[12px] font-bold px-3 py-1 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
          {other}
        </button>
      </div>
      <MiniCards view={view} />
    </div>
  );
}

export default function TogglePreviewPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 space-y-10" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>בחירת מתג: הבאים ⇄ אחרונים</h1>
        <p className="text-gray-600 mt-1">שלוש אפשרויות חיות — לחצו על המתגים כדי להרגיש כל אחת, ותגידו לי איזו לבחור.</p>
      </div>

      <section className="bg-gray-50/60 rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-black text-blue-700 mb-3">אפשרות A · מתג מקטעים (Segmented)</p>
        <OptionA />
      </section>

      <section className="bg-gray-50/60 rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-black text-blue-700 mb-3">אפשרות B · טאבים עם קו תחתון</p>
        <OptionB />
      </section>

      <section className="bg-gray-50/60 rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-black text-blue-700 mb-3">אפשרות C · כפתור החלפה יחיד</p>
        <OptionC />
      </section>
    </div>
  );
}
