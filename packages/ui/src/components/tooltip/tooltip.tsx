import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

import styles from "./tooltip.module.css";

export interface TooltipProps {
  /** Tooltip text. Keep it short and non-interactive; use Popover for anything richer. */
  content: ReactNode;
  /** A single focusable element (Button, IconButton, link). */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Delay before showing, in milliseconds. */
  delay?: number;
  /** Controlled open state (rarely needed). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Short hint shown on hover and keyboard focus. Includes its own provider, so it
 * works anywhere; wrap an app in `TooltipProvider` to share the skip-delay between tooltips.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delay = 400,
  open,
  onOpenChange,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delay}>
      <RadixTooltip.Root open={open} onOpenChange={onOpenChange}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content side={side} align={align} sideOffset={6} className={styles.content}>
            {content}
            <RadixTooltip.Arrow className={styles.arrow} width={10} height={5} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

/** Optional app-level provider: moving between tooltips skips the delay. */
export const TooltipProvider = RadixTooltip.Provider;
