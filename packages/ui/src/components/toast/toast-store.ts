import type { ReactNode } from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Describes how to do the same thing without the toast, for screen reader users. */
  altText?: string;
}

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. `Infinity` keeps it until dismissed. */
  duration?: number;
  action?: ToastAction;
  /** Reuse an id to replace an existing toast instead of stacking a new one. */
  id?: string;
}

export interface ToastRecord extends ToastOptions {
  id: string;
}

type Listener = () => void;

let toasts: readonly ToastRecord[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function emit() {
  for (const listener of listeners) listener();
}

/** Framework-agnostic store so toasts can be raised from anywhere (API clients, mutations). */
export const toastStore = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): readonly ToastRecord[] => toasts,
  add: (options: ToastOptions): string => {
    counter += 1;
    const id = options.id ?? `toast-${String(counter)}`;
    const record: ToastRecord = { ...options, id };
    toasts = toasts.some((t) => t.id === id)
      ? toasts.map((t) => (t.id === id ? record : t))
      : [...toasts, record];
    emit();
    return id;
  },
  dismiss: (id?: string) => {
    toasts = id === undefined ? [] : toasts.filter((t) => t.id !== id);
    emit();
  },
};

type ToneShortcut = (title: ReactNode, options?: Omit<ToastOptions, "title" | "tone">) => string;

const withTone =
  (tone: ToastTone): ToneShortcut =>
  (title, options) =>
    toastStore.add({ ...options, title, tone });

/**
 * Show a toast. Requires a `ToastProvider` somewhere in the tree to render it.
 *
 * @example
 * toast.success("Reading saved");
 * toast.error("Upload failed", { description: "Check your connection" });
 * toast("Draft saved");
 * const id = toast({ title: "Photo deleted", action: { label: "Undo", onClick: restore } });
 */
export const toast = Object.assign(
  (input: string | ToastOptions) =>
    toastStore.add(typeof input === "string" ? { title: input } : input),
  {
    success: withTone("success"),
    info: withTone("info"),
    warning: withTone("warning"),
    /** Errors stay until dismissed unless a duration is given. */
    error: ((title, options) =>
      toastStore.add({ duration: Infinity, ...options, title, tone: "danger" })) as ToneShortcut,
    dismiss: (id?: string) => {
      toastStore.dismiss(id);
    },
  },
);
