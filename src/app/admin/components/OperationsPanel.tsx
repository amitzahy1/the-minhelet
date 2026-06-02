"use client";

// ============================================================================
// Admin Operations Panel — manual overrides for things that can break.
// Surfaces the recompute, backup, restore, deadline, password-reset, and
// per-user lock toggles that the pre-launch readiness audit identified.
// Each section includes "מתי להפעיל" / "למה זה חשוב" explanations so the
// admin understands the trigger + consequences before clicking anything.
// ============================================================================

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface BackupEntry { name: string; created_at?: string }

function StatusLine({ status }: { status: string | null }) {
  if (!status) return null;
  return <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{status}</p>;
}

/** Reusable expander for the "מתי / למה" rationale block on each card. */
function OpHelp({ when, why }: { when: string[]; why: string }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 mb-4 text-xs">
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
        <p className="font-bold text-blue-900 mb-1">מתי להפעיל</p>
        <ul className="space-y-0.5 text-blue-950 leading-relaxed">
          {when.map((line, i) => <li key={i}>• {line}</li>)}
        </ul>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
        <p className="font-bold text-amber-900 mb-1">למה זה חשוב</p>
        <p className="text-amber-950 leading-relaxed">{why}</p>
      </div>
    </div>
  );
}

interface HealthCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
  fix?: string;
}

