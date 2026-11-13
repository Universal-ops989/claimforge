import { clsx } from "clsx";
import { CircleAlert, CircleCheck, FileText, Image as ImageIcon, RotateCcw, X } from "lucide-react";

import styles from "./file-dropzone.module.css";
import { formatBytes } from "./file-validation";

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  type?: string;
  status: UploadStatus;
  /** 0–100 while uploading. */
  progress?: number;
  error?: string;
}

export interface FileUploadListProps {
  items: UploadItem[];
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

function StatusLine({ item }: { item: UploadItem }) {
  switch (item.status) {
    case "queued":
      return <span className={styles.meta}>Waiting…</span>;
    case "uploading":
      return <span className={styles.meta}>{`${String(Math.round(item.progress ?? 0))}%`}</span>;
    case "done":
      return (
        <span className={clsx(styles.meta, styles.done)}>
          <CircleCheck aria-hidden="true" /> Uploaded
        </span>
      );
    case "error":
      return (
        <span className={clsx(styles.meta, styles.error)} role="alert">
          <CircleAlert aria-hidden="true" /> {item.error ?? "Upload failed"}
        </span>
      );
  }
}

/** Files being uploaded, with progress, status, retry and remove. */
export function FileUploadList({ items, onRemove, onRetry, className }: FileUploadListProps) {
  if (items.length === 0) return null;

  return (
    <ul className={clsx(styles.list, className)} aria-label="Uploads">
      {items.map((item) => {
        const KindIcon = item.type?.startsWith("image/") ? ImageIcon : FileText;
        return (
          <li key={item.id} className={styles.item}>
            <KindIcon aria-hidden="true" className={styles.kind} />
            <div className={styles.body}>
              <div className={styles.row}>
                <span className={styles.name} title={item.name}>
                  {item.name}
                </span>
                <span className={styles.size}>{formatBytes(item.size)}</span>
              </div>
              {item.status === "uploading" && (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.progress ?? 0)}
                  className={styles.track}
                >
                  <div className={styles.bar} style={{ width: `${String(item.progress ?? 0)}%` }} />
                </div>
              )}
              <StatusLine item={item} />
            </div>
            <div className={styles.actions}>
              {item.status === "error" && onRetry && (
                <button
                  type="button"
                  className={styles.action}
                  aria-label={`Retry ${item.name}`}
                  onClick={() => {
                    onRetry(item.id);
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  className={styles.action}
                  aria-label={`Remove ${item.name}`}
                  onClick={() => {
                    onRemove(item.id);
                  }}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
