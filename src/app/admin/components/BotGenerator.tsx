"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BotStatus {
  exists: boolean;
  userId?: string;
  email?: string;
  hasBets?: boolean;
  updatedAt?: string | null;
}

export function BotGenerator() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string[]>([]);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bot");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }

  async function generate() {
    setGenerating(true);
    setMessage(null);
    setRationale([]);
    try {
      const res = await fetch("/api/admin/bot", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage("שגיאה: " + (data.error || res.statusText));
      } else {
        setMessage(
          data.created
            ? `נוצר משתמש בוט חדש והוזנו הימורים (אלוף: ${data.champion})`
            : `הימורי הבוט עודכנו (אלוף: ${data.champion})`
        );
        setRationale(data.rationale || []);
        await loadStatus();
      }
    } catch (e) {
      setMessage("שגיאת רשת: " + String(e));
    }
    setGenerating(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">🤖 בוט מהמר אוטומטי</CardTitle>
            <div className="flex items-center gap-2">
              {loading ? (
                <Badge variant="outline" className="text-gray-500">טוען...</Badge>
              ) : status?.exists ? (
                <Badge variant="outline" className={status.hasBets ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}>
                  {status.hasBets ? "פעיל עם הימורים" : "קיים — ללא הימורים"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500">טרם נוצר</Badge>
              )}
              <Button onClick={generate} disabled={generating}>
                {generating
                  ? "מייצר..."
                  : status?.hasBets
                  ? "חולל הימורים מחדש"
                  : status?.exists
                  ? "מלא הימורים לבוט"
                  : "צור בוט ומלא הימורים"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">
            <p>
              הבוט הוא מהמר סינתטי שמופיע בדירוג ובדף ההשוואה כמו כל מהמר אחר. הוא מילא את
              כל 128 ההימורים (72 תוצאות בית + 31 נוקאאוט + 25 מיוחדים/עולות) באמצעות מנוע
              חוקים דטרמיניסטי שמבוסס על <b>דירוג FIFA</b> של כל נבחרת.
            </p>
            <ul className="list-disc pr-5 text-xs text-gray-500 space-y-0.5">
              <li>בכל בית — סדר הנבחרות לפי הדירוג (הטובה ביותר ראשונה).</li>
              <li>תוצאת משחק: פער גדול בדירוג → 3:0 או 2:0, פער קטן → 2:1 או תיקו.</li>
              <li>נוקאאוט: הנבחרת עם הדירוג הטוב יותר מנצחת, התוצאה נגזרת מפער הדירוג.</li>
              <li>מיוחדים: מלך שערים = כוכב האלוף, התקפה הטובה = האלוף, וכו׳.</li>
              <li>מאצ׳אפים: בחירה לפי דירוג הנבחרת של השחקן.</li>
            </ul>
            <p className="text-[11px] text-gray-400">
              כל הפעלה דורסת את הימורי הבוט הקיימים — כי זה משתמש סינתטי שאנחנו הבעלים שלו,
              ולא חל עליו חוק ה-fill-empty-only.
            </p>
          </div>

          {message && (
            <p
              className={`mt-3 text-sm ${message.includes("שגיאה") ? "text-red-600" : "text-green-600"}`}
            >
              {message}
            </p>
          )}

          {rationale.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-700 mb-2">הסבר הבוט לבחירות שלו:</p>
              <ul className="space-y-1 text-xs text-gray-700">
                {rationale.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-gray-400">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status?.updatedAt && (
            <p className="mt-3 text-xs text-gray-400">
              עודכן לאחרונה: {new Date(status.updatedAt).toLocaleString("he-IL")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
