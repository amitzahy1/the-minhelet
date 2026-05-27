// ============================================================================
// Route-level loading state for every (app)/ page. Next.js renders this
// immediately while the destination route's RSC payload + client component
// fetches its data — so tapping a nav item feels responsive instead of
// "frozen for 2 seconds" on mobile.
// ============================================================================

export default function AppLoading() {
  return (
    <div dir="rtl" className="max-w-5xl mx-auto px-4 py-6 pb-24 animate-pulse">
      {/* Top header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-40 bg-gray-200 rounded-lg" />
        <div className="h-8 w-24 bg-gray-200 rounded-lg" />
      </div>

      {/* Hero card skeleton */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="h-5 w-1/2 bg-gray-200 rounded mb-3" />
        <div className="h-3 w-3/4 bg-gray-100 rounded mb-2" />
        <div className="h-3 w-2/3 bg-gray-100 rounded" />
      </div>

      {/* List skeleton */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0">
            <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-10 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">טוען...</p>
    </div>
  );
}
