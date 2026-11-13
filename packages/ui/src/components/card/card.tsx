import { clsx } from "clsx";
import { Slot } from "radix-ui";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { Heading, type HeadingLevel } from "../heading/heading";
import styles from "./card.module.css";

export interface CardProps extends ComponentPropsWithRef<"div"> {
  variant?: "outlined" | "elevated";
  /** Inner spacing applied to header, body and footer. */
  padding?: "sm" | "md" | "lg";
  /** Hover and focus styles for cards that are themselves a link or button. */
  interactive?: boolean;
  /** Render the single child (e.g. a router Link) as the card element. */
  asChild?: boolean;
}

/** Surface that groups related content. Compose with CardHeader, CardBody and CardFooter. */
export function Card({
  variant = "outlined",
  padding = "md",
  interactive = false,
  asChild = false,
  className,
  ...props
}: CardProps) {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={clsx(
        styles.root,
        styles[variant],
        styles[`padding-${padding}`],
        interactive && styles.interactive,
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends Omit<ComponentPropsWithRef<"div">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or menus aligned to the end of the header. */
  actions?: ReactNode;
  /** Heading level for the title, chosen from the page outline. */
  headingLevel?: HeadingLevel;
}

export function CardHeader({
  title,
  description,
  actions,
  headingLevel = 3,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div className={clsx(styles.header, className)} {...props}>
      <div className={styles.headerText}>
        <Heading level={headingLevel} size="sm">
          {title}
        </Heading>
        {description != null && <p className={styles.description}>{description}</p>}
      </div>
      {actions != null && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={clsx(styles.body, className)} {...props} />;
}

export interface CardFooterProps extends ComponentPropsWithRef<"div"> {
  /** Visually separate the footer with a border and tinted background. */
  divided?: boolean;
}

export function CardFooter({ divided = false, className, ...props }: CardFooterProps) {
  return <div className={clsx(styles.footer, divided && styles.divided, className)} {...props} />;
}
