import { isApiError } from "@claimforge/api-client";
import {
  useDeleteReport,
  useReports,
  useReportShares,
  useRequestReport,
  useRevokeShare,
  useShareReport,
} from "@claimforge/api-client/react";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  EmptyState,
  FormField,
  Inline,
  Input,
  Select,
  SkeletonText,
  Stack,
  Text,
} from "@claimforge/ui";
import { Download } from "lucide-react";
import { useId, useState } from "react";

import { useOrganization } from "../../app/organization";
import { QueryView } from "../../app/states";
import { fullTime, relativeTime } from "../../format/relative-time";
import {
  fileSize,
  REPORT_COVERS,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  REPORT_TITLE,
  SHARE_DAYS,
  shareState,
  shortDay,
  type Report,
  type ReportKind,
  type Share,
} from "../reports";
import { message } from "./estimates-tab";
import { useClaimOfPage } from "./tabs";

const KINDS: ReportKind[] = ["photo_report", "drying_report"];

/** Whether this person can make, share and delete reports (closed claims can have them). */
function useCanReport(): boolean {
  return useOrganization().permissions.includes("reports:generate");
}

/** The claim's reports, newest first: making them, downloading them, sharing them. */
export function ReportsTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const reports = useReports(organization.id, claim.id);
  const request = useRequestReport(organization.id, claim.id);
  const canReport = useCanReport();
  const [now] = useState(() => new Date());
  // The report asked for here, whose progress is announced as it goes.
  const [watching, setWatching] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const watched = reports.data?.find((report) => report.id === watching);

  const make = async (kind: ReportKind) => {
    setFailure(null);
    try {
      const queued = await request.mutateAsync(kind);
      setWatching(queued.id);
    } catch (error) {
      setFailure(refusal(error));
    }
  };

  return (
    <Stack gap={4}>
      {canReport && (
        <Inline gap={2} justify="end" wrap>
          {KINDS.map((kind) => (
            <Button
              key={kind}
              variant={kind === "photo_report" ? "primary" : "secondary"}
              loading={request.isPending && request.variables === kind}
              title={REPORT_COVERS[kind]}
              onClick={() => void make(kind)}
            >
              {`Make ${REPORT_TITLE[kind].toLowerCase()}`}
            </Button>
          ))}
        </Inline>
      )}
      <Text as="p" size="sm" role="status" style={{ margin: 0 }}>
        {watched ? progress(watched) : ""}
      </Text>
      {failure && (
        <Text as="p" size="sm" role="alert" tone="danger" style={{ margin: 0 }}>
          {failure}
        </Text>
      )}
      <QueryView query={reports} loading={<SkeletonText lines={3} />}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              headingLevel={2}
              title="No reports yet"
              description={
                canReport
                  ? "Make a photo report or a drying report: a PDF to download or share by link."
                  : "Reports made for this claim will be here to download."
              }
            />
          ) : (
            <Stack
              as="ul"
              gap={4}
              aria-label="Reports"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {list.map((report) => (
                <li key={report.id}>
                  <ReportRow report={report} now={now} canReport={canReport} />
                </li>
              ))}
            </Stack>
          )
        }
      </QueryView>
    </Stack>
  );
}

/** Where a report asked for here has got to, in words. */
function progress(report: Report): string {
  const name = REPORT_TITLE[report.kind];
  if (report.status === "queued") return `Making the ${name.toLowerCase()}…`;
  if (report.status === "ready") return `${name} is ready to download.`;
  return `${name} couldn't be made.`;
}

function ReportRow({ report, now, canReport }: { report: Report; now: Date; canReport: boolean }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const remove = useDeleteReport(organization.id, claim.id);
  const [sharing, setSharing] = useState(false);
  const title = REPORT_TITLE[report.kind];
  const titleId = useId();
  const asked = [
    report.requested_by ? `Asked for by ${report.requested_by.full_name}` : "Asked for",
    relativeTime(report.created_at, now),
  ].join(", ");

  return (
    <Stack gap={1} role="group" aria-labelledby={titleId}>
      <Inline justify="between" align="center" gap={3} wrap>
        <Inline gap={2} align="center">
          <Text id={titleId} weight="semibold">
            {title}
          </Text>
          <Badge tone={REPORT_STATUS_TONE[report.status]} size="sm">
            {REPORT_STATUS_LABEL[report.status]}
          </Badge>
        </Inline>
        <Inline gap={2} align="center">
          {report.status === "ready" && report.download_url && (
            <Button variant="secondary" size="sm" leadingIcon={<Download size={16} />} asChild>
              <a href={report.download_url} download>
                Download
              </a>
            </Button>
          )}
          {canReport && report.status === "ready" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSharing(true);
              }}
            >
              Share
            </Button>
          )}
          {canReport && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" aria-label={`Delete the ${title.toLowerCase()}`}>
                  Delete
                </Button>
              }
              tone="danger"
              title={`Delete the ${title.toLowerCase()}?`}
              description="The PDF goes, and any links to it stop working. You can make a new one."
              confirmLabel="Delete"
              cancelLabel="Keep it"
              onConfirm={async () => {
                try {
                  await remove.mutateAsync(report.id);
                } catch (error) {
                  throw new Error(refusal(error), { cause: error });
                }
              }}
            />
          )}
        </Inline>
      </Inline>
      <Text size="sm" tone="muted" title={fullTime(report.created_at)}>
        {report.status === "ready" && report.size_bytes !== null
          ? `${asked} · PDF, ${fileSize(report.size_bytes)}`
          : asked}
      </Text>
      {report.status === "failed" && (
        <Text size="sm" tone="danger">
          {report.error ?? "It couldn't be made."} Make it again, or ask for help if it keeps
          failing.
        </Text>
      )}
      <Dialog open={sharing} onOpenChange={setSharing}>
        {sharing && <ShareDialog report={report} now={now} />}
      </Dialog>
    </Stack>
  );
}

