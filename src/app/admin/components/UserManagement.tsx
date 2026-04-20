"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UserManagement() {
  const [users, setUsers] = useState<{ id: string; email: string; name: string; visible: boolean; lastLogin: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  // Reset modal state each time a new target is picked
  useEffect(() => {
    setDeleteStep(1);
    setConfirmText("");
    setDeleteMsg(null);
  }, [deleteTarget]);

  async function performDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id, confirmText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeleteMsg(`שגיאה: ${data.errors?.join(" | ") || data.error || res.statusText}`);
      } else {
        setDeleteMsg(`המשתמש ${data.deletedUser} נמחק לצמיתות ✓`);
        setTimeout(() => {
          setDeleteTarget(null);
          loadUsers();
        }, 1500);
      }
    } catch (e) {
      setDeleteMsg("שגיאת רשת: " + String(e));
    }
    setDeleting(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      const hiddenUsers = JSON.parse(localStorage.getItem("wc2026-hidden-users") || "[]");
      if (data.users) {
        setUsers(data.users.map((u: { id: string; email?: string; name?: string; created_at?: string }) => ({
          id: u.id,
          email: u.email || "",
          name: u.name || u.email?.split("@")[0] || "ללא שם",
          visible: !hiddenUsers.includes(u.id),
          lastLogin: u.created_at ? new Date(u.created_at).toLocaleDateString("he-IL") : "",
        })));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  function toggleVisibility(userId: string) {
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, visible: !u.visible } : u
    ));
    const updated = users.map(u => u.id === userId ? { ...u, visible: !u.visible } : u);
    const hidden = updated.filter(u => !u.visible).map(u => u.id);
    localStorage.setItem("wc2026-hidden-users", JSON.stringify(hidden));
  }

  async function saveNickname(userId: string) {
    const name = editName.trim();
    if (!name) {
      alert("שם לא יכול להיות ריק");
      return;
    }
    try {
      const res = await fetch("/api/admin/users/update-nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, displayName: name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert("שגיאה בשמירה: " + (data.error || res.statusText));
        return;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, name } : u));
      setEditingId(null);
      setEditName("");
    } catch (e) {
      alert("שגיאה בשמירה: " + String(e));
    }
  }

  function hideAllTest() {
    const testUsers = users.filter(u => u.name.toLowerCase().includes("test") || u.email.includes("test"));
    const hidden = [...new Set([
      ...users.filter(u => !u.visible).map(u => u.id),
      ...testUsers.map(u => u.id),
    ])];
    localStorage.setItem("wc2026-hidden-users", JSON.stringify(hidden));
    setUsers(prev => prev.map(u => hidden.includes(u.id) ? { ...u, visible: false } : u));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">ניהול משתמשים</CardTitle>
              <p className="text-sm text-gray-500 mt-1">הסתירו משתמשי טסט מהדירוג וההשוואות</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={hideAllTest}>הסתר משתמשי טסט</Button>
              <Button variant="outline" size="sm" onClick={loadUsers}>רענן</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-400 text-center py-4">טוען משתמשים...</p>
          ) : users.length === 0 ? (
            <p className="text-gray-400 text-center py-4">אין משתמשים רשומים עדיין</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-200">
                <span className="flex-1">שם משתמש</span>
                <span className="w-24 text-center">תאריך הרשמה</span>
                <span className="w-20 text-center">מוצג באתר</span>
              </div>
              {users.map(u => (
                <div key={u.id} className={`flex items-center px-4 py-3 rounded-lg border ${u.visible ? "border-gray-200 bg-white" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                      {u.name[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === u.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-sm w-32" autoFocus
                            onKeyDown={e => { if (e.key === "Enter") saveNickname(u.id); if (e.key === "Escape") setEditingId(null); }} />
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveNickname(u.id)}>שמור</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>ביטול</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-gray-900">{u.name}</p>
                          <button onClick={() => { setEditingId(u.id); setEditName(u.name); }}
                            className="text-gray-400 hover:text-blue-500 transition-colors" title="שנה כינוי">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          </button>
                        </div>
                      )}
                      {u.email && <p className="text-xs text-gray-400" dir="ltr">{u.email}</p>}
                    </div>
                  </div>
                  <span className="w-24 text-center text-xs text-gray-500">{u.lastLogin}</span>
                  <div className="w-20 flex justify-center">
                    <button
                      onClick={() => toggleVisibility(u.id)}
                      className={`w-12 h-7 rounded-full relative transition-colors ${u.visible ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${u.visible ? "start-0.5" : "start-5.5"}`}></span>
                    </button>
                  </div>
                  <div className="w-16 flex justify-center">
                    <button
                      onClick={() => setDeleteTarget({ id: u.id, name: u.name, email: u.email })}
                      className="text-red-500 hover:bg-red-50 rounded-md p-1 transition-colors"
                      title="מחק משתמש"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">
                משתמשים מוסתרים לא יוצגו בדירוג, בהשוואה ובדף הלייב. ההגדרה נשמרת מקומית.
                כפתור המחיקה מסיר את המשתמש לצמיתות מהמסד + ממערכת האימות.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {deleteTarget && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-3 bg-red-50 border-b border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-600">
                    <path d="M12 9v4M12 17h.01"/>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-red-900">מחיקת משתמש לצמיתות</h3>
                  <p className="text-xs text-red-700">פעולה לא הפיכה</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Step 1: warn */}
              {deleteStep === 1 && (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-sm font-bold text-red-800 mb-1">{deleteTarget.name}</p>
                    <p className="text-xs text-red-700" dir="ltr">{deleteTarget.email}</p>
                  </div>
                  <ul className="text-sm text-gray-700 space-y-1.5 list-disc pr-5">
                    <li>כל ההימורים של המשתמש יימחקו (בתים, נוקאאוט, עולות, מיוחדים).</li>
                    <li>החשבון שלו במערכת האימות יימחק — לא יוכל להתחבר.</li>
                    <li>ה-snapshot של ההימורים יישמר ב-<code>admin_audit_log</code> במקרה של שחזור.</li>
                  </ul>
                  <div className="flex justify-between gap-2 pt-1">
                    <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                      ביטול
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => setDeleteStep(2)}
                      disabled={deleting}
                    >
                      הבנתי — המשך למחיקה ←
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: type-to-confirm */}
              {deleteStep === 2 && (
                <>
                  <p className="text-sm text-gray-700">
                    כדי לאשר, הקלד/י את השם המדויק של המשתמש:{" "}
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded font-bold">{deleteTarget.name}</code>
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={deleteTarget.name}
                    autoFocus
                    className="text-center font-bold"
                    disabled={deleting}
                  />
                  {deleteMsg && (
                    <p className={`text-sm text-center font-bold ${deleteMsg.includes("שגיאה") ? "text-red-600" : "text-green-600"}`}>
                      {deleteMsg}
                    </p>
                  )}
                  <div className="flex justify-between gap-2 pt-1">
                    <Button variant="outline" onClick={() => setDeleteStep(1)} disabled={deleting}>
                      → חזור
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300"
                      onClick={performDelete}
                      disabled={deleting || confirmText.trim() !== deleteTarget.name.trim()}
                    >
                      {deleting ? "מוחק..." : "מחק לצמיתות 🗑️"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
