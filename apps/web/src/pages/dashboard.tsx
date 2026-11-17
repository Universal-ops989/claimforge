import { allItems, useMyTasks, useNotesMentioningMe } from "@claimforge/api-client/react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Grid,
  Inline,
  SkeletonText,
  Stack,
  Text,
} from "@claimforge/ui";
import { Link } from "react-router";

import { inOrganization, useOrganization } from "../app/organization";
import { Page } from "../app/page";
import { ErrorPanel, QueryView } from "../app/states";
import { ACTIVE_STATUSES, STATUS_LABEL } from "../claims/status";
import { COUNT_LIMIT, useClaimCounts } from "../dashboard/claim-counts";

/** What needs me today: claims by status, my open tasks, where I'm mentioned. */
export function DashboardPage() {
  return (
    <Page title="Dashboard">
      <Grid minChildWidth="18rem" gap={4}>
        <ClaimCountsCard />
        <MyTasksCard />
        <MentionsCard />
      </Grid>
    </Page>
  );
}

function ClaimCountsCard() {
  const organization = useOrganization();
  const counts = useClaimCounts(organization.id, ACTIVE_STATUSES);
  const failed = counts.find((count) => count.isError);
  return (
    <Card role="region" aria-label="Claims in progress">
      <CardHeader headingLevel={2} title="Claims in progress" />
      <CardBody>
        {failed ? (
          <ErrorPanel
            error={failed.error}
            headingLevel={3}
            onRetry={() => {
              for (const count of counts) void count.refetch();
            }}
          />
        ) : (
          <Stack as="ul" gap={2} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {ACTIVE_STATUSES.map((status, index) => {
              const data = counts[index]?.data;
              return (
                <li key={status}>
                  <Inline justify="between" align="center">
                    <Link to={`${inOrganization(organization.slug, "claims")}?status=${status}`}>
                      {STATUS_LABEL[status]}
                    </Link>
                    <Text weight="semibold" numeric aria-busy={data ? undefined : true}>
                      {data ? `${String(data.count)}${data.more ? "+" : ""}` : "…"}
                    </Text>
                  </Inline>
                </li>
              );
            })}
          </Stack>
        )}
        <Text as="p" size="sm" tone="subtle" style={{ marginTop: "var(--cf-space-3)" }}>
          Counts stop at {COUNT_LIMIT}.
        </Text>
      </CardBody>
    </Card>
  );
}

/** Today in the user's time zone, as the API writes dates: `2026-11-17`. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-11-18` as "Nov 18", read as a calendar date, not a UTC midnight. */
function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function MyTasksCard() {
  const organization = useOrganization();
  const tasks = useMyTasks(organization.id, { status: "open", limit: COUNT_LIMIT });
  return (
    <Card role="region" aria-label="My open tasks">
      <CardHeader headingLevel={2} title="My open tasks" />
      <CardBody>
        <QueryView query={tasks} loading={<SkeletonText lines={3} />}>
          {(data) => {
            const open = allItems(data);
            if (open.length === 0) {
              return <EmptyState size="compact" headingLevel={3} title="Nothing assigned to you" />;
            }
            const more = data.pages.at(-1)?.has_more === true;
            const now = today();
            return (
              <Stack gap={3}>
                <Text as="p" weight="semibold">
                  {`${String(open.length)}${more ? "+" : ""} open`}
                </Text>
                <Stack as="ul" gap={2} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {open.slice(0, 5).map((task) => (
                    <li key={task.id}>
                      <Stack gap={1}>
                        <Text>{task.title}</Text>
                        <Inline gap={2} align="center">
                          <Link
                            to={inOrganization(organization.slug, `claims/${task.claim.number}`)}
                          >
                            {task.claim.number}
                          </Link>
                          {task.due_on && (
                            <Text size="sm" tone="muted">
                              Due {shortDate(task.due_on)}
                            </Text>
                          )}
                          {task.due_on && task.due_on < now && (
                            <Badge tone="danger" size="sm">
                              Overdue
                            </Badge>
                          )}
                        </Inline>
                      </Stack>
                    </li>
                  ))}
                </Stack>
              </Stack>
            );
          }}
        </QueryView>
      </CardBody>
    </Card>
  );
}

function MentionsCard() {
  const organization = useOrganization();
  const mentions = useNotesMentioningMe(organization.id, { limit: 3 });
  return (
    <Card role="region" aria-label="Mentions">
      <CardHeader headingLevel={2} title="Mentions" />
      <CardBody>
        <QueryView query={mentions} loading={<SkeletonText lines={3} />}>
          {(data) => {
            const notes = allItems(data);
            if (notes.length === 0) {
              return (
                <EmptyState size="compact" headingLevel={3} title="No one has mentioned you" />
              );
            }
            return (
              <Stack as="ul" gap={3} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {notes.map((note) => (
                  <li key={note.id}>
                    <Stack gap={1}>
                      <Text lineClamp={2}>{note.text}</Text>
                      <Inline gap={2}>
                        <Text size="sm" tone="muted">
                          {note.author?.full_name ?? "Someone"} on
                        </Text>
                        <Link to={inOrganization(organization.slug, `claims/${note.claim.number}`)}>
                          {note.claim.number}
                        </Link>
                      </Inline>
                    </Stack>
                  </li>
                ))}
              </Stack>
            );
          }}
        </QueryView>
      </CardBody>
    </Card>
  );
}
