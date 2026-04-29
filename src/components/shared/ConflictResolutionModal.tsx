"use client";

import { useEffect, useState } from "react";
import { useBettingStore } from "@/stores/betting-store";

// ============================================================================
// ConflictResolutionModal
// Shows when Supabase has newer data than the local store (e.g. two tabs open).
// Listens for the custom "wc:hydration-conflict" event dispatched by the store.
// ============================================================================

interface ConflictInfo {
  serverUpdatedAt: string;
  localUpdatedAt: string;
}

export function ConflictResolutionModal() {
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [pendingServerData, setPendingServerData] = useState<unknown>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ serverUpdatedAt: string; localUpdatedAt: string; serverData: unknown }>;
      setConflict({ serverUpdatedAt: ce.detail.serverUpdatedAt, localUpdatedAt: ce.detail.localUpdatedAt });
      setPendingServerData(ce.detail.serverData);
    };
    window.addEventListener("wc:hydration-conflict", handler);
    return () => window.removeEventListener("wc:hydration-conflict", handler);
  }, []);

  if (!conflict) return null;

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  const keepCloud = () => {
    if (pendingServerData) {
      // Apply the pending server state
      window.dispatchEvent(new CustomEvent("wc:apply-server-data", { detail: pendingServerData }));
    }
    setConflict(null);
    setPendingServerData(null);
  };

  const keepLocal = () => {
    // User wants to keep local — trigger a save to push local → Supabase
    useBettingStore.getState().saveNow();
    setConflict(null);
    setPendingServerData(null);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="text-3xl mb-3 text-center">⚡</div>
        <h3 className="text-lg font-black text-gray-900 text-center mb-1">נמצא עדכון מהענן</h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          יש הימורים שמורים בענן שחדשים מהגרסה המקומית שלך. מה לשמור?
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-5">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
            <p className="font-bold text-blue-700 mb-1">☁️ ענן</p>
            <p>{fmt(conflict.serverUpdatedAt)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-center">
            <p className="font-bold text-gray-700 mb-1">💻 מקומי</p>
            <p>{fmt(conflict.localUpdatedAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={keepCloud}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors">
            השתמש בענן
          </button>
          <button onClick={keepLocal}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors">
            שמור מקומי
          </button>
        </div>
      </div>
    </div>
  );
}
