import { Card, CardBody, CardHeader, Text } from "@claimforge/ui";

import { useClaimOfPage } from "./tabs";

/** The claim at a glance: what happened, for now; the details come next. */
export function OverviewTab() {
  const claim = useClaimOfPage();
  return (
    <Card role="region" aria-label="What happened">
      <CardHeader headingLevel={2} title="What happened" />
      <CardBody>
        {claim.description ? (
          <Text as="p" style={{ whiteSpace: "pre-line" }}>
            {claim.description}
          </Text>
        ) : (
          <Text as="p" tone="subtle">
            No description yet.
          </Text>
        )}
      </CardBody>
    </Card>
  );
}
