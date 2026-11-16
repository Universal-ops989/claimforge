/**
 * The steps every upload takes: describe the file, check that against the contract, ask
 * for a signed link, send the file there, and report back.
 */
import { z } from "zod";

import type { ApiClient } from "../client";
import { UploadError } from "../errors";

/** What a file says about itself, unless the caller says otherwise. */
export interface FileFacts<ContentType extends string> {
  file: Blob;
  /** Defaults to the `File`'s name. */
  filename?: string;
  /** Defaults to the file's type; browsers leave it blank for some formats (HEIC). */
  content_type?: ContentType;
  /** Cancels the upload, whichever step it is on. */
  signal?: AbortSignal;
}

interface Steps<Body, Created> {
  /** The contract's schema for the request that opens the upload. */
  schema: z.ZodType;
  /** Open the upload: the API answers with its id and a signed link. */
  start: (
    body: Body,
    signal: AbortSignal | undefined,
  ) => Promise<{ id: string; upload: Parameters<ApiClient["sendFile"]>[0] }>;
  /** Report the file as sent; the API answers with what it became. */
  finish: (uploadId: string, signal: AbortSignal | undefined) => Promise<Created>;
}

/**
 * Upload `facts.file` with `details` (caption, tags, category, …). The body is checked
 * against the contract before anything is sent, so a file the API would refuse fails
 * with `UploadError("invalid")` without a request.
 */
export async function uploadFile<Body, Created>(
  api: ApiClient,
  { file, filename, content_type, signal, ...details }: FileFacts<string> & object,
  steps: Steps<Body, Created>,
): Promise<Created> {
  const body = {
    ...details,
    filename: filename ?? nameOf(file),
    content_type: content_type ?? (file.type || undefined),
    size_bytes: file.size,
  };
  const checked = steps.schema.safeParse(body);
  if (!checked.success) {
    throw new UploadError(
      "invalid",
      `This file can't be uploaded:\n${z.prettifyError(checked.error)}`,
      null,
      null,
      { cause: checked.error },
    );
  }
  const { id, upload } = await steps.start(body as Body, signal);
  await api.sendFile(upload, file, signal ? { signal } : {});
  return steps.finish(id, signal);
}

/** A `File`'s name, without assuming the runtime has `File` (React Native doesn't). */
function nameOf(file: Blob): string | undefined {
  const { name } = file as { name?: unknown };
  return typeof name === "string" ? name : undefined;
}
