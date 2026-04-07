"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function UserManagement() {
  const [users, setUsers] = useState<{ id: string; email: string; name: string; visible: boolean; lastLogin: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
                    <div>
                      <p className="font-bold text-sm text-gray-900">{u.name}</p>
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
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">
                משתמשים מוסתרים לא יוצגו בדירוג, בהשוואה ובדף הלייב. ההגדרה נשמרת מקומית.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
