import { isApiError, type Schema } from "@claimforge/api-client";
import {
  allItems,
  useAddLine,
  useDeleteLine,
  useEstimate,
  usePriceItems,
  usePriceLists,
  useStructures,
  useUpdateEstimate,
  useUpdateLine,
} from "@claimforge/api-client/react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  FormField,
  Grid,
  Heading,
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
  VisuallyHidden,
} from "@claimforge/ui";
import { MoreHorizontal } from "lucide-react";
import { useDeferredValue, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";

import { FormDialog } from "../../app/form-dialog";
import { inOrganization, useOrganization } from "../../app/organization";
import { QueryView } from "../../app/states";
import {
  ESTIMATE_STATUS_LABEL,
  ESTIMATE_STATUS_TONE,
  lineTotal,
  money,
  parseDecimal,
  percent,
  quantity,
  type Estimate,
  type Line,
} from "../estimates";
import { message, useCanEstimate } from "./estimates-tab";
import { useClaimOfPage } from "./tabs";

type PriceItem = Schema<"PriceItemRead">;

const NO_ROOM = "none";
const QUANTITY = { places: 2, max: 9_999_999_999.99, what: "quantity" };
const PRICE = { places: 2, max: 9_999_999_999.99, what: "unit price" };

type Open = { kind: "details" } | { kind: "add" } | { kind: "line"; line: Line } | null;

/** One estimate: its lines, its totals, and changing it while it's a draft. */
export function EstimateEditor() {
  const { estimateId = "" } = useParams();
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const estimate = useEstimate(organization.id, claim.id, estimateId);
  const canEstimate = useCanEstimate();
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  return (
    <Stack gap={4}>
      <Link to={inOrganization(organization.slug, `claims/${claim.number}/estimates`)}>
        All estimates
      </Link>
      <QueryView query={estimate} loading={<SkeletonText lines={6} />}>
        {(data) => {
          const editable = canEstimate && data.status === "draft";
          return (
            <Stack gap={4}>
              <Inline justify="between" align="center" gap={3}>
                <Inline gap={2} align="center">
                  <Heading level={2}>{`Estimate ${String(data.number)} · ${data.title}`}</Heading>
                  <Badge tone={ESTIMATE_STATUS_TONE[data.status]}>
                    {ESTIMATE_STATUS_LABEL[data.status]}
                  </Badge>
                </Inline>
                {editable && (
                  <Inline gap={2}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setOpen({ kind: "details" });
                      }}
                    >
                      Edit details
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setOpen({ kind: "add" });
                      }}
                    >
                      Add a line
                    </Button>
                  </Inline>
                )}
              </Inline>
              {canEstimate && data.status !== "draft" && (
                <Text as="p" tone="muted">
                  {`This estimate is ${ESTIMATE_STATUS_LABEL[data.status].toLowerCase()}, so its lines can't change. Move it back to draft to change it.`}
                </Text>
              )}
              <Text size="sm" tone="muted">
                {[
                  data.price_list ? `Priced from ${data.price_list.name}` : "No price list",
                  data.notes,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <LinesTable
                estimate={data}
                editable={editable}
                onEdit={(line) => {
                  setOpen({ kind: "line", line });
                }}
              />
              <Totals estimate={data} />
              <Dialog
                open={open !== null}
                onOpenChange={(next) => {
                  if (!next) close();
                }}
              >
                {open?.kind === "details" && <DetailsForm estimate={data} onDone={close} />}
                {open?.kind === "add" && <AddLineForm estimate={data} onDone={close} />}
                {open?.kind === "line" && (
                  <LineForm estimate={data} line={open.line} onDone={close} />
                )}
              </Dialog>
            </Stack>
          );
        }}
      </QueryView>
    </Stack>
  );
}