/** Links to a ready report that work without signing in: made, copied once, revoked. */
function ShareDialog({ report, now }: { report: Report; now: Date }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const shares = useReportShares(organization.id, claim.id, report.id);
  const share = useShareReport(organization.id, claim.id, report.id);
  const formId = useId();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("7");
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const title = REPORT_TITLE[report.kind].toLowerCase();

  const submit = async () => {
    setFailure(null);
    setCopied(false);
    try {
      const created = await share.mutateAsync({
        expires_in_days: Number(days),
        label: label.trim() || null,
      });
      setMade(created.url);
      setLabel("");
    } catch (error) {
      setFailure(refusal(error));
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setFailure("Couldn't copy it: select the link and copy it yourself.");
    }
  };

  return (
    <DialogContent
      title={`Share the ${title}`}
      description="Anyone with a link can download the PDF, without signing in, until it expires or you revoke it."
      size="lg"
      footer={
        <DialogClose asChild>
          <Button variant="secondary">Done</Button>
        </DialogClose>
      }
    >
      <Stack gap={4}>
        {made && (
          <Stack gap={2} role="region" aria-label="New link">
            <FormField
              label="The new link"
              hint="Copy it now: it's shown only this once. Lost it? Make another."
            >
              <Input
                value={made}
                readOnly
                onFocus={(event) => {
                  event.target.select();
                }}
              />
            </FormField>
            <Inline gap={2} align="center">
              <Button variant="primary" size="sm" onClick={() => void copy(made)}>
                Copy link
              </Button>
              <Text size="sm" role="status">
                {copied ? "Copied." : ""}
              </Text>
            </Inline>
          </Stack>
        )}
        <form
          id={formId}
          aria-label="Make a link"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Stack gap={3}>
            {failure && (
              <Text as="p" role="alert" tone="danger" style={{ margin: 0 }}>
                {failure}
              </Text>
            )}
            <Inline gap={3} align="end" wrap>
              <div style={{ flex: "1 1 16rem" }}>
                <FormField label="Who it's for (optional)">
                  <Input
                    value={label}
                    maxLength={200}
                    placeholder="For Lone Star Mutual"
                    onChange={(event) => {
                      setLabel(event.target.value);
                    }}
                  />
                </FormField>
              </div>
              <div style={{ flex: "0 1 10rem" }}>
                <FormField label="Works for">
                  <Select
                    options={SHARE_DAYS.map((n) => ({
                      value: String(n),
                      label: n === 1 ? "1 day" : `${String(n)} days`,
                    }))}
                    value={days}
                    onValueChange={setDays}
                  />
                </FormField>
              </div>
              <Button type="submit" variant="secondary" loading={share.isPending}>
                Make link
              </Button>
            </Inline>
          </Stack>
        </form>
        <QueryView query={shares} loading={<SkeletonText lines={2} />}>
          {(list) =>
            list.length === 0 ? (
              <Text as="p" size="sm" tone="muted" style={{ margin: 0 }}>
                No links yet.
              </Text>
            ) : (
              <Stack
                as="ul"
                gap={3}
                aria-label="Links"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {list.map((link) => (
                  <li key={link.id}>
                    <ShareRow report={report} share={link} now={now} onFailure={setFailure} />
                  </li>
                ))}
              </Stack>
            )
          }
        </QueryView>
      </Stack>
    </DialogContent>
  );
}

function ShareRow({
  report,
  share,
  now,
  onFailure,
}: {
  report: Report;
  share: Share;
  now: Date;
  onFailure: (text: string | null) => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const revoke = useRevokeShare(organization.id, claim.id, report.id);
  const state = shareState(share, now);
  const name = share.label ?? "A link without a label";
  const opened =
    share.open_count === 0
      ? "Not opened yet"
      : `Opened ${share.open_count === 1 ? "once" : `${String(share.open_count)} times`}${
          share.last_opened_at ? `, last ${relativeTime(share.last_opened_at, now)}` : ""
        }`;
  const standing =
    state === "active"
      ? `Works until ${shortDay(share.expires_at)}`
      : state === "revoked"
        ? "Revoked"
        : `Expired ${shortDay(share.expires_at)}`;

  return (
    <Inline justify="between" align="center" gap={3} wrap>
      <Stack gap={0}>
        <Text weight="medium">{name}</Text>
        <Text size="sm" tone="muted">{`${standing} · ${opened}`}</Text>
      </Stack>
      {state === "active" && (
        <Button
          variant="ghost"
          size="sm"
          loading={revoke.isPending}
          aria-label={`Revoke ${share.label ? `the link ${share.label}` : "this link"}`}
          onClick={() => {
            onFailure(null);
            revoke.mutateAsync(share.id).catch((error: unknown) => {
              onFailure(refusal(error));
            });
          }}
        >
          Revoke
        </Button>
      )}
    </Inline>
  );
}

function refusal(error: unknown): string {
  if (isApiError(error, "report_not_ready")) return "Only a ready report can be shared.";
  if (isApiError(error, "permission_denied")) {
    return "You aren't allowed to make or change reports here.";
  }
  if (isApiError(error, "not_found")) return "That report is gone: someone deleted it.";
  return message(error);
}
