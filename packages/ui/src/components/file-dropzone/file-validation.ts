export interface FileRules {
  /** Comma-separated MIME types, wildcards and extensions: "image/*,.pdf". */
  accept?: string;
  /** Maximum size per file in bytes. */
  maxSize?: number;
  /** Maximum number of files in one selection. */
  maxFiles?: number;
}

export type RejectionReason = "type" | "size" | "count";

export interface FileRejection {
  file: File;
  reason: RejectionReason;
  message: string;
}

export interface ValidationResult {
  accepted: File[];
  rejected: FileRejection[];
}

const UNITS = ["B", "KB", "MB", "GB"] as const;

/** Human-readable size: 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded)} ${UNITS[unit] ?? "B"}`;
}

/** Whether a file matches an `accept` string (same syntax as the input attribute). */
export function matchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith(".")) return name.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

/** Splits files into accepted and rejected, with a reason for each rejection. */
export function validateFiles(files: File[], rules: FileRules): ValidationResult {
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];

  for (const file of files) {
    if (!matchesAccept(file, rules.accept)) {
      rejected.push({ file, reason: "type", message: `${file.name} isn't a supported file type` });
    } else if (rules.maxSize !== undefined && file.size > rules.maxSize) {
      rejected.push({
        file,
        reason: "size",
        message: `${file.name} is larger than ${formatBytes(rules.maxSize)}`,
      });
    } else if (rules.maxFiles !== undefined && accepted.length >= rules.maxFiles) {
      rejected.push({
        file,
        reason: "count",
        message: `Only ${String(rules.maxFiles)} files can be added at once`,
      });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}
