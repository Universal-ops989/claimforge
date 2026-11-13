import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import styles from "./breadcrumbs.module.css";

export interface BreadcrumbItem {
  label: ReactNode;
  /** Omit on the last item (the current page). */
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /**
   * Render a link with your router, e.g.
   * `(item, className) => <Link to={item.href} className={className}>{item.label}</Link>`.
   * Defaults to a plain anchor.
   */
  renderLink?: (item: BreadcrumbItem & { href: string }, className: string) => ReactNode;
  /** Collapse middle items into "…" beyond this many items. */
  maxItems?: number;
  className?: string;
}

type Entry = { kind: "item"; item: BreadcrumbItem; index: number } | { kind: "ellipsis" };

function collapse(items: BreadcrumbItem[], maxItems: number | undefined): Entry[] {
  const entries: Entry[] = items.map((item, index) => ({ kind: "item", item, index }));
  const [first, ...rest] = entries;
  if (!first || maxItems === undefined || items.length <= maxItems || maxItems < 3) {
    return entries;
  }
  // maxItems counts visible entries: the first item, one ellipsis, then the last items.
  return [first, { kind: "ellipsis" }, ...rest.slice(rest.length - (maxItems - 2))];
}

/** Hierarchy trail for the current page. */
export function Breadcrumbs({ items, renderLink, maxItems, className }: BreadcrumbsProps) {
  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className={styles.list}>
        {collapse(items, maxItems).map((entry, position) => (
          <Fragment key={entry.kind === "item" ? entry.index : "ellipsis"}>
            {position > 0 && (
              <li className={styles.separator} aria-hidden="true">
                <ChevronRight />
              </li>
            )}
            {entry.kind === "ellipsis" ? (
              <li className={styles.ellipsis} aria-label="More levels" title="More levels">
                …
              </li>
            ) : (
              <li className={styles.item}>
                {entry.index === lastIndex || entry.item.href === undefined ? (
                  <span
                    className={styles.current}
                    aria-current={entry.index === lastIndex ? "page" : undefined}
                  >
                    {entry.item.label}
                  </span>
                ) : renderLink ? (
                  renderLink({ ...entry.item, href: entry.item.href }, styles.link ?? "")
                ) : (
                  <a href={entry.item.href} className={styles.link}>
                    {entry.item.label}
                  </a>
                )}
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
