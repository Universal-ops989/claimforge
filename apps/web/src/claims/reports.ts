import type { Schema } from "@claimforge/api-client";
import type { BadgeTone } from "@claimforge/ui";

export type Report = Schema<"ReportJobRead">;
export type ReportKind = Schema<"ReportKind">;
export type Share = Schema<"ShareRead">;

/** A report's name, as a heading would have it. */
export const REPORT_TITLE: Record<ReportKind, string> = {
  photo_report: "Photo report",
  drying_report: "Drying report",
};

/** What each kind of report holds, for whoever is about to make one. */
export const REPORT_COVERS: Record<ReportKind, string> = {
  photo_report: "The claim's photos, by room, with their captions.",
  drying_report: "Moisture readings, the air and the equipment, visit by visit.",
};

export const REPORT_STATUS_LABEL: Record<Schema<"JobStatus">, string> = {
  queued: "Being made",
  ready: "Ready",
  failed: "Failed",
};

export const REPORT_STATUS_TONE: Record<Schema<"JobStatus">, BadgeTone> = {
  queued: "info",
  ready: "success",
  failed: "danger",
};

/** How many days a share link can last, as offered. */
export const SHARE_DAYS = [1, 3, 7, 14, 30] as const;

/** A file's size, as people read it: "840 KB", "1.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Where a share link stands: working until a day, or stopped, and why. */
export function shareState(share: Share, now: Date): "active" | "revoked" | "expired" {
  if (share.revoked_at) return "revoked";
  return Date.parse(share.expires_at) > now.getTime() ? "active" : "expired";
}

/** A day, short: "Nov 23". */
export function shortDay(when: string): string {
  return new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
