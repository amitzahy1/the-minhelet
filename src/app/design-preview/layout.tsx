import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// /design-preview holds static design mockups (option A/B/C, plus per-page
// previews) used only during development. They contain intentionally hardcoded
// placeholder values — a frozen "ננעל בעוד 64 ימים" countdown, sample point
// values, an obsolete 18.5 penalties line — that drift from the live app. This
// server-component guard 404s the whole /design-preview subtree in production
// so users can never reach stale data, while leaving it available locally.
export default function DesignPreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
