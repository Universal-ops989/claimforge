import { Text } from "@claimforge/ui";
import type { ReactNode } from "react";

/** One fact: what it is, and its value; `null` (or blank) reads as "Not given". */
export type Fact = [term: string, value: ReactNode];

export interface FactsProps {
  /** What the facts are about, for screen readers: "Property". */
  label: string;
  facts: Fact[];
}

/**
 * Facts as a description list, terms beside their values. A value's line breaks are kept
 * (an address), and a missing one says so rather than leaving a gap.
 */
export function Facts({ label, facts }: FactsProps) {
  return (
    <dl
      aria-label={label}
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 1fr",
        gap: "var(--cf-space-2) var(--cf-space-6)",
        margin: 0,
      }}
    >
      {facts.map(([term, value]) => (
        <div key={term} style={{ display: "contents" }}>
          <Text as="dt" tone="muted">
            {term}
          </Text>
          <Text as="dd" style={{ margin: 0, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
            {value === null || value === undefined || value === "" ? (
              <Text as="span" tone="subtle">
                Not given
              </Text>
            ) : (
              value
            )}
          </Text>
        </div>
      ))}
    </dl>
  );
}
