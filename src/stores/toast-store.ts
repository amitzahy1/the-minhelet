// ============================================================================
// WC2026 — Transient toast store
// A separate tiny store for one-off notifications (cascade-clear, validation
// hints, etc.) so they don't compete with the persistent save-status pill.
// ============================================================================

import { create } from "zustand";

export type ToastKind = "info" | "success" | "warning" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  expiresAt: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, kind = "info", durationMs = 4000) => {
    const id = nextId++;
    const expiresAt = Date.now() + durationMs;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message, expiresAt }] }));
    setTimeout(() => {
      const alive = get().toasts.find((t) => t.id === id);
      if (alive) get().dismiss(id);
    }, durationMs);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
