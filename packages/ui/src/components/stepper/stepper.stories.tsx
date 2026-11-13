import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "../button/button";
import { Card, CardBody, CardFooter } from "../card/card";
import { Stack } from "../layout/layout";
import { Text } from "../text/text";
import { Stepper, type StepDefinition } from "./stepper";

const STEPS: StepDefinition[] = [
  { id: "policyholder", label: "Policyholder", description: "Name and contact" },
  { id: "property", label: "Property", description: "Loss location" },
  { id: "loss", label: "Loss details", description: "Type, date, cause" },
  { id: "review", label: "Review", description: "Confirm and create" },
];

const meta = {
  title: "Components/Stepper",
  component: Stepper,
  parameters: { layout: "padded" },
  args: { steps: STEPS, current: 2, label: "New claim progress" },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};

export const Vertical: Story = { args: { orientation: "vertical" } };

export const WithError: Story = {
  args: {
    current: 3,
    steps: STEPS.map((s) =>
      s.id === "property" ? { ...s, error: true, description: "Address can't be verified" } : s,
    ),
  },
};

/** The create-claim wizard: completed steps can be revisited. */
export const Wizard: Story = {
  render: function Render(args) {
    const [current, setCurrent] = useState(0);
    const step = STEPS[current];
    return (
      <Card style={{ maxWidth: 720 }}>
        <CardBody>
          <Stack gap={8}>
            <Stepper {...args} current={current} onStepClick={setCurrent} />
            <Text>{step ? `${step.label} form goes here.` : "Done"}</Text>
          </Stack>
        </CardBody>
        <CardFooter divided>
          <Button
            variant="secondary"
            disabled={current === 0}
            onClick={() => {
              setCurrent((c) => c - 1);
            }}
          >
            Back
          </Button>
          <Button
            onClick={() => {
              setCurrent((c) => Math.min(c + 1, STEPS.length - 1));
            }}
          >
            {current === STEPS.length - 1 ? "Create claim" : "Continue"}
          </Button>
        </CardFooter>
      </Card>
    );
  },
};
