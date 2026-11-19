import { isApiError, UploadError, type Schema } from "@claimforge/api-client";

import { errorCopy } from "../app/states";

export type PhotoType = Schema<"PhotoType">;

/** The largest photo the API takes. */
export const PHOTO_MAX_BYTES = 25 * 1024 * 1024;

/** What the file picker and drop zone take: the API's types, and HEIC by name. */
export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

const BY_EXTENSION: Record<string, PhotoType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * A file's photo type: what the browser says, or, when it says nothing (some leave HEIC
 * blank), what the name says. `null` for anything the API doesn't take.
 */
export function photoType(file: Pick<File, "name" | "type">): PhotoType | null {
  if (file.type) {
    return (Object.values(BY_EXTENSION) as string[]).includes(file.type)
      ? (file.type as PhotoType)
      : null;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[extension] ?? null;
}

/** Why a photo didn't upload, in words. */
export function uploadFailure(error: unknown): string {
  if (isApiError(error, "photo_too_large")) return "It's over 25 MB.";
  if (isApiError(error, "claim_locked")) return "The claim was closed or cancelled.";
  if (isApiError(error, "upload_mismatch")) return "The file changed while sending. Try again.";
  if (error instanceof UploadError) {
    return error.reason === "invalid"
      ? "This file can't be uploaded as a photo."
      : "The file couldn't be sent. Try again.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}

/** Run `work` on each item, at most `limit` at once, in order of starting. */
export async function eachAtMost<Item>(
  items: Item[],
  limit: number,
  work: (item: Item) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}
