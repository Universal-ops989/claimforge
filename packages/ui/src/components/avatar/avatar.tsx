import { clsx } from "clsx";
import { Avatar as RadixAvatar } from "radix-ui";
import type { Ref } from "react";

import styles from "./avatar.module.css";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const PALETTE = ["brand", "green", "amber", "red", "cyan", "violet"] as const;

/** First letters of the first and last words: "Dana K. Whitfield" -> "DW". */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Stable color for a name, so a person keeps the same color everywhere. */
export function getAvatarColor(name: string): (typeof PALETTE)[number] {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? "brand";
}

export interface AvatarProps {
  /** Person's name: used for the accessible name, initials and fallback color. */
  name: string;
  /** Photo URL. Initials show while it loads or if it fails. */
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  ref?: Ref<HTMLSpanElement>;
}

export function Avatar({ name, src, size = "md", className, ref }: AvatarProps) {
  return (
    <RadixAvatar.Root
      ref={ref}
      role="img"
      aria-label={name}
      title={name}
      className={clsx(styles.root, styles[size], styles[getAvatarColor(name)], className)}
    >
      {src && <RadixAvatar.Image src={src} alt="" className={styles.image} />}
      <RadixAvatar.Fallback className={styles.fallback} aria-hidden="true">
        {getInitials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}

export interface AvatarGroupProps {
  people: { name: string; src?: string | null }[];
  /** Show at most this many avatars, then a "+N" counter. */
  max?: number;
  size?: AvatarSize;
  className?: string;
}

/** Overlapping avatars for the people on a claim, with an overflow counter. */
export function AvatarGroup({ people, max = 4, size = "md", className }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const hidden = people.slice(max);

  return (
    <div
      role="group"
      aria-label={`${String(people.length)} people`}
      className={clsx(styles.group, className)}
    >
      {visible.map((person) => (
        <Avatar key={person.name} name={person.name} src={person.src} size={size} />
      ))}
      {hidden.length > 0 && (
        <span
          role="img"
          aria-label={`and ${String(hidden.length)} more: ${hidden.map((p) => p.name).join(", ")}`}
          title={hidden.map((p) => p.name).join(", ")}
          className={clsx(styles.root, styles[size], styles.overflow)}
        >
          <span aria-hidden="true">+{hidden.length}</span>
        </span>
      )}
    </div>
  );
}
