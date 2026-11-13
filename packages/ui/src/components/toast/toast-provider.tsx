import { clsx } from "clsx";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { Toast as RadixToast } from "radix-ui";
import { useSyncExternalStore, type ReactNode } from "react";

import { toastStore, type ToastRecord, type ToastTone } from "./toast-store";
import styles from "./toast.module.css";

const ICONS: Record<ToastTone, typeof Info | null> = {
  neutral: null,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export interface ToastProviderProps {
  children?: ReactNode;
  /** Default auto-dismiss time in milliseconds. */
  duration?: number;
  /** Toasts visible at once; the rest wait in a queue. */
  maxVisible?: number;
  /** Accessible label for the viewport landmark ({hotkey} is replaced). */
  label?: string;
}

function ToastItem({ record }: { record: ToastRecord }) {
  const tone = record.tone ?? "neutral";
  const ToneIcon = ICONS[tone];

  return (
    <RadixToast.Root
      className={clsx(styles.toast, styles[tone])}
      duration={record.duration}
      // Errors interrupt; everything else waits politely.
      type={tone === "danger" ? "foreground" : "background"}
      onOpenChange={(open) => {
        if (!open) toastStore.dismiss(record.id);
      }}
    >
      {ToneIcon && <ToneIcon className={styles.icon} aria-hidden="true" />}
      <div className={styles.text}>
        <RadixToast.Title className={styles.title}>{record.title}</RadixToast.Title>
        {record.description != null && (
          <RadixToast.Description className={styles.description}>
            {record.description}
          </RadixToast.Description>
        )}
      </div>
      {record.action && (
        <RadixToast.Action
          className={styles.action}
          altText={record.action.altText ?? record.action.label}
          onClick={record.action.onClick}
        >
          {record.action.label}
        </RadixToast.Action>
      )}
      <RadixToast.Close className={styles.close} aria-label="Dismiss notification">
        <X aria-hidden="true" />
      </RadixToast.Close>
    </RadixToast.Root>
  );
}

/** Renders toasts raised with `toast()`. Mount once near the app root. */
export function ToastProvider({
  children,
  duration = 5000,
  maxVisible = 3,
  label = "Notifications ({hotkey})",
}: ToastProviderProps) {
  const toasts = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getSnapshot,
  );

  return (
    <RadixToast.Provider duration={duration} label={label} swipeDirection="right">
      {children}
      {toasts.slice(0, maxVisible).map((record) => (
        <ToastItem key={record.id} record={record} />
      ))}
      <RadixToast.Viewport className={styles.viewport} />
    </RadixToast.Provider>
  );
}