export function OperationsPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string | null>>({});
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [deadlineOverride, setDeadlineOverride] = useState<string>("");
  const [deadlineCurrent, setDeadlineCurrent] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [lockUserId, setLockUserId] = useState("");
  const [restoreKey, setRestoreKey] = useState("");
  const [healthChecks, setHealthChecks] = useState<HealthCheck[] | null>(null);
  const [healthSummary, setHealthSummary] = useState<{ ok: number; warn: number; fail: number } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [revalReport, setRevalReport] = useState<{ totalUsers: number; affectedCount: number; totalPicksCleared: number; affected: { name: string; invalidSlots: string[]; clearedTeams: string[] }[] } | null>(null);
  const [revalLoading, setRevalLoading] = useState(false);

  async function runRevalReport() {
    setRevalLoading(true);
    try {
      const res = await fetch("/api/admin/revalidate-brackets");
      const data = await res.json();
      if (res.ok) setRevalReport(data);
    } catch { /* ignore */ } finally {
      setRevalLoading(false);
    }
  }

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/admin/health-check");
      const data = await res.json();
      setHealthChecks(data.checks ?? []);
      setHealthSummary(data.summary ?? null);
    } catch (e) {
      setHealthChecks([{ id: "err", label: "Health check failed", status: "fail", detail: String(e) }]);
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => {
    void runHealthCheck();
    void (async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/admin/backup-snapshot").then((r) => r.json()).catch(() => ({ backups: [] })),
          fetch("/api/admin/extend-deadline").then((r) => r.json()).catch(() => ({ override: null })),
        ]);
        setBackups(bRes.backups || []);
        setDeadlineCurrent(dRes.override ?? null);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function call(key: string, label: string, url: string, init?: RequestInit) {
    setBusy(key);
    setStatus((s) => ({ ...s, [key]: "..." }));
    try {
      const res = await fetch(url, init);
      const data = await res.json();
      const ok = res.ok && data.ok !== false;
      setStatus((s) => ({
        ...s,
        [key]: `${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(data).slice(0, 220)}`,
      }));
    } catch (e) {
      setStatus((s) => ({ ...s, [key]: `✗ ${label}: ${String(e)}` }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            🩺 בדיקת מוכנות מערכת
            {healthSummary && (
              <span className="text-xs font-normal">
                <span className="text-green-700 me-2">✓ {healthSummary.ok}</span>
                {healthSummary.warn > 0 && <span className="text-amber-700 me-2">⚠ {healthSummary.warn}</span>}
                {healthSummary.fail > 0 && <span className="text-red-700">✗ {healthSummary.fail}</span>}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "לפני פתיחת ההרשמה למשתמשים",
              "אחרי שינוי בתשתית (migration חדש, bucket חדש)",
              "כשפעולה אחרת מחזירה שגיאה לא ברורה",
            ]}
            why="מוודא שכל ה-migrations הוחלו, ה-bucket לגיבויים קיים, ה-API חיצוני (Football-Data) זמין, וטוקנים בסביבת הריצה. אם מופיע ✗ — שאר הפעולות בעמוד לא ייעבדו עד שזה יתוקן."
          />
          <div className="flex gap-2 mb-3 flex-wrap">
            <Button onClick={runHealthCheck} disabled={healthLoading} variant="outline">
              {healthLoading ? "בודק..." : "רענן בדיקה"}
            </Button>
            <Button
              onClick={async () => {
                await call("schema_refresh", "Schema reload", "/api/admin/refresh-schema", { method: "POST" });
                void runHealthCheck();
              }}
              disabled={busy === "schema_refresh"}
              variant="outline"
            >
              {busy === "schema_refresh" ? "מרענן..." : "🔄 רענן schema cache"}
            </Button>
          </div>
          <StatusLine status={status.schema_refresh} />
          {healthChecks && (
            <ul className="space-y-1.5 text-xs">
              {healthChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className={c.status === "ok" ? "text-green-600 shrink-0" : c.status === "warn" ? "text-amber-600 shrink-0" : "text-red-600 shrink-0"}>
                    {c.status === "ok" ? "✓" : c.status === "warn" ? "⚠" : "✗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold">{c.label}</span>
                    {c.detail && <span className="text-gray-600"> — {c.detail}</span>}
                    {c.fix && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        תיקון: <code className="bg-gray-100 px-1 rounded text-[10px]">{c.fix}</code>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔄 חישוב ניקוד מחדש</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "אחרי שתיקנתם תוצאת משחק (טאב הזנת תוצאות)",
              "אחרי שינוי כללי ניקוד (טאב ניקוד)",
              "אחרי תיקון הימור של משתמש (טאב עריכת הימורים)",
              "אם משתמש מתלונן שהניקוד שלו לא מעודכן",
              "אחת ליום, ביציאה ידנית אחרי סיום יום משחקים, כגיבוי לחישוב הלייב",
            ]}
            why="הניקוד בדפי ׳טבלה׳ ו׳השוואה׳ מחושב לייב בדפדפן בכל רענון. הפעולה הזו מריצה את אותה לוגיקה בשרת ושומרת snapshot ב-DB (`scoring_snapshots`). זה נותן (1) רשומת audit לכל תיקון, (2) מקור-אמת אם הלייב נשבר באמצע הטורניר, (3) דרך לוודא שהמתחרים רואים את אותם המספרים."
          />
          <Button
            onClick={() => call("recompute", "חישוב ניקוד מחדש", "/api/admin/recompute", { method: "POST" })}
            disabled={busy === "recompute"}
          >
            {busy === "recompute" ? "מחשב..." : "הפעל חישוב מחדש"}
          </Button>
          <StatusLine status={status.recompute} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔒 סנכרון זמני נעילה</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "פעם אחת אחרי פריסה ראשונה, כדי לאכלס את טבלת הנעילות מיד",
              "אם פיפ״א שינו שעת משחק והנעילה צריכה להתעדכן עכשיו (בלי לחכות ל-cron)",
              "אם משתמש מדווח שמשחק נעול/פתוח בזמן הלא נכון",
            ]}
            why="זמני הנעילה (שלב הבתים + עץ נתוני אמת) נשמרים בטבלת `prediction_locks` ונאכפים בשרת — לא נסמכים על שעון הדפדפן ולא על זמינות ה-API ברגע השמירה. הפעולה מחשבת מחדש את הנעילות מהלוז (אותה לוגיקה של התצוגה) ומעדכנת את הטבלה. רץ אוטומטית כל 3 שעות; זה רק טריגר ידני לעדכון מיידי. אם ה-API לא זמין — לא מוחק כלום."
          />
          <Button
            onClick={() => call("sync_locks", "סנכרון זמני נעילה", "/api/sync-locks", { method: "POST" })}
            disabled={busy === "sync_locks"}
          >
            {busy === "sync_locks" ? "מסנכרן..." : "סנכרן זמני נעילה עכשיו"}
          </Button>
          <StatusLine status={status.sync_locks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔁 דוח עדכון עץ הסימולציה (מקום שלישי)</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "אחרי פריסת תיקון חוקי המקום-השלישי (Annex C)",
              "כדי לראות מי מהמשתמשים הושפע ולתזכר אותם לעדכן לפני הנעילה",
            ]}
            why="דוח קריאה-בלבד: מריץ את אותה לוגיקת אימות שרצה אצל המשתמש בטעינה (revalidateTree1) מול עץ הסימולציה (knockout_tree) של כל משתמש, ומדווח מי הימר על קבוצת מקום-שלישי שכבר לא משובצת מולו לפי חוקי פיפ״א. אינו כותב כלום — הניקוי קורה אוטומטית אצל כל משתמש בטעינה הבאה. עץ נתוני האמת (Tree 2) לא מושפע."
          />
          <Button onClick={runRevalReport} disabled={revalLoading} variant="outline">
            {revalLoading ? "בודק..." : "הפק דוח"}
          </Button>
          {revalReport && (
            <div className="mt-3 text-xs">
              <p className="font-bold">
                {revalReport.affectedCount}/{revalReport.totalUsers} משתמשים מושפעים · {revalReport.totalPicksCleared} הימורים יעודכנו
              </p>
              {revalReport.affectedCount > 0 && (
                <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                  {revalReport.affected.map((a, i) => (
                    <li key={i} className="text-gray-700">
                      <span className="font-bold">{a.name}</span> — {a.invalidSlots.length} משבצות
                      {a.clearedTeams.length > 0 && <span className="text-gray-500"> ({a.clearedTeams.join(", ")})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">💾 גיבוי מלא של הטורניר</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "כל יום — אוטומטית, ב-07:00 UTC, ע״י Vercel cron",
              "ידנית 5 ימים לפני תחילת הטורניר (06.06.2026)",
              "ידנית יום לפני הנעילה (09–10.06.2026, אחר הצהריים)",
              "ידנית לפני שינוי גדול בכללי ניקוד או בלוח המשחקים",
              "ידנית אחרי שלב נוקאאוט מרכזי (סוף שלב הבתים, סוף רבע הגמר וכו׳)",
            ]}
            why="מייצא לקובץ JSON אחד את כל הטבלאות הקריטיות (הימורים של כולם, תוצאות, ניקוד, audit, הגדרות, מנהלים). הקובץ נשמר ב-Supabase Storage תחת bucket בשם `backups`. בלי גיבוי — אם משהו ימחק/יקלקל לא תהיה דרך לחזור אחורה. עם גיבוי — שניה אחת של downtime ו-`שחזור מגיבוי` מחזיר את הכל."
          />
          <Button
            onClick={() => call("backup", "גיבוי", "/api/admin/backup-snapshot", { method: "POST" })}
            disabled={busy === "backup"}
          >
            {busy === "backup" ? "מגבה..." : "צור גיבוי עכשיו"}
          </Button>
          <StatusLine status={status.backup} />
          {backups.length > 0 && (
            <div className="mt-4">
              <Label className="text-xs">גיבויים אחרונים</Label>
              <ul className="mt-1 text-xs text-gray-600 space-y-0.5 max-h-32 overflow-auto" dir="ltr">
                {backups.slice(0, 10).map((b) => (
                  <li key={b.name}>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded">{b.name}</code>
                    {b.created_at && <span className="ms-2 text-gray-400">{b.created_at}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">⏮ שחזור מגיבוי</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "רק במצב חירום — נתונים נמחקו/שובשו ואי אפשר לתקן ידנית",
              "אחרי שגיאה ב-migration שגרמה לדריסה",
              "כשמישהו (אולי אתם) הפעיל DELETE רחב מדי דרך SQL editor",
            ]}
            why="פעולת DRY-RUN בטוחה — סופרת שורות בלי לכתוב כלום. שחזור אמיתי דורס בכל שורה לפי המפתח הראשי — אז כל שינוי שנעשה אחרי תאריך הגיבוי יאבד. תמיד הריצו DRY-RUN קודם, ראו שהמספרים הגיוניים, ורק אז שחזור אמיתי."
          />
          <div className="flex gap-2">
            <Input
              placeholder="backup-2026-06-06T07-00.json"
              value={restoreKey}
              onChange={(e) => setRestoreKey(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() => call("restore_dry", "Dry-run", `/api/admin/restore?key=${encodeURIComponent(restoreKey)}&dry_run=1`, { method: "POST" })}
              disabled={!restoreKey || busy === "restore_dry"}
              variant="outline"
            >
              {busy === "restore_dry" ? "..." : "Dry-run (בטוח)"}
            </Button>
            <Button
              onClick={() =>
                window.confirm(`לשחזר באמת מ-${restoreKey}? פעולה זו דורסת נתונים קיימים ולא ניתנת לביטול אם לא רצתם DRY-RUN לפני.`) &&
                call("restore_apply", "שחזור", `/api/admin/restore?key=${encodeURIComponent(restoreKey)}&dry_run=0`, { method: "POST" })
              }
              disabled={!restoreKey || busy === "restore_apply"}
              variant="destructive"
            >
              שחזר אמיתי
            </Button>
          </div>
          <StatusLine status={status.restore_dry || status.restore_apply} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">⏰ דחיית/ביטול נעילה של ההימורים</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "המשתמשים מתלוננים שננעלו ב-13:00 כשהשעון אומר 14:00",
              "מצאתם באג שדורש זמן תיקון אחרי המועד הקבוע (10.06 17:00)",
              "אתם רוצים לפתוח חלון של 5 דקות לתיקון של משתמש ספציפי שלא הספיק (במקרה הזה — דחו את הדדליין, תקנו, ואז ׳נקה׳)",
            ]}
            why={`מועד הנעילה הקבוע הוא 10.06.2026 בשעה 17:00 בישראל. הוא נאכף בשרת — כלומר אי אפשר לעקוף אותו מהדפדפן. דחייה כאן יוצרת override שגובר על הקבוע. ׳נקה׳ מחזיר לברירת מחדל.${" "}
ערך נוכחי: ${deadlineCurrent ? deadlineCurrent : "ברירת מחדל (2026-06-10T14:00Z)"}`}
          />
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              value={deadlineOverride}
              onChange={(e) => setDeadlineOverride(e.target.value)}
            />
            <Button
              onClick={() =>
                call("deadline_set", "דחיית נעילה", "/api/admin/extend-deadline", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ deadline: deadlineOverride ? new Date(deadlineOverride).toISOString() : null }),
                })
              }
              disabled={busy === "deadline_set"}
            >
              דחה
            </Button>
            <Button
              onClick={() =>
                call("deadline_clear", "ניקוי דחייה", "/api/admin/extend-deadline", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ deadline: null }),
                })
              }
              disabled={busy === "deadline_clear"}
              variant="outline"
            >
              נקה
            </Button>
          </div>
          <StatusLine status={status.deadline_set || status.deadline_clear} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔑 איפוס סיסמת משתמש</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "משתמש איבד גישה לחשבון ולא יכול להיכנס לשנות הימורים",
              "אימייל איפוס סיסמה הרגיל לא הגיע (זבל / חוסם)",
              "צריך לאפס במהירות ב-30 שניות לפני נעילת ההימורים",
            ]}
            why="יוצר קישור חד-פעמי לשחזור סיסמה ומחזיר אותו אליכם (לא נשלח אוטומטית במייל). שתפו עם המשתמש ב-WhatsApp/Slack — הקישור חד-פעמי, לפי הגדרות Supabase תקף ~דקות עד שעות בלבד. שיטה זו לא דורסת את הסיסמה — היא רק נותנת חלון לבחור חדשה."
          />
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() => call("reset_pw", "איפוס סיסמה", "/api/admin/users/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resetEmail }),
              })}
              disabled={!resetEmail || busy === "reset_pw"}
            >
              צור קישור
            </Button>
          </div>
          <StatusLine status={status.reset_pw} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔒 נעילה/שחרור ידני לפי משתמש</CardTitle>
        </CardHeader>
        <CardContent>
          <OpHelp
            when={[
              "משתמש ננעל בטעות מוקדם (באג בקליינט) ואתם רוצים לאפשר לו לתקן",
              "משתמש בקש להוציא את ההימורים מהשוואה לפני שהוא מסיים — נעלו לו זמנית עד שיגיש",
              "תיקנתם הימורים של משתמש אחרי הנעילה ואתם רוצים שלא יוכל לשנות יותר",
            ]}
            why="מתחזק את הדגל `locked_at` בשלוש הטבלאות של המשתמש (`user_brackets`, `special_bets`, `advancement_picks`). הדגל הזה הוא מה שמאפשר לאחרים לראות את ההימורים שלו (מדיניות RLS), ומה שחוסם אותו מלהמשיך לערוך. ה-UUID לוקחים מטאב ׳משתמשים׳."
          />
          <div className="flex gap-2">
            <Input
              placeholder="UUID של המשתמש"
              value={lockUserId}
              onChange={(e) => setLockUserId(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() => call("lock_on", "נעילה", "/api/admin/users/lock-state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: lockUserId, lock: true }),
              })}
              disabled={!lockUserId || busy === "lock_on"}
              variant="outline"
            >
              נעל
            </Button>
            <Button
              onClick={() => call("lock_off", "שחרור", "/api/admin/users/lock-state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: lockUserId, lock: false }),
              })}
              disabled={!lockUserId || busy === "lock_off"}
              variant="outline"
            >
              שחרר
            </Button>
          </div>
          <StatusLine status={status.lock_on || status.lock_off} />
        </CardContent>
      </Card>

      <Separator />

      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600 leading-relaxed">
        <p className="font-bold mb-1">💡 שגרת עבודה מומלצת לטורניר</p>
        <ul className="space-y-1">
          <li>• <b>פעם ביום:</b> ה-cron מבצע גיבוי אוטומטי ב-07:00 UTC. אין מה לעשות.</li>
          <li>• <b>אחרי כל יום משחקים:</b> ׳חישוב ניקוד מחדש׳ + ׳גיבוי עכשיו׳ (2 קליקים) כדי שיהיה snapshot טרי לפני השינה.</li>
          <li>• <b>אחרי כל תיקון תוצאה או הימור:</b> ׳חישוב ניקוד מחדש׳ (קליק אחד).</li>
          <li>• <b>05.06 / 09.06 / 10.06:</b> ׳גיבוי עכשיו׳ ידני כקפיצת מדרגה. אחרי 14:00 UTC ב-10.06 — בדקו שהנעילה תפסה (משתמשים לא יכולים לשמור) ושיש סנפשוט אחרון של ההימורים.</li>
          <li>• <b>פניות משתמשים:</b> משתמש שלא יכול להיכנס → איפוס סיסמה. ננעל מוקדם → נעילה/שחרור. הניקוד שלו לא מעודכן → חישוב מחדש.</li>
        </ul>
        <p className="mt-3 text-gray-500">
          Playbook מלא:&nbsp;
          <code className="bg-white px-1 rounded">scripts/RESTORE.md</code>
        </p>
      </div>
    </div>
  );
}
