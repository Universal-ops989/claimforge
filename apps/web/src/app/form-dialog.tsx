import { Button, DialogClose, DialogContent, Stack, Text } from "@claimforge/ui";
import { useId, type ReactNode } from "react";

export interface FormDialogProps {
  /** The dialog's title, and the form's name for screen readers. */
  title: string;
  submitLabel: string;
  pending: boolean;
  /** A failure not about one field, shown above the fields. */
  failure: string | null;
  onSubmit: () => Promise<void>;
  size?: "md" | "lg";
  children: ReactNode;
}

/**
 * A form in a dialog (inside a `Dialog`): its fields, a failure above them, Cancel and
 * submit below. Submitting runs `onSubmit`; closing is up to the caller once it's done.
 */
export function FormDialog({
  title,
  submitLabel,
  pending,
  failure,
  onSubmit,
  size = "md",
  children,
}: FormDialogProps) {
  const formId = useId();
  return (
    <DialogContent
      title={title}
      size={size}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <Stack gap={4}>
          {failure && (
            <Text as="p" role="alert" tone="danger">
              {failure}
            </Text>
          )}
          {children}
        </Stack>
      </form>
    </DialogContent>
  );
}
