"use client";

// ============================================================================
// Admin Operations Panel — manual overrides for things that can break.
// Surfaces the recompute, backup, restore, deadline, password-reset, and
// per-user lock toggles that the pre-launch readiness audit identified.
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

export function OperationsPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string | null>>({});
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [deadlineOverride, setDeadlineOverride] = useState<string>("");
  const [deadlineCurrent, setDeadlineCurrent] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [lockUserId, setLockUserId] = useState("");
  const [restoreKey, setRestoreKey] = useState("");

  useEffect(() => {
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
          <CardTitle className="text-base">חישוב ניקוד מחדש</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            טוען מחדש את כל ההימורים + תוצאות + מובילים חיים → ומחשב סנפשוט ניקוד חדש לכל המשתמשים.
            השתמשו אחרי שינוי כללי ניקוד או תיקון תוצאה.
          </p>
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
          <CardTitle className="text-base">גיבוי מלא</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            מייצא את כל הטבלאות הקריטיות (הימורים, תוצאות, ניקוד, audit) לקובץ JSON ב-Supabase Storage.
            הקרון רץ מדי יום ב-07:00 UTC. השתמשו ידנית 5 ימים ויום לפני תחילת הטורניר.
          </p>
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
              <ul className="mt-1 text-xs text-gray-600 space-y-0.5 max-h-32 overflow-auto">
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
          <CardTitle className="text-base">שחזור מגיבוי</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            אפשר &quot;dry run&quot; — סופר שורות בלי לכתוב. שחזור אמיתי דורס שורות קיימות לפי המפתח הראשי.
            השתמשו במחיר רק במצב חירום.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="backup-2026-06-06T07-00.json"
              value={restoreKey}
              onChange={(e) => setRestoreKey(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() =>
                call(
                  "restore_dry",
                  "Dry-run",
                  `/api/admin/restore?key=${encodeURIComponent(restoreKey)}&dry_run=1`,
                  { method: "POST" },
                )
              }
              disabled={!restoreKey || busy === "restore_dry"}
              variant="outline"
            >
              {busy === "restore_dry" ? "..." : "Dry-run"}
            </Button>
            <Button
              onClick={() =>
                window.confirm(`לשחזר באמת מ-${restoreKey}? פעולה זו דורסת נתונים.`) &&
                call(
                  "restore_apply",
                  "שחזור",
                  `/api/admin/restore?key=${encodeURIComponent(restoreKey)}&dry_run=0`,
                  { method: "POST" },
                )
              }
              disabled={!restoreKey || busy === "restore_apply"}
              variant="destructive"
            >
              שחזר
            </Button>
          </div>
          <StatusLine status={status.restore_dry || status.restore_apply} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">דחיית/ביטול נעילה</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            עוקף את ה-LOCK_DEADLINE הקבוע. השתמשו אם הנעילה נופלת מוקדם מדי בגלל בעיית טיים-זון.
            ערך נוכחי: <span className="font-mono">{deadlineCurrent ?? "ברירת מחדל (2026-06-10T14:00Z)"}</span>
          </p>
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
              שמור
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
          <CardTitle className="text-base">איפוס סיסמת משתמש</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            מייצר קישור חד-פעמי לשחזור סיסמה. שלחו אותו למשתמש ב-Slack/SMS.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() =>
                call("reset_pw", "איפוס סיסמה", "/api/admin/users/reset-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: resetEmail }),
                })
              }
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
          <CardTitle className="text-base">נעילה/שחרור לפי משתמש</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            מתחזק את הדגל locked_at בשורות של המשתמש בכל שלוש הטבלאות. השתמשו אם משתמש ננעל בטעות מוקדם.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="UUID של המשתמש"
              value={lockUserId}
              onChange={(e) => setLockUserId(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() =>
                call("lock_on", "נעילה", "/api/admin/users/lock-state", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: lockUserId, lock: true }),
                })
              }
              disabled={!lockUserId || busy === "lock_on"}
              variant="outline"
            >
              נעל
            </Button>
            <Button
              onClick={() =>
                call("lock_off", "שחרור", "/api/admin/users/lock-state", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: lockUserId, lock: false }),
                })
              }
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

      <p className="text-xs text-gray-400">
        ראו playbook מפורט ב-{" "}
        <code className="bg-gray-100 px-1 rounded">scripts/RESTORE.md</code>.
      </p>
    </div>
  );
}
