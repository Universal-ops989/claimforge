import { isApiError, type Schema } from "@claimforge/api-client";
import {
  useCreateTask,
  useDeleteTask,
  useMe,
  useMembers,
  useTasks,
  useUpdateTask,
} from "@claimforge/api-client/react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Dialog,
  FormField,
  Grid,
  Inline,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  SkeletonText,
  Stack,
  Text,
  Textarea,
} from "@claimforge/ui";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { FormDialog } from "../../app/form-dialog";
import { useOrganization } from "../../app/organization";
import { errorCopy, QueryView } from "../../app/states";
import { calendarDate } from "../../format/calendar-date";
import { localToday } from "../new/draft";
import { READ_ONLY_STATUSES } from "../status";
import { useClaimOfPage } from "./tabs";

type Task = Schema<"TaskRead">;

const NOBODY = "nobody";

type Open = { kind: "form"; task: Task | null } | { kind: "delete"; task: Task } | null;

/** The claim's tasks as a board: to do and done, ticked off from the card. */
export function TasksTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const tasks = useTasks(organization.id, claim.id);
  const canWork =
    organization.permissions.includes("field_data:write") &&
    !READ_ONLY_STATUSES.includes(claim.status);
  const [open, setOpen] = useState<Open>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const close = () => {
    setOpen(null);
  };

  return (
    <Stack gap={4}>
      {canWork && (
        <Inline justify="end">
          <Button
            variant="primary"
            onClick={() => {
              setOpen({ kind: "form", task: null });
            }}
          >
            Add a task
          </Button>
        </Inline>
      )}
      {failure && (
        <Text as="p" role="alert" tone="danger">
          {failure}
        </Text>
      )}
      <QueryView query={tasks} loading={<SkeletonText lines={4} />}>
        {(all) => {
          const toDo = all.filter((t) => !t.done);
          const done = all.filter((t) => t.done);
          return (
            <Grid
              gap={4}
              // Two columns side by side that fill the row, one above the other on a phone.
              style={{
                alignItems: "start",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(18rem, 100%), 1fr))",
              }}
            >
              <Column
                title="To do"
                tasks={toDo}
                empty={
                  canWork ? "Nothing to do. Add what needs doing on this job." : "Nothing to do."
                }
                canWork={canWork}
                onOpen={setOpen}
                onFailure={setFailure}
              />
              <Column
                title="Done"
                tasks={done}
                empty="Nothing done yet."
                canWork={canWork}
                onOpen={setOpen}
                onFailure={setFailure}
              />
            </Grid>
          );
        }}
      </QueryView>
      <Dialog
        open={open?.kind === "form"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {open?.kind === "form" && <TaskForm task={open.task} onDone={close} />}
      </Dialog>
      <DeleteTask task={open?.kind === "delete" ? open.task : null} onClose={close} />
    </Stack>
  );
}

function Column({
  title,
  tasks,
  empty,
  canWork,
  onOpen,
  onFailure,
}: {
  title: string;
  tasks: Task[];
  empty: string;
  canWork: boolean;
  onOpen: (open: Open) => void;
  onFailure: (message: string | null) => void;
}) {
  return (
    <Card role="region" aria-label={title}>
      <CardHeader headingLevel={2} title={`${title} (${String(tasks.length)})`} />
      <CardBody>
        {tasks.length === 0 ? (
          <Text tone="muted">{empty}</Text>
        ) : (
          <Stack
            as="ul"
            gap={3}
            aria-label={title}
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} canWork={canWork} onOpen={onOpen} onFailure={onFailure} />
              </li>
            ))}
          </Stack>
        )}
      </CardBody>
    </Card>
  );
}

