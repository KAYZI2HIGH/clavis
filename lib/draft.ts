import type { Draft } from "@/lib/types";

// NOTE: These localStorage helper functions are retained for fallback/backwards compatibility only.
// The new creation flow uses real-time API writes stored directly inside the Supabase database.
const DRAFT_KEY = "clavis_vault_draft";

export function saveDraft(draft: Draft): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}
