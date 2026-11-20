import { useClaimTimeline } from "@claimforge/api-client/react";
import { Badge, Button, EmptyState, Heading, Inline, Stack, Text } from "@claimforge/ui";
import { useId, useMemo } from "react";
import { useSearchParams } from "react-router";

import { useOrganization } from "../../app/organization";
import { QueryView } from "../../app/states";
import { fullTime, relativeTime } from "../../format/relative-time";
import { byDay, dayLabel, KIND_LABEL, readKinds, writeKinds, type TimelineKind } from "../timeline";
import { useClaimOfPage } from "./tabs";

/**
 * What happened on the claim, newest first, a page at a time, in runs by day; filtered by
 * kind, the filter kept in the address.
 */
export function TimelineTab() {
  const organization = useOrganization();
  const claim = useClaimOfPage();
  const [params, setParams] = useSearchParams();
  const kinds = readKinds(params);
  const timeline = useClaimTimeline(
    organization.id,
    claim.id,
    kinds.length > 0 ? { kind: kinds } : {},
  );
  // "3 minutes ago" as of when the entries arrived, not of each render.
  const now = useMemo(() => new Date(timeline.dataUpdatedAt), [timeline.dataUpdatedAt]);
  const filter = (next: TimelineKind[]) => {
    setParams(writeKinds(params, next), { replace: true });
  };

  return (
    <Stack gap={4}>
      <KindFilter kinds={kinds} onChange={filter} />
      <QueryView query={timeline}>
        {(data) => {
          const entries = data.pages.flatMap((page) => page.items);
          if (entries.length === 0) {
            return kinds.length > 0 ? (
              <EmptyState
                size="compact"
                headingLevel={2}
                title="Nothing of that kind"
                description="Nothing of the kinds chosen has happened on this claim yet."
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      filter([]);
                    }}
                  >
                    Show everything
                  </Button>
                }
              />
            ) : (
              <EmptyState
                size="compact"
                headingLevel={2}
                title="Nothing has happened yet"
                description="Changes to this claim show up here as people make them."
              />
            );
          }
          return (
            <Stack gap={5}>
              {byDay(entries).map(({ day, entries: onDay }) => (
                <Day key={day} label={dayLabel(day, now)} entries={onDay} now={now} />
              ))}
              {timeline.hasNextPage && (
                <Inline justify="center">
                  <Button
                    variant="secondary"
                    loading={timeline.isFetchingNextPage}
                    onClick={() => {
                      void timeline.fetchNextPage();
                    }}
                  >
                    Show earlier
                  </Button>
                </Inline>
              )}
            </Stack>
          );
        }}
      </QueryView>
    </Stack>
  );
}

/** Toggle buttons for each kind; none on means everything. */
function KindFilter({
  kinds,
  onChange,
}: {
  kinds: TimelineKind[];
  onChange: (kinds: TimelineKind[]) => void;
}) {
  const labelId = useId();
  return (
    <Inline gap={2} align="center" role="group" aria-labelledby={labelId}>
      <Text size="sm" tone="muted" id={labelId}>
        Show
      </Text>
      {(Object.keys(KIND_LABEL) as TimelineKind[]).map((kind) => {
        const on = kinds.includes(kind);
        return (
          <Button
            key={kind}
            size="sm"
            variant={on ? "primary" : "secondary"}
            aria-pressed={on}
            onClick={() => {
              onChange(on ? kinds.filter((k) => k !== kind) : [...kinds, kind]);
            }}
          >
            {KIND_LABEL[kind]}
          </Button>
        );
      })}
      {kinds.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange([]);
          }}
        >
          Everything
        </Button>
      )}
    </Inline>
  );
}

function Day({
  label,
  entries,
  now,
}: {
  label: string;
  entries: ReturnType<typeof byDay>[number]["entries"];
  now: Date;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Stack gap={2}>
        <Heading level={2} size="sm" id={headingId}>
          {label}
        </Heading>
        <Stack as="ol" gap={3} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <Inline justify="between" align="start" gap={3}>
                <Stack gap={1}>
                  <Text>{entry.summary}</Text>
                  <Inline gap={2} align="center">
                    <Badge tone="neutral" size="sm">
                      {KIND_LABEL[entry.kind]}
                    </Badge>
                    <Text size="sm" tone="muted">
                      {entry.actor?.full_name ?? "ClaimForge"}
                    </Text>
                  </Inline>
                </Stack>
                <Text size="sm" tone="subtle">
                  <time dateTime={entry.at} title={fullTime(entry.at)}>
                    {relativeTime(entry.at, now)}
                  </time>
                </Text>
              </Inline>
            </li>
          ))}
        </Stack>
      </Stack>
    </section>
  );
}