function LinesTable({
  estimate,
  editable,
  onEdit,
}: {
  estimate: Estimate;
  editable: boolean;
  onEdit: (line: Line) => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const update = useUpdateLine(organization.id, claim.id, estimate.id);
  const remove = useDeleteLine(organization.id, claim.id, estimate.id);
  const [failure, setFailure] = useState<string | null>(null);
  const run = (work: Promise<unknown>) => {
    setFailure(null);
    work.catch((error: unknown) => {
      setFailure(message(error));
    });
  };

  if (estimate.lines.length === 0) {
    return (
      <Card>
        <CardBody>
          <Text tone="muted">
            {editable ? "No lines yet. Add them from your price list or by hand." : "No lines."}
          </Text>
        </CardBody>
      </Card>
    );
  }
  const cell = { padding: "var(--cf-space-2)", verticalAlign: "top" } as const;
  const end = { ...cell, textAlign: "end" } as const;
  return (
    <Card>
      <CardBody>
        {failure && (
          <Text as="p" role="alert" tone="danger">
            {failure}
          </Text>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <caption style={{ textAlign: "start" }}>
              <Text size="sm" tone="muted">
                Lines
              </Text>
            </caption>
            <thead>
              <tr>
                {["#", "Item", "Quantity", "Unit price", "Total"].map((heading, i) => (
                  <th
                    key={heading}
                    scope="col"
                    style={i >= 2 ? end : { ...cell, textAlign: "start" }}
                  >
                    <Text size="sm" tone="muted">
                      {heading}
                    </Text>
                  </th>
                ))}
                {editable && (
                  <th scope="col" style={cell}>
                    <VisuallyHidden>Change</VisuallyHidden>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {estimate.lines.map((line, i) => (
                <tr key={line.id} style={{ borderTop: "1px solid var(--cf-color-border)" }}>
                  <td style={cell}>
                    <Text size="sm">{line.position}</Text>
                  </td>
                  <th scope="row" style={{ ...cell, textAlign: "start", fontWeight: "normal" }}>
                    <Stack gap={1}>
                      <Text>
                        {line.code ? `${line.code} · ${line.description}` : line.description}
                      </Text>
                      <Text size="sm" tone="muted">
                        {[line.room?.name, line.taxable ? "Taxed" : "Not taxed", line.notes]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </Stack>
                  </th>
                  <td style={end}>
                    <Text>{`${quantity(line.quantity)} ${line.unit}`}</Text>
                  </td>
                  <td style={end}>
                    <Text>{money(line.unit_price)}</Text>
                  </td>
                  <td style={end}>
                    <Text weight="semibold">{money(line.total)}</Text>
                  </td>
                  {editable && (
                    <td style={cell}>
                      <Menu>
                        <MenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Change line ${String(line.position)}`}
                          >
                            <MoreHorizontal size={16} aria-hidden="true" />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem
                            onSelect={() => {
                              onEdit(line);
                            }}
                          >
                            Edit
                          </MenuItem>
                          {i > 0 && (
                            <MenuItem
                              onSelect={() => {
                                run(
                                  update.mutateAsync({
                                    lineId: line.id,
                                    changes: { position: line.position - 1 },
                                  }),
                                );
                              }}
                            >
                              Move up
                            </MenuItem>
                          )}
                          {i < estimate.lines.length - 1 && (
                            <MenuItem
                              onSelect={() => {
                                run(
                                  update.mutateAsync({
                                    lineId: line.id,
                                    changes: { position: line.position + 1 },
                                  }),
                                );
                              }}
                            >
                              Move down
                            </MenuItem>
                          )}
                          <MenuItem
                            tone="danger"
                            onSelect={() => {
                              run(remove.mutateAsync(line.id));
                            }}
                          >
                            Delete
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

/** The totals as the API works them out, and subtotals by room. */
function Totals({ estimate }: { estimate: Estimate }) {
  const { totals } = estimate;
  const row = (label: string, amount: string, strong = false): [string, ReactNode] => [
    label,
    <Text key={label} weight={strong ? "semibold" : "regular"}>
      {money(amount)}
    </Text>,
  ];
  const rows = [
    row("Subtotal", totals.subtotal),
    row(`Tax ${percent(estimate.tax_percent)} on ${money(totals.taxable_subtotal)}`, totals.tax),
    row(`Overhead ${percent(estimate.overhead_percent)}`, totals.overhead),
    row(`Profit ${percent(estimate.profit_percent)}`, totals.profit),
    row("Total", totals.total, true),
  ];
  return (
    <Grid minChildWidth="18rem" gap={4}>
      <Card role="region" aria-label="Totals">
        <CardHeader headingLevel={3} title="Totals" />
        <CardBody>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "var(--cf-space-2)",
              margin: 0,
            }}
          >
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <Text as="dt" tone={label === "Total" ? "default" : "muted"}>
                  {label}
                </Text>
                <dd style={{ margin: 0, textAlign: "end" }}>{value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
      {estimate.rooms.length > 0 && (
        <Card role="region" aria-label="By room">
          <CardHeader headingLevel={3} title="By room" />
          <CardBody>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "var(--cf-space-2)",
                margin: 0,
              }}
            >
              {estimate.rooms.map((room) => (
                <div key={room.room?.id ?? "none"} style={{ display: "contents" }}>
                  <Text as="dt" tone="muted">
                    {`${room.room?.name ?? "No room"} (${String(room.lines)} ${room.lines === 1 ? "line" : "lines"})`}
                  </Text>
                  <dd style={{ margin: 0, textAlign: "end" }}>
                    <Text>{money(room.subtotal)}</Text>
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      )}
    </Grid>
  );
}

/** The claim's rooms as a select's options, with "No room". */
function useRoomChoices() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const layout = useStructures(organization.id, claim.id);
  return [
    ...(layout.data ?? []).flatMap((s) =>
      s.rooms.map((r) => ({
        value: r.id,
        label: layout.data && layout.data.length > 1 ? `${r.name} (${s.name})` : r.name,
      })),
    ),
    { value: NO_ROOM, label: "No room" },
  ];
}

/** Add a line: from the price list (searched) or by hand. */
function AddLineForm({ estimate, onDone }: { estimate: Estimate; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const add = useAddLine(organization.id, claim.id, estimate.id);
  const rooms = useRoomChoices();
  const [byHand, setByHand] = useState(estimate.price_list === null);
  const [item, setItem] = useState<PriceItem | null>(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [room, setRoom] = useState(NO_ROOM);
  const [taxable, setTaxable] = useState(true);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const found: Record<string, string> = {};
    const amount = parseDecimal(qty, QUANTITY);
    if ("problem" in amount) found.qty = amount.problem;
    let priced: { value: string } | { problem: string } = { value: "" };
    if (byHand) {
      if (!description.trim()) found.description = "Describe the work.";
      if (!unit.trim()) found.unit = "Enter the unit: SF, LF, EA, DA…";
      priced = parseDecimal(price, PRICE);
      if ("problem" in priced) found.price = priced.problem;
    } else if (!item) {
      found.item = "Choose an item, or enter a line by hand.";
    }
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0 || "problem" in amount || "problem" in priced) return;
    try {
      await add.mutateAsync({
        quantity: amount.value,
        taxable,
        room_id: room === NO_ROOM ? null : room,
        ...(byHand
          ? {
              code: code.trim() || null,
              description: description.trim(),
              unit: unit.trim(),
              unit_price: priced.value,
            }
          : { price_item_id: item?.id ?? null }),
      });
    } catch (error) {
      setFailure(lineFailure(error));
      return;
    }
    onDone();
  };

  const unitOf = byHand ? unit.trim() : (item?.unit ?? "");
  return (
    <FormDialog
      title="Add a line"
      submitLabel="Add line"
      pending={add.isPending}
      failure={failure}
      onSubmit={save}
      size="lg"
    >
      {byHand ? (
        <Stack gap={3}>
          <Grid minChildWidth="10rem" gap={3}>
            <FormField label="Code" hint="If it has one">
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                }}
              />
            </FormField>
            <FormField label="Unit" required error={problems.unit}>
              <Input
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                }}
              />
            </FormField>
            <FormField label="Unit price" required error={problems.price}>
              <Input
                inputMode="decimal"
                prefix="$"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                }}
              />
            </FormField>
          </Grid>
          <FormField label="Description" required error={problems.description}>
            <Input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
            />
          </FormField>
          {estimate.price_list && (
            <Inline>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setByHand(false);
                }}
              >
                Choose from the price list instead
              </Button>
            </Inline>
          )}
        </Stack>
      ) : item ? (
        <Inline justify="between" align="center" gap={3}>
          <Stack gap={1}>
            <Text>{`${item.code} · ${item.description}`}</Text>
            <Text size="sm" tone="muted">{`${money(item.unit_price)} per ${item.unit}`}</Text>
          </Stack>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setItem(null);
            }}
          >
            Choose another
          </Button>
        </Inline>
      ) : (
        <PriceItemSearch
          listId={estimate.price_list?.id ?? ""}
          problem={problems.item}
          onChoose={setItem}
          onByHand={() => {
            setByHand(true);
          }}
        />
      )}
      <Grid minChildWidth="10rem" gap={3}>
        <FormField
          label="Quantity"
          required
          error={problems.qty}
          hint={unitOf ? `In ${unitOf}` : undefined}
        >
          <Input
            inputMode="decimal"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
            }}
          />
        </FormField>
        <FormField label="Room">
          <Select options={rooms} value={room} onValueChange={setRoom} />
        </FormField>
      </Grid>
      <Checkbox
        label="Taxable"
        description="Sales tax applies: usually materials, often not labor."
        checked={taxable}
        onCheckedChange={(checked) => {
          setTaxable(checked === true);
        }}
      />
      {(byHand ? price : item?.unit_price) && "value" in parseDecimal(qty, QUANTITY) && (
        <Text size="sm" tone="muted">
          {`Line total ${money(lineTotal(qty.replace(/[,\s]/g, ""), byHand ? price.replace(/[$,\s]/g, "") : (item?.unit_price ?? "0")))}`}
        </Text>
      )}
    </FormDialog>
  );
}

function PriceItemSearch({
  listId,
  problem,
  onChoose,
  onByHand,
}: {
  listId: string;
  problem?: string;
  onChoose: (item: PriceItem) => void;
  onByHand: () => void;
}) {
  const organization = useOrganization();
  const [q, setQ] = useState("");
  const search = useDeferredValue(q.trim());
  const items = usePriceItems(
    organization.id,
    listId,
    search ? { q: search, limit: 8 } : { limit: 8 },
  );
  const found = allItems(items.data);
  return (
    <Stack gap={2}>
      <FormField label="Search the price list" hint="Code or description" error={problem}>
        <Input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
      </FormField>
      {items.isPending ? (
        <SkeletonText lines={3} />
      ) : found.length === 0 ? (
        <Text tone="muted">
          {search ? `Nothing on the list matches "${search}".` : "The list is empty."}
        </Text>
      ) : (
        <Stack
          as="ul"
          gap={1}
          aria-label="Price items"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {found.map((item) => (
            <li key={item.id}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Choose ${item.code}, ${item.description}`}
                onClick={() => {
                  onChoose(item);
                }}
              >
                {`${item.code} · ${item.description} · ${money(item.unit_price)}/${item.unit}`}
              </Button>
            </li>
          ))}
        </Stack>
      )}
      <Inline>
        <Button variant="secondary" size="sm" onClick={onByHand}>
          Enter a line by hand
        </Button>
      </Inline>
    </Stack>
  );
}

/** Change a line: what it is, how much, where, and whether it's taxed. */
function LineForm({
  estimate,
  line,
  onDone,
}: {
  estimate: Estimate;
  line: Line;
  onDone: () => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const update = useUpdateLine(organization.id, claim.id, estimate.id);
  const rooms = useRoomChoices();
  const [code, setCode] = useState(line.code ?? "");
  const [description, setDescription] = useState(line.description);
  const [unit, setUnit] = useState(line.unit);
  const [price, setPrice] = useState(line.unit_price);
  const [qty, setQty] = useState(() => quantity(line.quantity).replace(/,/g, ""));
  const [room, setRoom] = useState(line.room?.id ?? NO_ROOM);
  const [taxable, setTaxable] = useState(line.taxable);
  const [notes, setNotes] = useState(line.notes ?? "");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const found: Record<string, string> = {};
    const amount = parseDecimal(qty, QUANTITY);
    const priced = parseDecimal(price, PRICE);
    if ("problem" in amount) found.qty = amount.problem;
    if ("problem" in priced) found.price = priced.problem;
    if (!description.trim()) found.description = "Describe the work.";
    if (!unit.trim()) found.unit = "Enter the unit.";
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0 || "problem" in amount || "problem" in priced) return;
    try {
      await update.mutateAsync({
        lineId: line.id,
        changes: {
          code: code.trim() || null,
          description: description.trim(),
          unit: unit.trim(),
          unit_price: priced.value,
          quantity: amount.value,
          room_id: room === NO_ROOM ? null : room,
          taxable,
          notes: notes.trim() || null,
        },
      });
    } catch (error) {
      setFailure(lineFailure(error));
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title={`Edit line ${String(line.position)}`}
      submitLabel="Save changes"
      pending={update.isPending}
      failure={failure}
      onSubmit={save}
      size="lg"
    >
      <Grid minChildWidth="10rem" gap={3}>
        <FormField label="Code">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
          />
        </FormField>
        <FormField label="Quantity" required error={problems.qty}>
          <Input
            inputMode="decimal"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
            }}
          />
        </FormField>
        <FormField label="Unit" required error={problems.unit}>
          <Input
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
            }}
          />
        </FormField>
        <FormField label="Unit price" required error={problems.price}>
          <Input
            inputMode="decimal"
            prefix="$"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
            }}
          />
        </FormField>
      </Grid>
      <FormField label="Description" required error={problems.description}>
        <Input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
        />
      </FormField>
      <Grid minChildWidth="12rem" gap={3}>
        <FormField label="Room">
          <Select options={rooms} value={room} onValueChange={setRoom} />
        </FormField>
        <Checkbox
          label="Taxable"
          checked={taxable}
          onCheckedChange={(checked) => {
            setTaxable(checked === true);
          }}
        />
      </Grid>
      <FormField label="Notes">
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
          }}
        />
      </FormField>
    </FormDialog>
  );
}

