import { clsx } from "clsx";
import { UploadCloud } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";

import { Button } from "../button/button";
import styles from "./file-dropzone.module.css";
import { formatBytes, validateFiles, type FileRejection, type FileRules } from "./file-validation";

export interface FileDropzoneProps extends FileRules {
  /** Receives files that passed validation. */
  onFilesAccepted: (files: File[]) => void;
  /** Receives files that failed validation, with reasons. */
  onFilesRejected?: (rejections: FileRejection[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Main instruction, e.g. "Drop photos here". */
  title?: ReactNode;
  /** Secondary text; defaults to a summary of the rules. */
  hint?: ReactNode;
  browseLabel?: string;
  /** Mobile: open the camera directly for photos. */
  capture?: "user" | "environment";
  className?: string;
}

function describeRules({ accept, maxSize, maxFiles }: FileRules) {
  const parts: string[] = [];
  if (accept)
    parts.push(
      accept
        .split(",")
        .map((t) => t.trim())
        .join(", "),
    );
  if (maxSize !== undefined) parts.push(`up to ${formatBytes(maxSize)} each`);
  if (maxFiles !== undefined) parts.push(`max ${String(maxFiles)} files`);
  return parts.join(" · ");
}

/** Drag-and-drop area with a browse button. Validates files before handing them over. */
export function FileDropzone({
  onFilesAccepted,
  onFilesRejected,
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled = false,
  title = "Drag files here",
  hint,
  browseLabel = "Browse files",
  capture,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [lastRejections, setLastRejections] = useState<FileRejection[]>([]);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const { accepted, rejected } = validateFiles(Array.from(list), {
      accept,
      maxSize,
      maxFiles: multiple ? maxFiles : 1,
    });
    setLastRejections(rejected);
    if (accepted.length > 0) onFilesAccepted(accepted);
    if (rejected.length > 0) onFilesRejected?.(rejected);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(event.dataTransfer.files);
  };

  return (
    <div className={className}>
      <div
        className={clsx(styles.zone, dragging && styles.dragging, disabled && styles.disabled)}
        data-testid="file-dropzone"
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          // Ignore leave events fired when moving between child elements.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDrop={onDrop}
      >
        <UploadCloud aria-hidden="true" className={styles.icon} />
        <p className={styles.title}>{title}</p>
        <p id={hintId} className={styles.hint}>
          {hint ?? describeRules({ accept, maxSize, maxFiles })}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-describedby={hintId}
          onClick={() => inputRef.current?.click()}
        >
          {browseLabel}
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          capture={capture}
          disabled={disabled}
          data-testid="file-input"
          onChange={(event) => {
            handleFiles(event.target.files);
            // Allow selecting the same file again after removing it.
            event.target.value = "";
          }}
        />
      </div>
      {lastRejections.length > 0 && (
        <ul role="alert" className={styles.rejections}>
          {lastRejections.map((rejection) => (
            <li key={`${rejection.file.name}-${rejection.reason}`}>{rejection.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
