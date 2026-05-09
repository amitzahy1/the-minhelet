"use client";

// BackupExport — admin-only download surface for the four wide-format CSVs
// (groups / knockout / special / advancement) plus the two static Excel
// workbooks shipped under /public/exports/. Pre-lock everything is disabled.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { isLocked, formatLockDeadline } from "@/lib/constants";

const CSV_OPTIONS: { type: string; label: string; description: string }[] = [
  { type: "groups", label: "CSV — שלב הבתים", description: "144 משחקים, פורמט רחב — שורה לכל משתמש, עמודה לכל משחק" },
  { type: "knockout", label: "CSV — נוקאאוט", description: "31 משחקי נוקאאוט עם מנצח + תוצאה לכל משתמש" },
  { type: "special", label: "CSV — הימורים מיוחדים", description: "מלך שערים, בישולים, התקפה, מאצ'אפים, פנדלים" },
  { type: "advancement", label: "CSV — עולות", description: "עולות מבית, רבע, חצי, גמר, אלוף" },
  { type: "all", label: "CSV — הכל באחד", description: "כל הקטגוריות מאוחות בקובץ אחד עם כותרות-קטע (## GROUPS, ## KNOCKOUT...)" },
];

export function BackupExport() {
  const locked = isLocked();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadCsv(type: string) {
    setBusy(type);
    setError(null);
    try {
      const res = await fetch(`/api/admin/export-bets?type=${type}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `שגיאה: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      a.download = m?.[1] || `wc2026-${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  }

  function downloadStatic(href: string) {
    window.open(href, "_blank");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">גיבוי וייצוא</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-4">
          ⚠️ זמין רק לאחר נעילת ההימורים{" "}
          <strong>({formatLockDeadline()})</strong>. לפני הנעילה הקבצים יחזרו בשגיאה — כדי שלא נעבוד עם תמונה חלקית.
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700">CSV — להורדה דרך הדפדפן</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {CSV_OPTIONS.map((opt) => (
              <div key={opt.type} className="rounded-lg border border-gray-200 p-3 bg-white">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-bold text-sm text-gray-900">{opt.label}</p>
                  <Button
                    size="sm"
                    onClick={() => downloadCsv(opt.type)}
                    disabled={!locked || busy !== null}
                    title={!locked ? `ייפתח לאחר נעילת ההימורים ב-${formatLockDeadline()}` : ""}
                  >
                    {busy === opt.type ? "מוריד..." : "הורד"}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">{opt.description}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700">Excel — קבצי גיבוי סטטיים</p>
          <p className="text-xs text-gray-500">קבצי .xlsx שנוצרו אופליין ושמורים תחת public/exports/. אם האתר נופל — הקבצים האלה ממשיכים לעבוד.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-gray-200 p-3 bg-white">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-bold text-sm text-gray-900">📘 wc2026-backup.xlsx</p>
                <Button size="sm" variant="outline" onClick={() => downloadStatic("/exports/wc2026-backup.xlsx")}>
                  הורד
                </Button>
              </div>
              <p className="text-xs text-gray-500">תמונת מצב מלאה של כל ההימורים, לקריאה ידנית. גיליונות נפרדים לבתים / נוקאאוט / מיוחדים / עולות.</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-white">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-bold text-sm text-gray-900">⚙️ wc2026-liveops.xlsx</p>
                <Button size="sm" variant="outline" onClick={() => downloadStatic("/exports/wc2026-liveops.xlsx")}>
                  הורד
                </Button>
              </div>
              <p className="text-xs text-gray-500">חוברת חיה — מדביקים תוצאות ב-01_results_input ולוח הדירוג מתעדכן עם נוסחאות.</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            הקבצים מתחדשים על ידי הרצת <code className="bg-gray-100 px-1 rounded">pnpm tsx scripts/build-backup-xlsx.ts</code> ו-<code className="bg-gray-100 px-1 rounded">pnpm tsx scripts/build-liveops-xlsx.ts</code> אחרי הנעילה.
          </p>
        </div>

        {error && <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">שגיאה: {error}</div>}
      </CardContent>
    </Card>
  );
}
