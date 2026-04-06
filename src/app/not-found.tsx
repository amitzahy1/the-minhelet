import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ background: "#F8F9FB", fontFamily: "var(--font-assistant), sans-serif" }} dir="rtl">
      <div className="text-8xl mb-6">🚩</div>
      <h1 className="text-5xl font-black text-gray-900 mb-3" style={{ fontFamily: "var(--font-secular)" }}>אופסייד!</h1>
      <p className="text-xl text-gray-600 mb-2">הדף שחיפשת לא נמצא</p>
      <p className="text-base text-gray-400 mb-8">אולי הכדור יצא מהמגרש?</p>
      <Link href="/standings"
        className="px-8 py-3 rounded-xl bg-gray-900 text-white font-bold text-base hover:bg-gray-800 transition-colors shadow-md">
        חזרה למגרש
      </Link>
    </div>
  );
}
