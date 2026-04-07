"use client";

import { useState, useEffect } from "react";

const TOURNAMENT_START = new Date("2026-06-11T00:00:00Z");
const TOURNAMENT_END = new Date("2026-07-19T23:59:59Z");

export default function CapsulePage() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedText, setSavedText] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    // Check if already saved
    const existing = localStorage.getItem("wc2026-time-capsule");
    if (existing) {
      setSavedText(existing);
      setSaved(true);
    }
    // Check tournament status
    const now = new Date();
    setIsLocked(now >= TOURNAMENT_START);
    setIsRevealed(now >= TOURNAMENT_END);
  }, []);

  const handleSave = () => {
    if (!text.trim()) return;
    localStorage.setItem("wc2026-time-capsule", text);
    setSavedText(text);
    setSaved(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>קפסולת זמן</h1>
        <p className="text-base text-gray-600 mt-1">כתבו את החזון שלכם לטורניר — נחשף רק אחרי הגמר!</p>
      </div>

      {!saved ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-amber-50/30 to-orange-50/40 border-b border-amber-100/50">
            <h2 className="text-lg font-bold text-gray-900">מה יקרה במונדיאל 2026?</h2>
            <p className="text-sm text-gray-500 mt-1">כתבו פסקה עם החיזוי שלכם — מי ייקח את הגביע? מה תהיה ההפתעה? מי יאכזב?</p>
          </div>
          <div className="p-5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="לדעתי ארגנטינה תיקח את הגביע אבל ההפתעה הגדולה תהיה..."
              className="w-full h-40 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              maxLength={500}
              dir="rtl"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">{text.length}/500 תווים</span>
              <button
                onClick={handleSave}
                disabled={!text.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 text-white font-bold shadow-md hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all"
              >
                חתום וסגור את הקפסולה
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sealed capsule */}
          <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-lg overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-l from-amber-100 to-orange-100 border-b border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-amber-900">הקפסולה שלך חתומה!</h2>
                  <p className="text-sm text-amber-700">תיפתח אחרי הגמר — 19 ביולי 2026</p>
                </div>
                <div className="text-4xl">{isRevealed ? "📖" : "🔒"}</div>
              </div>
            </div>
            <div className="p-5">
              {isRevealed ? (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{savedText}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🕰️</div>
                  <p className="text-lg font-bold text-gray-900">הקפסולה חתומה</p>
                  <p className="text-sm text-gray-500 mt-1">התוכן יחשף לכולם אחרי הגמר</p>
                  <p className="text-xs text-gray-400 mt-4">כתבת {savedText.length} תווים</p>
                </div>
              )}
            </div>
          </div>

          {/* Other players' capsules preview */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">קפסולות אחרות</h3>
            </div>
            <div className="p-5 space-y-2">
              {["דני", "יוני", "דור דסא", "רון ב", "רועי"].map(name => (
                <div key={name} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700">{name[0]}</div>
                  <span className="font-bold text-sm text-gray-800">{name}</span>
                  <span className="flex-1"></span>
                  {isRevealed ? (
                    <span className="text-xs text-green-600 font-bold">נחשף!</span>
                  ) : (
                    <span className="text-xs text-gray-400">חתם קפסולה</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