/** The estimate's title, notes, price list and rates. */
function DetailsForm({ estimate, onDone }: { estimate: Estimate; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const lists = usePriceLists(organization.id);
  const update = useUpdateEstimate(organization.id, claim.id, estimate.id);
  const [title, setTitle] = useState(estimate.title);
  const [notes, setNotes] = useState(estimate.notes ?? "");
  const [list, setList] = useState(estimate.price_list?.id ?? "");
  const [rates, setRates] = useState({
    tax: estimate.tax_percent,
    overhead: estimate.overhead_percent,
    profit: estimate.profit_percent,
  });
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const found: Record<string, string> = {};
    if (!title.trim()) found.title = "Name it.";
    const checked = {
      tax: parseDecimal(rates.tax, { places: 3, max: 100, what: "tax rate" }),
      overhead: parseDecimal(rates.overhead, { places: 3, max: 100, what: "overhead rate" }),
      profit: parseDecimal(rates.profit, { places: 3, max: 100, what: "profit rate" }),
    };
    for (const [name, result] of Object.entries(checked)) {
      if ("problem" in result) found[name] = result.problem;
    }
    setProblems(found);
    setFailure(null);
    if (
      Object.keys(found).length > 0 ||
      "problem" in checked.tax ||
      "problem" in checked.overhead ||
      "problem" in checked.profit
    ) {
      return;
    }
    try {
      await update.mutateAsync({
        title: title.trim(),
        notes: notes.trim() || null,
        tax_percent: checked.tax.value,
        overhead_percent: checked.overhead.value,
        profit_percent: checked.profit.value,
        ...(list && list !== estimate.price_list?.id ? { price_list_id: list } : {}),
      });
    } catch (error) {
      setFailure(lineFailure(error));
      return;
    }
    onDone();
  };

  const rate = (name: "tax" | "overhead" | "profit", label: string) => (
    <FormField label={label} error={problems[name]}>
      <Input
        inputMode="decimal"
        suffix="%"
        value={rates[name]}
        onChange={(e) => {
          setRates((r) => ({ ...r, [name]: e.target.value }));
        }}
      />
    </FormField>
  );

  return (
    <FormDialog
      title="Estimate details"
      submitLabel="Save changes"
      pending={update.isPending}
      failure={failure}
      onSubmit={save}
    >
      <FormField label="Title" required error={problems.title}>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
      </FormField>
      <FormField
        label="Price list"
        hint="New lines are priced from it; existing lines keep their prices"
      >
        <Select
          placeholder="No price list"
          options={(lists.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
          value={list}
          onValueChange={setList}
        />
      </FormField>
      <Grid minChildWidth="8rem" gap={3}>
        {rate("tax", "Tax")}
        {rate("overhead", "Overhead")}
        {rate("profit", "Profit")}
      </Grid>
      <FormField label="Notes">
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
          }}
        />
      </FormField>
    </FormDialog>
  );
}

/** A change to an estimate refused, in words. */
function lineFailure(error: unknown): string {
  if (isApiError(error, "estimate_not_draft")) {
    return "This estimate isn't a draft any more, so it can't change. Move it back to draft first.";
  }
  if (isApiError(error, "unknown_price_item")) return "That item isn't on the price list any more.";
  if (isApiError(error, "claim_locked")) return "The claim was closed or cancelled.";
  return message(error);
}
