import { Button, Card, CardBody, CardHeader, Grid, Stack, Text } from "@claimforge/ui";
import { useState, type ReactNode } from "react";

import { Facts, type Fact } from "../../app/facts";
import { useOrganization } from "../../app/organization";
import { addressLines } from "../../format/address";
import { calendarDate } from "../../format/calendar-date";
import { fullTime } from "../../format/relative-time";
import { LOSS_TYPE_LABEL, PROPERTY_TYPE_LABEL, READ_ONLY_STATUSES, STATUS_LABEL } from "../status";
import { ContactsCard } from "./contacts-card";
import { EditLossDialog } from "./edit-loss-dialog";
import { useClaimOfPage } from "./tabs";
import { TeamCard } from "./team-card";

/** The claim's details, a card for each part: the loss, the property, the insurance. */
export function OverviewTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const [editing, setEditing] = useState(false);
  const { property } = claim;
  const readOnly = READ_ONLY_STATUSES.includes(claim.status);
  const canEdit = organization.permissions.includes("claims:write") && !readOnly;
  /** Edit, named for its card: both open the loss and insurance form. */
  const edit = (what: string) =>
    canEdit ? (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Edit ${what}`}
        onClick={() => {
          setEditing(true);
        }}
      >
        Edit
      </Button>
    ) : null;

  return (
    <Stack gap={4}>
      {readOnly && (
        <Text as="p" tone="muted">
          {`This claim is ${STATUS_LABEL[claim.status].toLowerCase()}, so its details can't be changed.`}
        </Text>
      )}
      <EditLossDialog claim={claim} open={editing} onOpenChange={setEditing} />
      <Grid minChildWidth="20rem" gap={4}>
        <FactsCard
          title="What happened"
          action={edit("what happened")}
          facts={[
            ["Cause", LOSS_TYPE_LABEL[claim.loss_type]],
            ["Date of loss", claim.loss_date && calendarDate(claim.loss_date)],
            ["Description", claim.description],
          ]}
        />
        <TeamCard claim={claim} canChange={canEdit} />
        <ContactsCard claim={claim} canChange={canEdit} />
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
          action={edit("insurance")}
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
    </Stack>
  );
}

/** A card of facts, a region named by its title, with an action such as Edit. */
function FactsCard({ title, facts, action }: { title: string; facts: Fact[]; action?: ReactNode }) {
  return (
    <Card role="region" aria-label={title}>
      <CardHeader headingLevel={2} title={title} actions={action} />
      <CardBody>
        <Facts label={title} facts={facts} />
      </CardBody>
    </Card>
  );
}

function When({ at }: { at: string }): ReactNode {
  return <time dateTime={at}>{fullTime(at)}</time>;
}
