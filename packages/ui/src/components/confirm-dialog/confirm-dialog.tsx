import { clsx } from "clsx";
import { CircleAlert } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { useState, type ReactNode } from "react";

import { Button } from "../button/button";
import dialogStyles from "../dialog/dialog.module.css";
import styles from "./confirm-dialog.module.css";

export interface ConfirmDialogProps {
  /** Element that opens the dialog (rendered with `asChild`). Omit when controlling `open`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` styles the confirm button for destructive actions. */
  tone?: "default" | "danger";
  /**
   * Runs on confirm. Return a promise to show a loading state: the dialog closes when it
   * resolves and stays open with the error message when it rejects.
   */
  onConfirm: () => void | Promise<void>;
}

/** Interrupting confirmation for destructive or irreversible actions. */
export function ConfirmDialog({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = openProp ?? uncontrolledOpen;

  const setOpen = (next: boolean) => {
    // Never close mid-request: the outcome decides.
    if (pending) return;
    if (!next) setError(null);
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const confirm = async () => {
    setError(null);
    setPending(true);
    try {
      await onConfirm();
      setPending(false);
      setUncontrolledOpen(false);
      onOpenChange?.(false);
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      {trigger != null && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogStyles.overlay} />
        <AlertDialog.Content
          className={clsx(dialogStyles.content, dialogStyles.sm)}
          {...(description == null ? { "aria-describedby": undefined } : {})}
        >
          <div className={dialogStyles.header}>
            <div className={dialogStyles.titles}>
              <AlertDialog.Title className={dialogStyles.title}>{title}</AlertDialog.Title>
              {description != null && (
                <AlertDialog.Description className={dialogStyles.description}>
                  {description}
                </AlertDialog.Description>
              )}
            </div>
          </div>
          {error !== null && (
            <p role="alert" className={styles.error}>
              <CircleAlert aria-hidden="true" />
              {error}
            </p>
          )}
          <div className={dialogStyles.footer}>
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {/* Not AlertDialog.Action: that closes immediately, before async work finishes. */}
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              loading={pending}
              onClick={() => void confirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
