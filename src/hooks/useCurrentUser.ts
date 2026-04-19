"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCurrentUser(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
  }, []);
  return userId;
}
