import { useClaimTimeline } from "@claimforge/api-client/react";
import { Button, EmptyState, Inline, Stack, Text } from "@claimforge/ui";
import { useMemo } from "react";

import { useOrganization } from "../../app/organization";
import { QueryView } from "../../app/states";
import { fullTime, relativeTime } from "../../format/relative-time";
import { useClaimOfPage } from "./tabs";

/** What happened on the claim, newest first, a page at a time. */
export function TimelineTab() {
  const organization = useOrganization();
  const claim = useClaimOfPage();
  const timeline = useClaimTimeline(organization.id, claim.id);
  // "3 minutes ago" as of when the entries arrived, not of each render.
  const now = useMemo(() => new Date(timeline.dataUpdatedAt), [timeline.dataUpdatedAt]);

  return (
    <QueryView query={timeline}>
      {(data) => {
        const entries = data.pages.flatMap((page) => page.items);
        if (entries.length === 0) {
          return (
            <EmptyState
              size="compact"
              headingLevel={2}
              title="Nothing has happened yet"
              description="Changes to this claim show up here as people make them."
            />
          );
        }
        return (
          <Stack gap={4}>
            <Stack
              as="ol"
              gap={3}
              aria-label="Timeline"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {entries.map((entry) => (
                <li key={entry.id}>
                  <Inline justify="between" align="start" gap={3}>
                    <Stack gap={1}>
                      <Text>{entry.summary}</Text>
                      <Text size="sm" tone="muted">
                        {entry.actor?.full_name ?? "ClaimForge"}
                      </Text>
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
  );
}
