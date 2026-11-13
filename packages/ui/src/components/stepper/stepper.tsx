import { clsx } from "clsx";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./stepper.module.css";

export interface StepDefinition {
  id: string;
  label: string;
  description?: ReactNode;
  /** Marks a step that needs attention (e.g. failed validation). */
  error?: boolean;
}

export type StepStatus = "complete" | "current" | "upcoming" | "error";

export interface StepperProps {
  steps: StepDefinition[];
  /** Index of the current step (0-based). */
  current: number;
  /** Lets users jump back to completed or errored steps. Upcoming steps stay disabled. */
  onStepClick?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  /** Accessible name for the list. */
  label?: string;
  className?: string;
}

const STATUS_TEXT: Record<StepStatus, string> = {
  complete: "completed",
  current: "current step",
  upcoming: "not started",
  error: "needs attention",
};

function statusOf(step: StepDefinition, index: number, current: number): StepStatus {
  if (step.error === true) return "error";
  if (index < current) return "complete";
  if (index === current) return "current";
  return "upcoming";
}

/** Progress through an ordered, multi-step flow. */
export function Stepper({
  steps,
  current,
  onStepClick,
  orientation = "horizontal",
  label = "Progress",
  className,
}: StepperProps) {
  return (
    <ol aria-label={label} className={clsx(styles.root, styles[orientation], className)}>
      {steps.map((step, index) => {
        const status = statusOf(step, index, current);
        const clickable =
          onStepClick !== undefined &&
          index !== current &&
          (status === "complete" || status === "error");

        const marker = (
          <span className={styles.marker} aria-hidden="true">
            {status === "complete" ? <Check /> : status === "error" ? <X /> : index + 1}
          </span>
        );
        const text = (
          <span className={styles.text}>
            <span className={styles.label}>
              {step.label}
              <span className={styles.srOnly}>{`, ${STATUS_TEXT[status]}`}</span>
            </span>
            {step.description != null && (
              <span className={styles.description}>{step.description}</span>
            )}
          </span>
        );

        return (
          <li
            key={step.id}
            className={clsx(styles.step, styles[status])}
            aria-current={status === "current" ? "step" : undefined}
          >
            {clickable ? (
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  onStepClick(index);
                }}
              >
                {marker}
                {text}
              </button>
            ) : (
              <div className={styles.button}>
                {marker}
                {text}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
