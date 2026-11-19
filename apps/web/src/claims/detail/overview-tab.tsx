import { Card, CardBody, CardHeader, Grid } from "@claimforge/ui";
import type { ReactNode } from "react";

import { Facts, type Fact } from "../../app/facts";
import { addressLines } from "../../format/address";
import { calendarDate } from "../../format/calendar-date";
import { fullTime } from "../../format/relative-time";
import { LOSS_TYPE_LABEL, PROPERTY_TYPE_LABEL } from "../status";
import { useClaimOfPage } from "./tabs";

/** The claim's details, a card for each part: the loss, the property, the insurance. */
export function OverviewTab() {
  const claim = useClaimOfPage();
  const { property } = claim;
  return (
    <Grid minChildWidth="20rem" gap={4}>
      <FactsCard
        title="What happened"
        facts={[
          ["Cause", LOSS_TYPE_LABEL[claim.loss_type]],
          ["Date of loss", claim.loss_date && calendarDate(claim.loss_date)],
          ["Description", claim.description],
        ]}
      />
      <FactsCard
        title="Property"
        facts={[
          ["Address", addressLines(property.address)],
          ["Type", PROPERTY_TYPE_LABEL[property.property_type]],
          ["Year built", property.year_built],
          ["Access notes", property.access_notes],
        ]}
      />
      <FactsCard
        title="Insurance"
        facts={[
          ["Carrier", claim.carrier_name],
          ["Policy number", claim.policy_number],
          ["Carrier's claim number", claim.carrier_claim_number],
        ]}
      />
      <FactsCard
        title="Record"
        facts={[
          ["Opened", <When key="opened" at={claim.created_at} />],
          ["Last changed", <When key="changed" at={claim.updated_at} />],
        ]}
      />
    </Grid>
  );
}

/** A card of facts, a region named by its title. */
function FactsCard({ title, facts }: { title: string; facts: Fact[] }) {
  return (
    <Card role="region" aria-label={title}>
      <CardHeader headingLevel={2} title={title} />
      <CardBody>
        <Facts label={title} facts={facts} />
      </CardBody>
    </Card>
  );
}

function When({ at }: { at: string }): ReactNode {
  return <time dateTime={at}>{fullTime(at)}</time>;
}
