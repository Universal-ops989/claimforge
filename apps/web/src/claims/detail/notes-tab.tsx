import { isApiError, type Schema } from "@claimforge/api-client";
import {
  allItems,
  useCreateNote,
  useDeleteNote,
  useMe,
  useMembers,
  useNotes,
  useUpdateNote,
} from "@claimforge/api-client/react";
import {
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  EmptyState,
  FormField,
  Inline,
  SkeletonText,
  Stack,
  Text,
  Textarea,
} from "@claimforge/ui";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useOrganization } from "../../app/organization";
import { errorCopy, QueryView } from "../../app/states";
import { fullTime, relativeTime } from "../../format/relative-time";
import {
  completeMention,
  mentionQuery,
  segments,
  suggest,
  toBody,
  toDisplay,
  type Person,
} from "../mentions";
import { READ_ONLY_STATUSES } from "../status";
import { useClaimOfPage } from "./tabs";

type Note = Schema<"NoteRead">;

const NOTE_LIMIT = 10_000;

/** The claim's notes, newest first, and writing one; `@` mentions a teammate. */
export function NotesTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const notes = useNotes(organization.id, claim.id);
  const canWrite =
    organization.permissions.includes("field_data:write") &&
    !READ_ONLY_STATUSES.includes(claim.status);
  // "3 minutes ago" as of when the notes arrived, not of each render.
  const now = useMemo(() => new Date(notes.dataUpdatedAt), [notes.dataUpdatedAt]);

  return (
    <Stack gap={4}>
      {canWrite && <NewNote />}
      <QueryView query={notes} loading={<SkeletonText lines={4} />}>
        {(data) => {
          const all = allItems(data);
          if (all.length === 0) {
            return (
              <EmptyState
                headingLevel={2}
                title="No notes yet"
                description="Notes keep the team up to date on the claim. Type @ to bring someone in."
              />
            );
          }
          return (
            <Stack gap={3}>
              <Stack
                as="ul"
                gap={3}
                aria-label="Notes"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {all.map((note) => (
                  <li key={note.id}>
                    <NoteCard note={note} now={now} canWrite={canWrite} />
                  </li>
                ))}
              </Stack>
              {notes.hasNextPage && (
                <Inline justify="center">
                  <Button
                    variant="secondary"
                    loading={notes.isFetchingNextPage}
                    onClick={() => {
                      void notes.fetchNextPage();
                    }}
                  >
                    Show earlier notes
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

function NewNote() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const create = useCreateNote(organization.id, claim.id);
  const members = useMembers(organization.id);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const people = (members.data ?? []).map((m) => m.user);
  const save = async () => {
    setProblem(null);
    if (!text.trim()) {
      setProblem("Write something first.");
      return;
    }
    try {
      await create.mutateAsync({ body: toBody(text.trim(), people) });
    } catch (error) {
      setProblem(message(error));
      return;
    }
    setText("");
  };

  return (
    <Card role="region" aria-label="New note">
      <CardBody>
        <NoteEditor
          label="New note"
          text={text}
          onChange={setText}
          people={people}
          problem={problem}
          submitLabel="Add note"
          pending={create.isPending}
          onSubmit={save}
        />
      </CardBody>
    </Card>
  );
}

/**
 * A note's text box with `@` mentions: typing `@` and part of a name offers the matching
 * members as buttons (reachable with Tab); choosing one puts their full name in.
 */
function NoteEditor({
  label,
  text,
  onChange,
  people,
  problem,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  label: string;
  text: string;
  onChange: (text: string) => void;
  people: Person[];
  problem: string | null;
  submitLabel: string;
  pending: boolean;
  onSubmit: () => Promise<void>;
  onCancel?: () => void;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(text.length);
  const listId = useId();
  const typing = mentionQuery(text.slice(0, caret));
  const offered = typing === null ? [] : suggest(typing, people);

  // Where the caret goes once the completed name is in the box.
  const pendingCaretRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = pendingCaretRef.current;
    if (at !== null) {
      fieldRef.current?.setSelectionRange(at, at);
      pendingCaretRef.current = null;
    }
  }, [text]);

  const choose = (person: Person) => {
    const next = completeMention(text, caret, person);
    pendingCaretRef.current = next.caret;
    onChange(next.text);
    setCaret(next.caret);
    // Back to typing at once: keys pressed right after choosing must land in the box.
    fieldRef.current?.focus();
  };

  return (
    <form
      noValidate
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <Stack gap={2}>
        <FormField
          label={label}
          hideLabel
          hint="Type @ to mention someone"
          error={problem ?? undefined}
        >
          <Textarea
            ref={fieldRef}
            rows={3}
            maxLength={NOTE_LIMIT}
            value={text}
            aria-controls={offered.length > 0 ? listId : undefined}
            onChange={(event) => {
              onChange(event.target.value);
              setCaret(event.target.selectionStart);
            }}
            onSelect={(event) => {
              setCaret(event.currentTarget.selectionStart);
            }}
          />
        </FormField>
        {offered.length > 0 && (
          <Inline gap={2} id={listId} role="group" aria-label="Mention someone">
            {offered.map((person) => (
              <Button
                key={person.id}
                variant="secondary"
                size="sm"
                aria-label={`Mention ${person.full_name}`}
                onClick={() => {
                  choose(person);
                }}
              >
                {`@${person.full_name}`}
              </Button>
            ))}
          </Inline>
        )}
        <Inline justify="end" gap={2}>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" loading={pending}>
            {submitLabel}
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}

function NoteCard({ note, now, canWrite }: { note: Note; now: Date; canWrite: boolean }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const me = useMe();
  const members = useMembers(organization.id);
  const update = useUpdateNote(organization.id, claim.id);
  const remove = useDeleteNote(organization.id, claim.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const mine = note.author !== null && note.author.id === me.data?.id;
  const canEdit = canWrite && mine;
  const canDelete = canWrite && (mine || organization.permissions.includes("claims:delete"));
  const people = (members.data ?? []).map((m) => m.user);

  const save = async () => {
    if (editing === null) return;
    setProblem(null);
    if (!editing.trim()) {
      setProblem("A note can't be empty; delete it instead.");
      return;
    }
    try {
      await update.mutateAsync({ noteId: note.id, body: toBody(editing.trim(), people) });
    } catch (error) {
      setProblem(message(error));
      return;
    }
    setEditing(null);
  };

  return (
    <Card>
      <CardBody>
        <Stack gap={2}>
          <Inline justify="between" align="center" gap={3}>
            <Text weight="semibold">{note.author?.full_name ?? "Someone no longer here"}</Text>
            <Text size="sm" tone="subtle">
              <time dateTime={note.created_at} title={fullTime(note.created_at)}>
                {relativeTime(note.created_at, now)}
              </time>
              {note.edited_at && " · edited"}
            </Text>
          </Inline>
          {editing !== null ? (
            <NoteEditor
              label="Edit note"
              text={editing}
              onChange={setEditing}
              people={people}
              problem={problem}
              submitLabel="Save"
              pending={update.isPending}
              onSubmit={save}
              onCancel={() => {
                setEditing(null);
                setProblem(null);
              }}
            />
          ) : (
            <Text as="p" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {segments(note.text, note.mentions).map((part) =>
                part.mention ? (
                  <Text key={part.start} as="span" tone="accent" weight="semibold">
                    {part.text}
                  </Text>
                ) : (
                  part.text
                ),
              )}
            </Text>
          )}
          {editing === null && (canEdit || canDelete) && (
            <Inline gap={2}>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(toDisplay(note.body, note.mentions));
                  }}
                >
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleting(true);
                  }}
                >
                  Delete
                </Button>
              )}
            </Inline>
          )}
        </Stack>
      </CardBody>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        tone="danger"
        title="Delete this note?"
        description={
          mine
            ? "It comes off the claim for everyone."
            : `${note.author?.full_name ?? "Its author"} wrote it. It comes off the claim for everyone.`
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(note.id);
          } catch (error) {
            throw new Error(message(error), { cause: error });
          }
        }}
      />
    </Card>
  );
}

function message(error: unknown): string {
  if (isApiError(error, "unknown_mention")) {
    return "Someone mentioned isn't a member of this organization.";
  }
  if (isApiError(error, "not_note_author")) return "Only the author can edit a note.";
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled, so its notes can't change.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
