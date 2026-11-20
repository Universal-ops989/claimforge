import { isApiError } from "@claimforge/api-client";
import {
  allItems,
  useDeleteDocument,
  useDocuments,
  useUpdateDocument,
  useUploadDocument,
} from "@claimforge/api-client/react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  FileDropzone,
  FormField,
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
  type BadgeTone,
} from "@claimforge/ui";
import { Download, MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import { FormDialog } from "../../app/form-dialog";
import { useOrganization } from "../../app/organization";
import { QueryView } from "../../app/states";
import { fullTime, relativeTime } from "../../format/relative-time";
import {
  attachFailure,
  CATEGORIES,
  CATEGORY_LABEL,
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  documentType,
  fileKind,
  type Document,
  type DocumentCategory,
} from "../documents";
import { eachAtMost } from "../photo-upload";
import { fileSize } from "../reports";
import { READ_ONLY_STATUSES } from "../status";
import { message } from "./estimates-tab";
import { useClaimOfPage } from "./tabs";

const ALL = "all";

/** Whether this person can attach and change documents on this claim. */
function useCanFile(): boolean {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  return (
    organization.permissions.includes("field_data:write") &&
    !READ_ONLY_STATUSES.includes(claim.status)
  );
}

/** The claim's paperwork, newest first: attached, filed by category, opened, renamed. */
export function DocumentsTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const canFile = useCanFile();
  const [category, setCategory] = useState<DocumentCategory | typeof ALL>(ALL);
  const documents = useDocuments(
    organization.id,
    claim.id,
    category === ALL ? {} : { category: [category] },
  );
  const [now] = useState(() => new Date());
  const [editing, setEditing] = useState<Document | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <Stack gap={4}>
      {canFile && <DocumentAttacher />}
      <Inline justify="between" align="end" gap={3} wrap>
        <div style={{ flex: "0 1 16rem" }}>
          <FormField label="Show">
            <Select
              options={[
                { value: ALL, label: "Every category" },
                ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
              ]}
              value={category}
              onValueChange={(value) => {
                setCategory(value as DocumentCategory | typeof ALL);
              }}
            />
          </FormField>
        </div>
      </Inline>
      {failure && (
        <Text as="p" role="alert" tone="danger" style={{ margin: 0 }}>
          {failure}
        </Text>
      )}
      <QueryView query={documents} loading={<SkeletonText lines={4} />}>
        {(data) => {
          const shown = allItems(data);
          if (shown.length === 0) {
            return category === ALL ? (
              <EmptyState
                headingLevel={2}
                title="No documents yet"
                description="Work authorizations, letters, invoices and policies attached to this claim show here."
              />
            ) : (
              <EmptyState
                size="compact"
                headingLevel={2}
                title={`No ${CATEGORY_LABEL[category].toLowerCase()} documents`}
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCategory(ALL);
                    }}
                  >
                    Show every document
                  </Button>
                }
              />
            );
          }
          return (
            <Stack gap={4}>
              <Stack
                as="ul"
                gap={4}
                aria-label="Documents"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {shown.map((document) => (
                  <li key={document.id}>
                    <DocumentRow
                      document={document}
                      now={now}
                      canFile={canFile}
                      onEdit={() => {
                        setEditing(document);
                      }}
                      onFailure={setFailure}
                    />
                  </li>
                ))}
              </Stack>
              <Stack gap={2} align="center">
                <Text size="sm" tone="muted" role="status">
                  {documents.hasNextPage
                    ? `Showing ${String(shown.length)} documents`
                    : `Showing all ${String(shown.length)} ${shown.length === 1 ? "document" : "documents"}`}
                </Text>
                {documents.hasNextPage && (
                  <Button
                    variant="secondary"
                    loading={documents.isFetchingNextPage}
                    onClick={() => {
                      void documents.fetchNextPage();
                    }}
                  >
                    Load more documents
                  </Button>
                )}
              </Stack>
            </Stack>
          );
        }}
      </QueryView>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        {editing && (
          <EditDocumentForm
            document={editing}
            onDone={() => {
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </Stack>
  );
}

function DocumentRow({
  document,
  now,
  canFile,
  onEdit,
  onFailure,
}: {
  document: Document;
  now: Date;
  canFile: boolean;
  onEdit: () => void;
  onFailure: (text: string | null) => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const remove = useDeleteDocument(organization.id, claim.id);
  const [deleting, setDeleting] = useState(false);
  const by = document.uploaded_by ? `Attached by ${document.uploaded_by.full_name}` : "Attached";

  return (
    <Inline justify="between" align="center" gap={3} wrap>
      <Stack gap={1} style={{ minWidth: 0, flex: "1 1 20rem" }}>
        <Inline gap={2} align="center" wrap>
          {document.view_url ? (
            <a
              href={document.view_url}
              target="_blank"
              rel="noreferrer"
              aria-label={`${document.title} (opens in a new tab)`}
            >
              <Text weight="semibold">{document.title}</Text>
            </a>
          ) : (
            <Text weight="semibold">{document.title}</Text>
          )}
          <Badge tone={CATEGORY_TONE[document.category]} size="sm">
            {CATEGORY_LABEL[document.category]}
          </Badge>
        </Inline>
        <Text size="sm" tone="muted" style={{ overflowWrap: "anywhere" }}>
          {`${document.filename} · ${fileKind(document.content_type)}, ${fileSize(document.size_bytes)}`}
        </Text>
        <Text size="sm" tone="muted" title={fullTime(document.created_at)}>
          {`${by}, ${relativeTime(document.created_at, now)}`}
        </Text>
      </Stack>
      <Inline gap={1} align="center">
        <Button variant="secondary" size="sm" leadingIcon={<Download size={16} />} asChild>
          <a
            href={document.download_url}
            download={document.filename}
            aria-label={`Download ${document.title}`}
          >
            Download
          </a>
        </Button>
        {canFile && (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={`Change ${document.title}`}>
                <MoreHorizontal size={16} aria-hidden="true" />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={onEdit}>Rename or recategorize</MenuItem>
              <MenuItem
                tone="danger"
                onSelect={() => {
                  setDeleting(true);
                }}
              >
                Delete
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </Inline>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        tone="danger"
        title={`Delete “${document.title}”?`}
        description="The file goes with it. Anyone who needs it again will have to attach it again."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={async () => {
          onFailure(null);
          try {
            await remove.mutateAsync(document.id);
          } catch (error) {
            throw new Error(refusal(error), { cause: error });
          }
        }}
      />
    </Inline>
  );
}

const CATEGORY_TONE: Record<DocumentCategory, BadgeTone> = {
  authorization: "success",
  correspondence: "info",
  estimate: "neutral",
  invoice: "warning",
  policy: "neutral",
  report: "info",
  other: "neutral",
};

type State = "waiting" | "uploading" | "done" | "failed";

interface Queued {
  key: number;
  file: File;
  category: DocumentCategory;
  state: State;
  error: string | null;
}

const STATE_LABEL: Record<State, string> = {
  waiting: "Waiting",
  uploading: "Attaching…",
  done: "Attached",
  failed: "Not attached",
};

const STATE_TONE: Record<State, BadgeTone> = {
  waiting: "neutral",
  uploading: "info",
  done: "success",
  failed: "danger",
};

/** How many documents go up at once. */
const AT_ONCE = 3;

/** Attach documents: choose their category, drop or browse, and watch each one go. */
function DocumentAttacher() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const upload = useUploadDocument(organization.id, claim.id);
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [queue, setQueue] = useState<Queued[]>([]);
  const [refused, setRefused] = useState<string[]>([]);
  const nextKeyRef = useRef(0);

  const update = (key: number, changes: Partial<Queued>) => {
    setQueue((items) => items.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };

  const send = (items: Queued[]) =>
    eachAtMost(items, AT_ONCE, async (item) => {
      update(item.key, { state: "uploading", error: null });
      try {
        const type = documentType(item.file);
        await upload.mutateAsync({
          file: item.file,
          category: item.category,
          ...(type ? { content_type: type } : {}),
        });
        update(item.key, { state: "done" });
      } catch (error) {
        update(item.key, { state: "failed", error: attachFailure(error) });
      }
    });

  const add = (files: File[]) => {
    const items = files.map((file): Queued => ({
      key: (nextKeyRef.current += 1),
      file,
      category,
      state: "waiting",
      error: null,
    }));
    setQueue((before) => [...before, ...items]);
    void send(items);
  };

  return (
    <Card role="region" aria-label="Attach documents">
      <CardHeader headingLevel={2} title="Attach documents" />
      <CardBody>
        <Stack gap={3}>
          <div style={{ maxWidth: "20rem" }}>
            <FormField label="File new documents under">
              <Select
                options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                value={category}
                onValueChange={(value) => {
                  setCategory(value as DocumentCategory);
                }}
              />
            </FormField>
          </div>
          <FileDropzone
            title="Drop documents here"
            hint="PDF, Word, Excel, CSV, text, email or images, up to 50 MB each"
            browseLabel="Choose documents"
            accept={DOCUMENT_ACCEPT}
            maxSize={DOCUMENT_MAX_BYTES}
            multiple
            onFilesAccepted={(files) => {
              const taken = files.filter((file) => documentType(file) !== null);
              setRefused(
                files
                  .filter((file) => documentType(file) === null)
                  .map((file) => `${file.name}: not a kind of file a claim can keep.`),
              );
              if (taken.length > 0) add(taken);
            }}
          />
          {refused.length > 0 && (
            <Stack
              as="ul"
              gap={1}
              role="alert"
              style={{ margin: 0, paddingInlineStart: "1.25rem" }}
            >
              {refused.map((line) => (
                <li key={line}>
                  <Text size="sm" tone="danger">
                    {line}
                  </Text>
                </li>
              ))}
            </Stack>
          )}
          {queue.length > 0 && (
            <Stack
              as="ul"
              gap={2}
              aria-label="Attaching"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {queue.map((item) => (
                <li key={item.key}>
                  <Inline justify="between" align="center" gap={3}>
                    <Stack gap={1}>
                      <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                        {`${item.file.name} · ${CATEGORY_LABEL[item.category]}`}
                      </Text>
                      {item.error && (
                        <Text size="sm" tone="danger">
                          {item.error}
                        </Text>
                      )}
                    </Stack>
                    <Inline gap={2} align="center">
                      <Badge tone={STATE_TONE[item.state]} size="sm">
                        {STATE_LABEL[item.state]}
                      </Badge>
                      {item.state === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Try ${item.file.name} again`}
                          onClick={() => {
                            void send([item]);
                          }}
                        >
                          Try again
                        </Button>
                      )}
                    </Inline>
                  </Inline>
                </li>
              ))}
            </Stack>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}

function EditDocumentForm({ document, onDone }: { document: Document; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const update = useUpdateDocument(organization.id, claim.id);
  const [title, setTitle] = useState(document.title);
  const [category, setCategory] = useState<DocumentCategory>(document.category);
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setProblem("Give it a title people will recognize.");
      return;
    }
    setProblem(undefined);
    setFailure(null);
    const changes = {
      ...(trimmed !== document.title ? { title: trimmed } : {}),
      ...(category !== document.category ? { category } : {}),
    };
    if (Object.keys(changes).length > 0) {
      try {
        await update.mutateAsync({ documentId: document.id, changes });
      } catch (error) {
        setFailure(refusal(error));
        return;
      }
    }
    onDone();
  };

  return (
    <FormDialog
      title="Rename or recategorize"
      submitLabel="Save changes"
      pending={update.isPending}
      failure={failure}
      onSubmit={save}
    >
      <FormField label="Title" required error={problem} hint={document.filename}>
        <Input
          value={title}
          maxLength={200}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </FormField>
      <FormField label="Category">
        <Select
          options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          value={category}
          onValueChange={(value) => {
            setCategory(value as DocumentCategory);
          }}
        />
      </FormField>
    </FormDialog>
  );
}

function refusal(error: unknown): string {
  if (isApiError(error, "claim_locked")) return "The claim was closed or cancelled.";
  if (isApiError(error, "not_found")) return "That document is gone: someone deleted it.";
  return message(error);
}
