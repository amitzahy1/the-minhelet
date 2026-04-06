"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function JoinLeaguePageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">טוען...</div>}>
      <JoinLeaguePage />
    </Suspense>
  );
}

function JoinLeaguePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("יש להתחבר קודם");
      setLoading(false);
      return;
    }

    // Find league by invite code
    const { data: league, error: findError } = await supabase
      .from("leagues")
      .select("*")
      .eq("invite_code", code.toLowerCase().trim())
      .single();

    if (findError || !league) {
      setError("קוד ליגה לא נמצא. בדקו את הקוד ונסו שוב.");
      setLoading(false);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("league_members")
      .select("*")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Already a member — just redirect
      router.push(`/league/${league.id}`);
      return;
    }

    // Check member count
    const { count } = await supabase
      .from("league_members")
      .select("*", { count: "exact", head: true })
      .eq("league_id", league.id);

    if (count && count >= league.max_members) {
      setError("הליגה מלאה. לא ניתן להצטרף.");
      setLoading(false);
      return;
    }

    // Join league
    const { error: joinError } = await supabase.from("league_members").insert({
      league_id: league.id,
      user_id: user.id,
    });

    if (joinError) {
      setError(joinError.message);
      setLoading(false);
      return;
    }

    router.push(`/league/${league.id}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">🤝</div>
          <CardTitle className="text-xl">הצטרפות לליגה</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="code">קוד הליגה</Label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="הזינו את הקוד (6 תווים)"
                dir="ltr"
                required
                maxLength={10}
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "מצטרף..." : "הצטרפות"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
