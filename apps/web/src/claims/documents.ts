import { isApiError, UploadError, type Schema } from "@claimforge/api-client";

import { errorCopy } from "../app/states";

export type Document = Schema<"DocumentRead">;
export type DocumentCategory = Schema<"DocumentCategory">;
export type DocumentType = Schema<"DocumentType">;

/** The largest document the API takes. */
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  authorization: "Authorization",
  correspondence: "Correspondence",
  estimate: "Estimate",
  invoice: "Invoice",
  policy: "Policy",
  report: "Report",
  other: "Other",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as DocumentCategory[];

const BY_EXTENSION: Record<string, DocumentType> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  eml: "message/rfc822",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

const TYPES = new Set<string>(Object.values(BY_EXTENSION));

/** What the file picker and drop zone take: the API's types, and each by its name. */
export const DOCUMENT_ACCEPT = [
  ...TYPES,
  ...Object.keys(BY_EXTENSION).map((extension) => `.${extension}`),
].join(",");

/**
 * A file's document type: what the browser says when the API takes it, or else what the
 * name says (browsers leave some blank, and call a CSV an Excel file on Windows, which the
 * API takes too). `null` for anything the API doesn't take.
 */
export function documentType(file: Pick<File, "name" | "type">): DocumentType | null {
  if (TYPES.has(file.type)) return file.type as DocumentType;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[extension] ?? null;
}

/** "PDF", "Word", "Excel", …: what kind of file it is, in a word. */
export function fileKind(type: DocumentType): string {
  if (type === "application/pdf") return "PDF";
  if (type.includes("word") || type === "application/msword") return "Word";
  if (type.includes("sheet") || type === "application/vnd.ms-excel") return "Excel";
  if (type === "text/csv") return "CSV";
  if (type === "text/plain") return "Text";
  if (type === "message/rfc822") return "Email";
  return "Image";
}

/** Why a document didn't attach, in words. */
export function attachFailure(error: unknown): string {
  if (isApiError(error, "document_too_large")) return "It's over 50 MB.";
  if (isApiError(error, "claim_locked")) return "The claim was closed or cancelled.";
  if (isApiError(error, "upload_mismatch")) return "The file changed while sending. Try again.";
  if (error instanceof UploadError) {
    return error.reason === "invalid"
      ? "This kind of file can't be attached."
      : "The file couldn't be sent. Try again.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
