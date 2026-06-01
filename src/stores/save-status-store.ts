// ============================================================================
// WC2026 — Save-status sidecar store
// The main betting-store auto-saves every bet edit (debounced ~0.7–1.2s), but
// there's no visible signal to the user that their change is on its way to the DB.
// This store is updated by the betting-store's save lifecycle so a
// <SaveIndicator /> component can render a real-time "שומר…" / "✓ נשמר"
// pill anywhere in the app without coupling to the betting state.
// ============================================================================

import { create } from "zustand";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface SaveStatusState {
  status: SaveStatus;
  lastSavedAt: number | null;
  lastError: string | null;
  markPending: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markError: (msg?: string) => void;
  reset: () => void;
}

export const useSaveStatus = create<SaveStatusState>((set) => ({
  status: "idle",
  lastSavedAt: null,
  lastError: null,
  markPending: () => set({ status: "pending", lastError: null }),
  markSaving: () => set({ status: "saving", lastError: null }),
  markSaved: () => set({ status: "saved", lastSavedAt: Date.now(), lastError: null }),
  markError: (msg) => set({ status: "error", lastError: msg ?? "שמירה נכשלה" }),
  reset: () => set({ status: "idle", lastError: null }),
}));
