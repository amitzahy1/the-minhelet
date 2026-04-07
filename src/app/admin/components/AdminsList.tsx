"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function AdminsList() {
  const [admins, setAdmins] = useState<{ email: string; role: string }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    try {
      const res = await fetch("/api/admin/list-admins");
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch { /* ignore */ }
  }

  async function addAdmin() {
    if (!newEmail) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/add-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (data.error) { alert(`שגיאה: ${data.error}`); }
    } catch { alert("שגיאת רשת"); }
    setNewEmail("");
    await loadAdmins();
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">מנהלים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {admins.map((a) => (
            <div key={a.email} className="flex items-center justify-between rounded-lg border px-4 py-2.5">
              <span className="text-sm" dir="ltr">{a.email}</span>
              <Badge variant="outline" className="text-xs">
                {a.role === "SUPER_ADMIN" ? "סופר אדמין" : "מנהל ליגה"}
              </Badge>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex gap-2">
          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="הזינו אימייל של מנהל חדש" dir="ltr" className="flex-1" />
          <Button onClick={addAdmin} disabled={loading || !newEmail}>הוספה</Button>
        </div>
      </CardContent>
    </Card>
  );
}