function TaskCard({
  task,
  canWork,
  onOpen,
  onFailure,
}: {
  task: Task;
  canWork: boolean;
  onOpen: (open: Open) => void;
  onFailure: (message: string | null) => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const me = useMe();
  const update = useUpdateTask(organization.id, claim.id);
  const overdue = !task.done && task.due_on !== null && task.due_on < localToday();
  const canDelete =
    canWork &&
    (task.created_by_id === me.data?.id || organization.permissions.includes("claims:delete"));

  return (
    <Inline justify="between" align="start" gap={3}>
      <Stack gap={1}>
        <Checkbox
          label={task.title}
          checked={task.done}
          disabled={!canWork}
          onCheckedChange={(checked) => {
            onFailure(null);
            update.mutate(
              { taskId: task.id, changes: { done: checked === true } },
              {
                onError: (error) => {
                  onFailure(`"${task.title}" didn't change. ${message(error)}`);
                },
              },
            );
          }}
        />
        {task.description && (
          <Text size="sm" tone="muted" style={{ whiteSpace: "pre-line" }}>
            {task.description}
          </Text>
        )}
        <Inline gap={2} align="center">
          <Text size="sm">{task.assignee ? task.assignee.full_name : "Nobody yet"}</Text>
          {task.due_on && (
            <Text size="sm" tone="muted">
              {`Due ${calendarDate(task.due_on)}`}
            </Text>
          )}
          {overdue && (
            <Badge tone="danger" size="sm">
              Overdue
            </Badge>
          )}
        </Inline>
      </Stack>
      {canWork && (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Change "${task.title}"`}>
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              onSelect={() => {
                onOpen({ kind: "form", task });
              }}
            >
              Edit
            </MenuItem>
            {canDelete && (
              <MenuItem
                tone="danger"
                onSelect={() => {
                  onOpen({ kind: "delete", task });
                }}
              >
                Delete
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      )}
    </Inline>
  );
}

/** Add a task, or change one: title, notes, due date and who does it. */
function TaskForm({ task, onDone }: { task: Task | null; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const members = useMembers(organization.id);
  const create = useCreateTask(organization.id, claim.id);
  const update = useUpdateTask(organization.id, claim.id);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [due, setDue] = useState(task?.due_on ?? "");
  const [assignee, setAssignee] = useState(task?.assignee?.id ?? NOBODY);
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  // Tasks go to people who can do field work, as the API checks.
  const doers = (members.data ?? []).filter((m) => m.permissions.includes("field_data:write"));

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setProblem("Say what needs doing.");
      return;
    }
    if (trimmed.length > 200) {
      setProblem("Keep this to 200 characters or fewer.");
      return;
    }
    setProblem(undefined);
    setFailure(null);
    const fields = {
      title: trimmed,
      description: description.trim() || null,
      due_on: due || null,
      assignee_id: assignee === NOBODY ? null : assignee,
    };
    try {
      if (task) await update.mutateAsync({ taskId: task.id, changes: fields });
      else await create.mutateAsync(fields);
    } catch (error) {
      setFailure(message(error));
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title={task ? "Edit the task" : "Add a task"}
      submitLabel={task ? "Save changes" : "Add task"}
      pending={create.isPending || update.isPending}
      failure={failure}
      onSubmit={save}
    >
      <FormField label="What needs doing" required error={problem}>
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </FormField>
      <FormField label="Notes">
        <Textarea
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </FormField>
      <Grid minChildWidth="12rem" gap={4}>
        <FormField label="Due" hint="If there's a date">
          <Input
            type="date"
            value={due}
            onChange={(event) => {
              setDue(event.target.value);
            }}
          />
        </FormField>
        <FormField label="Who does it">
          <Select
            options={[
              { value: NOBODY, label: "Nobody yet" },
              ...doers.map((m) => ({ value: m.user.id, label: m.user.full_name })),
            ]}
            value={assignee}
            onValueChange={setAssignee}
          />
        </FormField>
      </Grid>
    </FormDialog>
  );
}

function DeleteTask({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const remove = useDeleteTask(organization.id, claim.id);
  return (
    <ConfirmDialog
      open={task !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      tone="danger"
      title={task ? `Delete "${task.title}"?` : ""}
      description="It comes off the claim's list for everyone."
      confirmLabel="Delete"
      cancelLabel="Keep it"
      onConfirm={async () => {
        if (!task) return;
        try {
          await remove.mutateAsync(task.id);
        } catch (error) {
          throw new Error(message(error), { cause: error });
        }
      }}
    />
  );
}

function message(error: unknown): string {
  if (isApiError(error, "not_task_creator")) {
    return "Only whoever added a task, or an admin, can delete it.";
  }
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled, so its tasks can't change.";
  }
  if (isApiError(error, "validation_failed")) {
    const [first] = error.fieldErrors;
    if (first) return first.message;
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
